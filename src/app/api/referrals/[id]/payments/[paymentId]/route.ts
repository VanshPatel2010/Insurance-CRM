import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import ReferralPayment from "@/models/ReferralPayment";

type Params = { params: Promise<{ id: string; paymentId: string }> };

const VALID_MODES = ["cash", "upi", "bank", "cheque", "adjustment", "legacy"] as const;

// ── PATCH — Edit a payment (date, mode, reference, note only) ──────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
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
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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
      { error: "Cannot edit a voided payment" },
      { status: 409 },
    );
  }

  // Only allow editing: date, mode, reference, note
  if (body.date !== undefined) {
    const parsedDate = new Date(body.date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "date must be a valid date" }, { status: 400 });
    }
    payment.date = parsedDate;
  }

  if (body.mode !== undefined) {
    if (!VALID_MODES.includes(body.mode as typeof VALID_MODES[number])) {
      return NextResponse.json(
        { error: `mode must be one of: ${VALID_MODES.join(", ")}` },
        { status: 400 },
      );
    }
    payment.mode = body.mode;
  }

  if (body.reference !== undefined) {
    payment.reference = String(body.reference).trim().slice(0, 200);
  }

  if (body.note !== undefined) {
    payment.note = String(body.note).trim().slice(0, 500);
  }

  // If mode is adjustment, note must be non-empty
  if (payment.mode === "adjustment" && !payment.note) {
    return NextResponse.json(
      { error: "note is required for adjustment payments" },
      { status: 400 },
    );
  }

  payment.updatedAt = new Date();
  await payment.save();

  return NextResponse.json({ payment: payment.toObject() });
}
