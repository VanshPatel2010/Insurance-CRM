import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { connectDB } from '@/lib/mongodb';
import Customer from '@/models/Customer';

// ── GET /api/dashboard/stats ───────────────────────────────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const agentId = session.user.id;
  const today   = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  const in30     = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in30Str  = in30.toISOString().split('T')[0];

  // Run all aggregations in parallel
  const [
    total,
    typeCounts,
    expiringDocs,
    premiumAgg,
    recentDocs,
  ] = await Promise.all([
    // 1. Total customers
    Customer.countDocuments({ agentId }),

    // 2. Count per type
    Customer.aggregate([
      { $match: { agentId: new (await import('mongoose')).Types.ObjectId(agentId) } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),

    // 3. Expiring in next 30 days
    Customer.find({
      agentId,
      endDate: { $gte: todayStr, $lte: in30Str },
    })
      .select('customerName policyNumber type endDate')
      .sort({ endDate: 1 })
      .limit(10)
      .lean(),

    // 4. Total premium
    Customer.aggregate([
      { $match: { agentId: new (await import('mongoose')).Types.ObjectId(agentId) } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$premiumAmount' } } } },
    ]),

    // 5. Recent 5 customers
    Customer.find({ agentId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  // Shape typeCounts array → object { motor: 3, medical: 1, ... }
  const typeCountMap: Record<string, number> = {
    motor: 0,
    medical: 0,
    fire: 0,
    life: 0,
    'personal-accident': 0,
    marine: 0,
    'workman-compensation': 0,
    travel: 0,
  };
  for (const row of typeCounts) {
    typeCountMap[row._id] = row.count;
  }

  const totalPremium = premiumAgg[0]?.total ?? 0;

  return NextResponse.json({
    total,
    typeCounts: typeCountMap,
    expiring: expiringDocs,
    totalPremium,
    recent: recentDocs,
  });
}
