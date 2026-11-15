import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import ReferralMember from "@/models/ReferralMember";
import ReferralPayment from "@/models/ReferralPayment";
import { summarizeReferralLedger, round2 } from "@/lib/referralMath";

type Params = { params: Promise<{ id: string }> };

const VALID_DIRECTIONS = ["sent", "received"] as const;
const VALID_MODES = ["cash", "upi", "bank", "cheque", "adjustment", "legacy"] as const;

// ── GET — List payments for a referral ─────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid referral ID" }, { status: 400 });
  }

  const agentId = session.user.id;
  const { searchParams } = req.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
  const skip = (page - 1) * limit;

  // Build date filter
  const dateFilter: Record<string, Date> = {};
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (fromParam) {
    const fromDate = new Date(fromParam);
    if (!isNaN(fromDate.getTime())) {
      dateFilter.$gte = fromDate;
    }
  }
  if (toParam) {
    const toDate = new Date(toParam);
    if (!isNaN(toDate.getTime())) {
      // Inclusive: end of day
      toDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = toDate;
    }
  }

  const filter: Record<string, unknown> = { agentId, referralId: id };
  if (Object.keys(dateFilter).length > 0) {
    filter.date = dateFilter;
  }

  await connectDB();

  const [payments, total] = await Promise.all([
    ReferralPayment.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
    ReferralPayment.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return NextResponse.json({ payments, total, page, totalPages });
}

// ── POST — Record a new payment ────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid referral ID" }, { status: 400 });
  }

  const agentId = session.user.id;
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Validate direction ────────────────────────────────────────────────────
  const direction = body.direction as string;
  if (!VALID_DIRECTIONS.includes(direction as typeof VALID_DIRECTIONS[number])) {
    return NextResponse.json(
      { error: "direction must be 'sent' or 'received'" },
      { status: 400 },
    );
  }

  // ── Validate amount ──────────────────────────────────────────────────────
  const rawAmount = Number(body.amount);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return NextResponse.json({ error: "amount must be a positive finite number" }, { status: 400 });
  }
  if (rawAmount > 99_99_999) {
    return NextResponse.json({ error: "amount exceeds maximum allowed (₹99,99,999)" }, { status: 400 });
  }
  // Max 2 decimal places check
  const decimalStr = String(rawAmount).split(".")[1];
  if (decimalStr && decimalStr.length > 2) {
    return NextResponse.json({ error: "amount must have at most 2 decimal places" }, { status: 400 });
  }
  const amount = round2(rawAmount);

  // ── Validate mode ────────────────────────────────────────────────────────
  const mode = body.mode as string;
  if (!VALID_MODES.includes(mode as typeof VALID_MODES[number])) {
    return NextResponse.json(
      { error: `mode must be one of: ${VALID_MODES.join(", ")}` },
      { status: 400 },
    );
  }

  // If mode is adjustment, note is required
  if (mode === "adjustment" && !body.note?.trim()) {
    return NextResponse.json(
      { error: "note is required for adjustment payments" },
      { status: 400 },
    );
  }

  // ── Validate date ────────────────────────────────────────────────────────
  const parsedDate = new Date(body.date);
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "date must be a valid date" }, { status: 400 });
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);
  if (parsedDate > tomorrow) {
    return NextResponse.json({ error: "date cannot be more than 1 day in the future" }, { status: 400 });
  }

  await connectDB();

  // ── Idempotency check ────────────────────────────────────────────────────
  const clientRequestId = body.clientRequestId ? String(body.clientRequestId).trim().slice(0, 100) : undefined;
  if (clientRequestId) {
    const existing = await ReferralPayment.findOne({ agentId, clientRequestId }).lean();
    if (existing) {
      return NextResponse.json({ payment: existing }, { status: 200 });
    }
  }

  // ── Verify referral exists and belongs to agent ──────────────────────────
  const referral = await ReferralMember.findOne({ _id: id, agentId }).lean();
  if (!referral) {
    return NextResponse.json({ error: "Referral not found" }, { status: 404 });
  }

  // ── Fetch policies and non-voided payments for balance computation ───────
  const [policies, payments] = await Promise.all([
    Customer.find({ agentId, referredById: id }).lean(),
    ReferralPayment.find({ agentId, referralId: id, voidedAt: null }).lean(),
  ]);

  const currentSummary = summarizeReferralLedger(policies, payments);
  const currentBalance = currentSummary.balance;

  // ── Expected-balance optimistic lock ─────────────────────────────────────
  if (body.expectedBalance !== undefined && body.expectedBalance !== null) {
    const expected = Number(body.expectedBalance);
    if (Number.isFinite(expected) && Math.abs(expected - currentBalance) > 0.005) {
      return NextResponse.json(
        { code: "BALANCE_CHANGED", currentBalance },
        { status: 409 },
      );
    }
  }

  // ── Check for overpayment ────────────────────────────────────────────────
  // Compute what the new balance would be after this payment
  const balanceDelta = direction === "sent" ? -amount : amount;
  const newBalance = round2(currentBalance + balanceDelta);
  let warning: string | undefined;
  if (
    (currentBalance > 0.005 && newBalance < -0.005) ||
    (currentBalance < -0.005 && newBalance > 0.005)
  ) {
    warning = "OVERPAYMENT";
  }

  // ── Create payment ──────────────────────────────────────────────────────
  const reference = body.reference ? String(body.reference).trim().slice(0, 200) : "";
  const note = body.note ? String(body.note).trim().slice(0, 500) : "";

  const payment = await ReferralPayment.create({
    agentId,
    referralId: id,
    direction,
    amount,
    date: parsedDate,
    mode,
    reference,
    note,
    clientRequestId: clientRequestId || undefined,
  });

  const responseBody: Record<string, unknown> = {
    payment: payment.toObject(),
    currentBalance: newBalance,
  };
  if (warning) {
    responseBody.warning = warning;
  }

  return NextResponse.json(responseBody, { status: 201 });
}
