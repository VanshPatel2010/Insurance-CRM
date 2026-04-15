/**
 * Dashboard page — Server Component passing hydration to Client
 */

import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import DashboardClient from "./DashboardClient";
import { daysUntilExpiry } from "@/lib/utils";

export const metadata = { title: "Dashboard — InsureCRM" };
export const revalidate = 60;

async function getDashboardData(agentIdStr: string) {
  await connectDB();
  const agentId = new mongoose.Types.ObjectId(agentIdStr);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [total, typeCounts, expiring, premiumAgg, recent] = await Promise.all([
    Customer.countDocuments({ agentId }),
    Customer.aggregate([
      { $match: { agentId } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
    Customer.find({
      agentId,
      endDate: {
        $gte: today.toISOString().slice(0, 10),
        $lte: in30.toISOString().slice(0, 10),
      },
    })
      .sort({ endDate: 1 })
      .limit(10)
      .lean(),
    Customer.aggregate([
      { $match: { agentId } },
      {
        $group: { _id: null, total: { $sum: { $toDouble: "$premiumAmount" } } },
      },
    ]),
    Customer.find({ agentId }).sort({ createdAt: -1 }).limit(8).lean(),
  ]);

  const typeCountMap = Object.fromEntries(
    (typeCounts as { _id: string; count: number }[]).map(({ _id, count }) => [
      _id,
      count,
    ]),
  );

  return {
    total,
    typeCountMap,
    expiring: expiring as unknown as Array<Record<string, string>>,
    totalPremium: premiumAgg[0]?.total ?? 0,
    recent: recent as unknown as Array<Record<string, string>>,
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const agentId = session.user.id as string;
  const { total, typeCountMap, expiring, totalPremium, recent } =
    await getDashboardData(agentId);

  const serializedExpiring = expiring.map((p: any) => ({
    _id: p._id.toString(),
    customerName: p.customerName,
    phone: p.phone,
    policyNumber: p.policyNumber,
    type: p.type,
    endDate: p.endDate,
    daysUntilExpiry: daysUntilExpiry(p.endDate),
  }));

  const initialData = {
    total,
    typeCountMap,
    expiring: serializedExpiring,
    totalPremium,
    recent: recent.map((r: any) => ({
      ...r,
      _id: r._id.toString(),
      agentId: r.agentId.toString(),
      createdAt:
        r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      updatedAt:
        r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
    })),
  };

  return <DashboardClient initialData={initialData} />;
}
