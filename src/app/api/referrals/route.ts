import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import ReferralMember from "@/models/ReferralMember";

function toNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function commissionAmount(policy: any) {
  const premium = toNumber(policy.premiumAmount);
  const value = toNumber(policy.commissionValue);
  return policy.commissionType === "flat" ? value : (premium * value) / 100;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const referrals = await ReferralMember.find({ agentId: session.user.id })
    .sort({ name: 1 })
    .lean();
  const policies = await Customer.find({
    agentId: session.user.id,
    referredById: { $ne: null },
  })
    .select("referredById premiumAmount commissionType commissionValue commissionStatus")
    .lean();

  const summaries = new Map<string, any>();
  for (const policy of policies) {
    const id = String(policy.referredById);
    const current = summaries.get(id) ?? {
      totalPolicies: 0,
      totalCommission: 0,
      pendingCommission: 0,
      paidCommission: 0,
    };
    const amount = commissionAmount(policy);
    current.totalPolicies += 1;
    current.totalCommission += amount;
    if (policy.commissionStatus === "Paid") current.paidCommission += amount;
    else current.pendingCommission += amount;
    summaries.set(id, current);
  }

  return NextResponse.json({
    referrals: referrals.map((referral) => ({
      ...referral,
      ...(summaries.get(String(referral._id)) ?? {
        totalPolicies: 0,
        totalCommission: 0,
        pendingCommission: 0,
        paidCommission: 0,
      }),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  await connectDB();
  const referral = await ReferralMember.create({
    agentId: session.user.id,
    name: String(body.name),
    phone: String(body.phone ?? ""),
    email: String(body.email ?? ""),
    address: String(body.address ?? ""),
    notes: String(body.notes ?? ""),
  });

  return NextResponse.json(referral, { status: 201 });
}
