import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import { customerSchema, escapeRegExp } from "@/lib/validations";

// ── GET /api/customers ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") || "";
  const type = searchParams.get("type") || "";
  const status = searchParams.get("status") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") || "50", 10));

  await connectDB();

  // Build filter scoped to this agent
  const filter: Record<string, unknown> = { agentId: session.user.id };

  if (type && type !== "all") {
    filter.type = type;
  }

  if (search) {
    const safeSearch = escapeRegExp(search);
    filter.$or = [
      { customerName: { $regex: safeSearch, $options: "i" } },
      { phone: { $regex: safeSearch, $options: "i" } },
      { policyNumber: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (status === "Active") {
    // endDate as string comparison: greater than today in YYYY-MM-DD form
    filter.endDate = { $gt: today.toISOString().split("T")[0] };
    // Exclude expiring-soon from "Active" filter
    filter.$and = [{ endDate: { $gt: in30.toISOString().split("T")[0] } }];
  } else if (status === "Expired") {
    filter.endDate = { $lt: today.toISOString().split("T")[0] };
  } else if (status === "Expiring Soon") {
    filter.endDate = {
      $gte: today.toISOString().split("T")[0],
      $lte: in30.toISOString().split("T")[0],
    };
  }

  const skip = (page - 1) * limit;
  const total = await Customer.countDocuments(filter);
  const customers = await Customer.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return NextResponse.json({
    customers,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

// ── POST /api/customers ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  await connectDB();

  // Check duplicate policyNumber for this agent
  const existing = await Customer.findOne({
    agentId: session.user.id,
    policyNumber: data.policyNumber,
  });
  if (existing) {
    return NextResponse.json(
      {
        error: `Policy number "${data.policyNumber}" already exists for your account.`,
      },
      { status: 409 }
    );
  }

  // Extract type-specific fields into details
  const {
    type,
    customerName,
    phone,
    email,
    address,
    policyNumber,
    premiumAmount,
    sumInsured,
    startDate,
    endDate,
    details: submittedDetails,
    ...rest
  } = data as any;

  const customer = await Customer.create({
    agentId: session.user.id,
    type,
    customerName,
    phone,
    email: email ?? "",
    address: address ?? "",
    policyNumber,
    premiumAmount,
    sumInsured: sumInsured ?? "",
    startDate,
    endDate,
    details: { ...(submittedDetails ?? {}), ...rest },
  });

  return NextResponse.json(customer, { status: 201 });
}
