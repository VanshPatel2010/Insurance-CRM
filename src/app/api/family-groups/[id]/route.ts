import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import FamilyGroup from "@/models/FamilyGroup";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();
  const familyGroup = await FamilyGroup.findOne({
    _id: id,
    agentId: session.user.id,
  }).lean();
  if (!familyGroup) {
    return NextResponse.json({ error: "Family group not found" }, { status: 404 });
  }

  const policies = await Customer.find({
    agentId: session.user.id,
    familyGroupId: id,
  })
    .sort({ endDate: 1 })
    .lean();

  return NextResponse.json({ familyGroup, policies });
}
