import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import ReferralMember from "@/models/ReferralMember";
import ReferralPayment from "@/models/ReferralPayment";
import {
  commissionAmount,
  commissionBaseAmount,
  summarizeReferralLedger,
  computePolicyStatuses,
} from "@/lib/referralMath";

type Params = { params: Promise<{ id: string }> };

// ── GET /api/referrals/:id ──────────────────────────────────────────────────────
export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid referral ID" }, { status: 400 });
  }

  const agentId = session.user.id;
  await connectDB();

  const referral = await ReferralMember.findOne({ _id: id, agentId }).lean();
  if (!referral) {
    return NextResponse.json({ error: "Referral member not found" }, { status: 404 });
  }

  const [rawPolicies, payments] = await Promise.all([
    Customer.find({ agentId, referredById: id }).sort({ startDate: -1 }).lean(),
    ReferralPayment.find({ agentId, referralId: id }).sort({ date: -1 }).lean(),
  ]);

  const policies = rawPolicies.map((policy: Record<string, unknown>) => ({
    ...policy,
    commissionAmount: commissionAmount(policy),
    commissionBase: commissionBaseAmount(policy),
  }));

  const paymentInputs = payments.map((p: Record<string, unknown>) => ({
    direction: p.direction as "sent" | "received",
    amount: p.amount as number,
    voidedAt: p.voidedAt as Date | null,
  }));

  const summary = summarizeReferralLedger(rawPolicies, paymentInputs);

  const policyStatuses = computePolicyStatuses(
    rawPolicies.map((p: Record<string, unknown>) => ({
      ...p,
      _id: String(p._id),
      startDate: String(p.startDate ?? ""),
    })),
    paymentInputs,
  );

  return NextResponse.json({ referral, policies, payments, summary, policyStatuses });
}

// ── DELETE /api/referrals/:id ───────────────────────────────────────────────────
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid referral ID" }, { status: 400 });
  }

  const agentId = session.user.id;
  await connectDB();

  const referral = await ReferralMember.findOne({ _id: id, agentId });
  if (!referral) {
    return NextResponse.json({ error: "Referral not found" }, { status: 404 });
  }

  const [policyCount, paymentCount] = await Promise.all([
    Customer.countDocuments({ agentId, referredById: id }),
    ReferralPayment.countDocuments({ agentId, referralId: id }),
  ]);

  if (policyCount > 0 || paymentCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete referral with existing policies or payments" },
      { status: 409 },
    );
  }

  await ReferralMember.deleteOne({ _id: id, agentId });
  return NextResponse.json({ message: "Referral deleted" });
}
