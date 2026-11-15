import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import ReferralPayment from "@/models/ReferralPayment";
import { summarizeReferralLedger } from "@/lib/referralMath";

type Params = { params: Promise<{ id: string; paymentId: string }> };

// ── POST — Void a payment ──────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, paymentId } = await params;
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(paymentId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const agentId = session.user.id;
  const body = await req.json().catch(() => null);

  const reason = body?.reason;
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  await connectDB();

  const payment = await ReferralPayment.findOne({
    _id: paymentId,
    referralId: id,
    agentId,
  });
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  if (payment.voidedAt) {
    return NextResponse.json(
      { error: "Payment is already voided" },
      { status: 409 },
    );
  }

  payment.voidedAt = new Date();
  payment.voidReason = reason.trim().slice(0, 500);
  payment.updatedAt = new Date();
  await payment.save();

  // Compute current balance after voiding
  const [policies, payments] = await Promise.all([
    Customer.find({ agentId, referredById: id }).lean(),
    ReferralPayment.find({ agentId, referralId: id, voidedAt: null }).lean(),
  ]);

  const summary = summarizeReferralLedger(policies, payments);

  return NextResponse.json({
    payment: payment.toObject(),
    currentBalance: summary.balance,
  });
}
