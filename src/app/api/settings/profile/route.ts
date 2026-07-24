import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Agent from "@/models/Agent";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const agent = await Agent.findById(session.user.id);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({
    name: agent.name,
    email: agent.email,
    phone: agent.phone,
    agencyName: agent.agencyName,
    licenseNumber: agent.licenseNumber,
    subscriptionTier: agent.subscriptionTier,
    subscriptionStatus: agent.subscriptionStatus,
    createdAt: agent.createdAt
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, phone, agencyName, licenseNumber } = await req.json();

  await connectDB();
  const agent = await Agent.findByIdAndUpdate(
    session.user.id,
    { name, phone, agencyName, licenseNumber },
    { new: true }
  );

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
