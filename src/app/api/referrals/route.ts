import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import ReferralMember from "@/models/ReferralMember";
import {
  emptyReferralSummary,
  summarizeReferralPolicies,
} from "@/lib/referralMath";

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
    .select(
      "referredById type premiumAmount premiumWithoutGst thirdPartyPremium ownDamagePremium commissionType commissionValue commissionStatus premiumPaidByAgency paymentReceivedFromReferral paymentSentToReferral details",
    )
    .lean();

  const groupedPolicies = new Map<string, any[]>();
  for (const policy of policies) {
    const id = String(policy.referredById);
    const current = groupedPolicies.get(id) ?? [];
    current.push(policy);
    groupedPolicies.set(id, current);
  }

  return NextResponse.json({
    referrals: referrals.map((referral) => ({
      ...referral,
      ...(groupedPolicies.has(String(referral._id))
        ? summarizeReferralPolicies(groupedPolicies.get(String(referral._id)) ?? [])
        : emptyReferralSummary()),
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
