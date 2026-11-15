import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import ReferralMember from "@/models/ReferralMember";
import ReferralPayment from "@/models/ReferralPayment";
import { summarizeReferralLedger } from "@/lib/referralMath";
import type { ReferralPaymentInput } from "@/lib/referralMath";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = session.user.id;
  await connectDB();

  const referrals = await ReferralMember.find({ agentId })
    .sort({ name: 1 })
    .lean();

  const policies = await Customer.find({
    agentId,
    referredById: { $ne: null },
  })
    .select(
      "referredById type premiumAmount premiumWithoutGst thirdPartyPremium ownDamagePremium commissionType commissionValue premiumPaidByAgency details",
    )
    .lean();

  const payments = await ReferralPayment.find({ agentId })
    .select("referralId direction amount voidedAt")
    .lean();

  // Group policies by referralId
  const groupedPolicies = new Map<string, Record<string, unknown>[]>();
  for (const policy of policies) {
    const refId = String(policy.referredById);
    const current = groupedPolicies.get(refId) ?? [];
    current.push(policy);
    groupedPolicies.set(refId, current);
  }

  // Group payments by referralId
  const groupedPayments = new Map<string, ReferralPaymentInput[]>();
  for (const payment of payments) {
    const refId = String((payment as Record<string, unknown>).referralId);
    const current = groupedPayments.get(refId) ?? [];
    current.push({
      direction: (payment as Record<string, unknown>).direction as "sent" | "received",
      amount: (payment as Record<string, unknown>).amount as number,
      voidedAt: (payment as Record<string, unknown>).voidedAt as Date | null,
    });
    groupedPayments.set(refId, current);
  }

  return NextResponse.json({
    referrals: referrals.map((referral) => {
      const refId = String(referral._id);
      const refPolicies = groupedPolicies.get(refId) ?? [];
      const refPayments = groupedPayments.get(refId) ?? [];
      const summary = summarizeReferralLedger(refPolicies, refPayments);
      return { ...referral, ...summary };
    }),
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
