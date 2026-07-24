import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const agentId = new mongoose.Types.ObjectId(session.user.id as string);

  // For monthly data, we want the last 12 months.
  // We can just group by substring of startDate.
  const today = new Date();
  const twelveMonthsAgo = new Date(today.getFullYear() - 1, today.getMonth(), 1);
  const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().slice(0, 10);
  const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [monthlyPolicies, monthlyPremiums, typeDistribution, allCustomers] = await Promise.all([
    Customer.aggregate([
      { $match: { agentId, startDate: { $gte: twelveMonthsAgoStr } } },
      { $group: { _id: { $substr: ["$startDate", 0, 7] }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Customer.aggregate([
      { $match: { agentId, startDate: { $gte: twelveMonthsAgoStr } } },
      { $group: { _id: { $substr: ["$startDate", 0, 7] }, total: { $sum: { $convert: { input: "$premiumAmount", to: "double", onError: 0, onNull: 0 } } } } },
      { $sort: { _id: 1 } }
    ]),
    Customer.aggregate([
      { $match: { agentId } },
      { $group: { _id: "$type", count: { $sum: 1 }, premium: { $sum: { $convert: { input: "$premiumAmount", to: "double", onError: 0, onNull: 0 } } } } }
    ]),
    Customer.find({ agentId }).select("endDate").lean()
  ]);

  let active = 0;
  let expiring = 0;
  let expired = 0;

  for (const c of allCustomers) {
    if (c.endDate < todayStr) {
      expired++;
    } else if (c.endDate >= todayStr && c.endDate <= in30) {
      expiring++;
    } else {
      active++;
    }
  }

  return NextResponse.json({
    monthlyPolicies: monthlyPolicies.map(m => ({ month: m._id, count: m.count })),
    monthlyPremiums: monthlyPremiums.map(m => ({ month: m._id, total: m.total })),
    typeDistribution: typeDistribution.map(m => ({ type: m._id, count: m.count, premium: m.premium })),
    statusSummary: { active, expiring, expired }
  });
}
