import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import FamilyGroup from "@/models/FamilyGroup";

function toNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const groups = await FamilyGroup.find({ agentId: session.user.id })
    .sort({ familyName: 1 })
    .lean();
  const policies = await Customer.find({
    agentId: session.user.id,
    familyGroupId: { $ne: null },
  })
    .select("familyGroupId premiumAmount endDate")
    .lean();

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const today = now.toISOString().split("T")[0];
  const soon = in30.toISOString().split("T")[0];

  const summaries = new Map<string, { policyCount: number; totalPremium: number; renewalAlerts: number }>();
  for (const policy of policies) {
    const id = String(policy.familyGroupId);
    const current = summaries.get(id) ?? {
      policyCount: 0,
      totalPremium: 0,
      renewalAlerts: 0,
    };
    current.policyCount += 1;
    current.totalPremium += toNumber(policy.premiumAmount);
    if (policy.endDate >= today && policy.endDate <= soon) {
      current.renewalAlerts += 1;
    }
    summaries.set(id, current);
  }

  return NextResponse.json({
    familyGroups: groups.map((group) => ({
      ...group,
      ...(summaries.get(String(group._id)) ?? {
        policyCount: 0,
        totalPremium: 0,
        renewalAlerts: 0,
      }),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.familyName || !body?.primaryPolicyholderName) {
    return NextResponse.json(
      { error: "Family name and primary policyholder are required" },
      { status: 400 },
    );
  }

  await connectDB();
  const familyGroup = await FamilyGroup.create({
    agentId: session.user.id,
    familyName: String(body.familyName),
    primaryPolicyholderName: String(body.primaryPolicyholderName),
    primaryPhone: String(body.primaryPhone ?? ""),
    notes: String(body.notes ?? ""),
  });

  return NextResponse.json(familyGroup, { status: 201 });
}
