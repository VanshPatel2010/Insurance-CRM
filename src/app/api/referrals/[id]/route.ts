import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import ReferralMember from "@/models/ReferralMember";
import {
  commissionAmount,
  commissionBaseAmount,
  summarizeReferralPolicies,
} from "@/lib/referralMath";

type Params = { params: Promise<{ id: string }> };

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
    commissionBase: commissionBaseAmount(policy),
  }));

  const summary = {
    ...summarizeReferralPolicies(policies),
    totalReferred: policies.length,
  };

  return NextResponse.json({ referral, policies, summary });
}
