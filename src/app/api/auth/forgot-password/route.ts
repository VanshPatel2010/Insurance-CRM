import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Agent from '@/models/Agent';
import { sendPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.trim().toLowerCase();
    
    if (process.env.UPSTASH_REDIS_REST_URL) {
      const { loginRateLimit } = await import('@/lib/rateLimit');
      
      const { success } = await loginRateLimit.limit(`reset_${email || 'unknown'}`);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        );
      }
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    await connectDB();

    const agent = await Agent.findOne({ email });

    if (agent) {
      const resetPasswordToken = crypto.randomUUID();
      const resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

      agent.resetPasswordToken = resetPasswordToken;
      agent.resetPasswordExpires = resetPasswordExpires;
      await agent.save();

      await sendPasswordResetEmail(agent.email, resetPasswordToken, request);
    }

    return NextResponse.json({
      message: 'If an account exists with that email, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}
