import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Claim from "@/models/Claim";
import Customer from "@/models/Customer";
import { escapeRegExp } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const parsedPage = Number.parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "50", 10) || 50;
  
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const MAX_LIMIT = 100;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, MAX_LIMIT)
    : 50;

  await connectDB();

  const filter: Record<string, unknown> = { agentId: session.user.id };

  if (status && status !== "all") {
    filter.status = status;
  }

  if (search) {
    const safeSearch = escapeRegExp(search);
    filter.$or = [
      { claimNumber: { $regex: safeSearch, $options: "i" } },
      { description: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [total, claims] = await Promise.all([
    Claim.countDocuments(filter),
    Claim.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customerId", "customerName policyNumber type")
      .lean(),
  ]);

  return NextResponse.json({
    claims,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

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

  const { customerId, claimNumber, claimDate, description, claimAmount, status } = body;

  if (!customerId || !claimNumber || !claimDate || !claimAmount) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  await connectDB();

  // Verify customer belongs to agent
  const customer = await Customer.findOne({ _id: customerId, agentId: session.user.id });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  try {
    const newClaim = await Claim.create({
      agentId: session.user.id,
      customerId,
      claimNumber,
      claimDate,
      description: description || "",
      claimAmount,
      status: status || "Filed",
    });

    return NextResponse.json(newClaim, { status: 201 });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: `Claim number "${claimNumber}" already exists.` }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create claim" }, { status: 500 });
  }
}
