import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Company from "@/models/Company";
import FamilyGroup from "@/models/FamilyGroup";
import ReferralMember from "@/models/ReferralMember";
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
  const parsedPage = Number.parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "50", 10) || 50;
  
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const MAX_LIMIT = 100;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, MAX_LIMIT)
    : 50;

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

  const CUSTOMER_LIST_FIELDS =
    "_id customerName type policyNumber companyId premiumAmount endDate familyGroupId familyMemberName familyRelationship createdAt";

  const [total, customers] = await Promise.all([
    Customer.countDocuments(filter),
    Customer.find(filter)
      .select(CUSTOMER_LIST_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("familyGroupId", "familyName primaryPolicyholderName")
      .lean(),
  ]);

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
    companyId,
    premiumAmount,
    premiumWithoutGst,
    sumInsured,
    startDate,
    endDate,
    familyGroupId,
    familyMemberName,
    familyRelationship,
    referredById,
    referralAgentCode,
    commissionType,
    commissionValue,
    commissionStatus,
    premiumPaidByAgency,
    paymentReceivedFromReferral,
    paymentSentToReferral,
    details: submittedDetails,
    ...rest
  } = data as any;

  if (familyGroupId) {
    const family = await FamilyGroup.findOne({
      _id: familyGroupId,
      agentId: session.user.id,
    });
    if (!family) {
      return NextResponse.json({ error: "Family group not found" }, { status: 404 });
    }
  }

  if (!companyId) {
    return NextResponse.json({ error: "Company is required" }, { status: 400 });
  }

  const company = await Company.findOne({
    _id: companyId,
    agentId: session.user.id,
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  if (referredById) {
    const referral = await ReferralMember.findOne({
      _id: referredById,
      agentId: session.user.id,
    });
    if (!referral) {
      return NextResponse.json({ error: "Referral member not found" }, { status: 404 });
    }
  }

  try {
  const customer = await Customer.create({
    agentId: session.user.id,
    type,
    customerName,
    phone,
    email: email ?? "",
    address: address ?? "",
    policyNumber,
    companyId,
    premiumAmount,
    premiumWithoutGst: premiumWithoutGst ?? "",
    sumInsured: sumInsured ?? "",
    startDate,
    endDate,
    familyGroupId: familyGroupId || null,
    familyMemberName: familyMemberName ?? customerName,
    familyRelationship: familyRelationship ?? "",
    referredById: referredById || null,
    referralAgentCode: referredById ? referralAgentCode ?? "" : "",
    commissionType: referredById ? commissionType || "percentage" : "",
    commissionValue: referredById ? commissionValue ?? "" : "",
    commissionStatus: referredById ? commissionStatus || "Pending" : "Pending",
    premiumPaidByAgency: referredById ? premiumPaidByAgency ?? "" : "",
    paymentReceivedFromReferral: referredById ? paymentReceivedFromReferral ?? "" : "",
    paymentSentToReferral: referredById ? paymentSentToReferral ?? "" : "",
    details: { ...(submittedDetails ?? {}), ...rest },
  });

  return NextResponse.json(customer, { status: 201 });
} catch (error: any) {
  if (
    error?.code === 11000 &&
    error?.keyPattern?.agentId &&
    error?.keyPattern?.policyNumber
  ) {
    return NextResponse.json(
      { error: `Policy number "${policyNumber}" already exists for your account.` },
      { status: 409 }
    );
  }

  return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
}
}
