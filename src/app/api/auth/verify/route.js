import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Agent from '@/models/Agent';
import { getAppBaseUrl } from '@/lib/email';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Verification token is required.' },
        { status: 400 }
      );
    }

    await connectDB();

    // Find agent with valid token that has not expired
    const agent = await Agent.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired verification token.' },
        { status: 400 }
      );
    }

    // Update agent to be verified and clear the token
    agent.isVerified = true;
    agent.verificationToken = null;
    agent.verificationTokenExpires = null;
    await agent.save();

    // Redirect to login page with a success message
    const baseUrl = getAppBaseUrl(request);
    return NextResponse.redirect(`${baseUrl}/login?verified=true`);
  } catch (error) {
    console.error('[Verify Email Error]', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error.' },
      { status: 500 }
    );
  }
}
