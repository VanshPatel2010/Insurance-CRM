import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Claim from "@/models/Claim";

type Params = { params: Promise<{ id: string }> };

// ── GET /api/claims/[id] ───────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const claim = await Claim.findOne({ _id: id, agentId: session.user.id })
    .populate("customerId", "customerName policyNumber type")
    .lean();

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  return NextResponse.json(claim);
}

// ── PUT /api/claims/[id] ───────────────────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: Params) {
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

  const { newNote, ...updateFields } = body;

  const { id } = await params;
  await connectDB();
  
  const claim = await Claim.findOne({ _id: id, agentId: session.user.id });
  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  if (newNote) {
    claim.notes.push({ text: newNote });
  }

  Object.assign(claim, updateFields);
  claim.updatedAt = new Date();

  await claim.save();

  const updatedClaim = await Claim.findById(claim._id)
    .populate("customerId", "customerName policyNumber type")
    .lean();

  return NextResponse.json(updatedClaim);
}

// ── DELETE /api/claims/[id] ────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const result = await Claim.deleteOne({ _id: id, agentId: session.user.id });
  
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Claim not found or not authorized" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
