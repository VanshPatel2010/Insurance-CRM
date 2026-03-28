import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { connectDB } from '@/lib/mongodb';
import Customer from '@/models/Customer';

type Params = { params: Promise<{ id: string }> };

// ── GET /api/customers/[id] ────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const customer = await Customer.findOne({
    _id: id,
    agentId: session.user.id,
  }).lean();

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  return NextResponse.json(customer);
}

// ── PUT /api/customers/[id] ────────────────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const customer = await Customer.findOne({
    _id: id,
    agentId: session.user.id,
  });

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const body = await req.json();

  const {
    type, customerName, phone, email, address, policyNumber,
    premiumAmount, sumInsured, startDate, endDate,
    /* eslint-disable @typescript-eslint/no-unused-vars */
    _id: _i, agentId: _a, createdAt: _c,
    /* eslint-enable */
    ...rest
  } = body;

  // Check for duplicate policyNumber on update (allow same record)
  if (policyNumber && policyNumber !== customer.policyNumber) {
    const duplicate = await Customer.findOne({
      agentId: session.user.id,
      policyNumber,
      _id: { $ne: id },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: `Policy number "${policyNumber}" already exists.` },
        { status: 409 }
      );
    }
  }

  Object.assign(customer, {
    ...(type          && { type }),
    ...(customerName  && { customerName }),
    ...(phone         && { phone }),
    email:         email         ?? customer.email,
    address:       address       ?? customer.address,
    ...(policyNumber  && { policyNumber }),
    ...(premiumAmount && { premiumAmount }),
    sumInsured:    sumInsured    ?? customer.sumInsured,
    ...(startDate     && { startDate }),
    ...(endDate       && { endDate }),
    details: { ...customer.details, ...rest },
    updatedAt: new Date(),
  });

  await customer.save();
  return NextResponse.json(customer);
}

// ── DELETE /api/customers/[id] ─────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const deleted = await Customer.findOneAndDelete({
    _id: id,
    agentId: session.user.id,
  });

  if (!deleted) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  return NextResponse.json({ message: 'Customer deleted successfully' });
}
