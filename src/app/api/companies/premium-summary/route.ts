import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/models/Customer";

function isDateString(value: string | null) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!isDateString(from) || !isDateString(to)) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  if (from && to && from > to) {
    return NextResponse.json(
      { error: "Start date must be before end date" },
      { status: 400 },
    );
  }

  await connectDB();
  const match: Record<string, unknown> = {
    agentId: new mongoose.Types.ObjectId(session.user.id),
  };
  const startDate: Record<string, string> = {};
  if (from) startDate.$gte = from;
  if (to) startDate.$lte = to;
  if (Object.keys(startDate).length) match.startDate = startDate;

  const rows = await Customer.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$companyId",
        policyCount: { $sum: 1 },
        totalPremium: {
          $sum: {
            $convert: {
              input: "$premiumAmount",
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
    },
    {
      $lookup: {
        from: "companies",
        localField: "_id",
        foreignField: "_id",
        as: "company",
      },
    },
    { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        companyId: { $ifNull: [{ $toString: "$_id" }, null] },
        companyName: { $ifNull: ["$company.name", "Unassigned"] },
        policyCount: 1,
        totalPremium: 1,
      },
    },
    { $sort: { companyName: 1 } },
  ]);

  return NextResponse.json({ rows });
}
