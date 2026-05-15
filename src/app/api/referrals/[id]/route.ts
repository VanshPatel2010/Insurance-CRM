import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import ReferralMember from "@/models/ReferralMember";

type Params = { params: Promise<{ id: string }> };

function toNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function commissionAmount(policy: any) {
  const premium = toNumber(policy.premiumAmount);
  const value = toNumber(policy.commissionValue);
  return policy.commissionType === "flat" ? value : (premium * value) / 100;
}

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();
  const referral = await ReferralMember.findOne({
    _id: id,
    agentId: session.user.id,
  }).lean();
  if (!referral) {
    return NextResponse.json({ error: "Referral member not found" }, { status: 404 });
  }

  const rawPolicies = await Customer.find({
    agentId: session.user.id,
    referredById: id,
  })
    .sort({ startDate: -1 })
    .lean();

  const policies = rawPolicies.map((policy) => ({
    ...policy,
    commissionAmount: commissionAmount(policy),
  }));

  const summary = policies.reduce(
    (acc, policy: any) => {
      acc.totalReferred += 1;
      acc.totalCommission += policy.commissionAmount;
      if (policy.commissionStatus === "Paid") acc.paidCommission += policy.commissionAmount;
      else acc.pendingCommission += policy.commissionAmount;
      return acc;
    },
    { totalReferred: 0, totalCommission: 0, pendingCommission: 0, paidCommission: 0 },
  );

  return NextResponse.json({ referral, policies, summary });
}
