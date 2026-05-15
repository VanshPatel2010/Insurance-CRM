import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const policyIds = Array.isArray(body?.policyIds) ? body.policyIds : [];
  const status = body?.status === "Paid" ? "Paid" : "Pending";

  await connectDB();
  const filter: Record<string, unknown> = {
    agentId: session.user.id,
    referredById: id,
  };
  if (policyIds.length > 0) {
    filter._id = { $in: policyIds };
  }

  const result = await Customer.updateMany(filter, {
    $set: { commissionStatus: status, updatedAt: new Date() },
  });

  return NextResponse.json({ updated: result.modifiedCount });
}
