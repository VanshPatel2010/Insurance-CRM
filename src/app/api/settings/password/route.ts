import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Agent from "@/models/Agent";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: "Invalid password requirements" }, { status: 400 });
  }

  await connectDB();
  const agent = await Agent.findById(session.user.id).select("+password");
  
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const isMatch = await bcrypt.compare(currentPassword, agent.password);
  if (!isMatch) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  agent.password = await bcrypt.hash(newPassword, 10);
  await agent.save();

  return NextResponse.json({ success: true });
}
