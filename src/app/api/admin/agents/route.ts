import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { connectDB } from '@/lib/mongodb';
import Agent from '@/models/Agent';
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';

/**
 * GET /api/admin/agents
 * Fetches all agents with their subscription details
 * Only accessible by admin users
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    await connectDB();

    // Fetch all agents
    const agents = await Agent.find({})
      .select('-password') // Exclude password field
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ agents }, { status: 200 });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/agents
 * Updates agent subscription and account status
 * Only accessible by admin users
 */
export async function PUT(req: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { agentId, subscriptionStatus, subscriptionTier, subscriptionEndDate, isAdmin } = body;

    // Validate required fields
    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Verify agent exists
    const agent = await Agent.findById(new mongoose.Types.ObjectId(agentId));
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Update only provided fields
    if (subscriptionStatus !== undefined) {
      agent.subscriptionStatus = subscriptionStatus;
    }
    if (subscriptionTier !== undefined) {
      agent.subscriptionTier = subscriptionTier;
    }
    if (subscriptionEndDate !== undefined) {
      agent.subscriptionEndDate = subscriptionEndDate ? new Date(subscriptionEndDate) : null;
    }
    if (isAdmin !== undefined) {
      agent.isAdmin = isAdmin;
    }

    // If activating subscription, set start date if not already set
    if (subscriptionStatus === 'active' && !agent.subscriptionStartDate) {
      agent.subscriptionStartDate = new Date();
    }

    await agent.save();

    return NextResponse.json(
      { message: 'Agent updated successfully', agent },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    );
  }
}
