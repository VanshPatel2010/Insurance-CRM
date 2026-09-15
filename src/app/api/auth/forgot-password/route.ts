import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Agent from '@/models/Agent';
import { sendPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.trim().toLowerCase();

    // ── 1. Validate email FIRST (before rate limiter so the key is never 'unknown') ──
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }

    // ── 2. Rate limit per validated email address ────────────────────────────────
    if (process.env.UPSTASH_REDIS_REST_URL) {
      const { loginRateLimit } = await import('@/lib/rateLimit');

      const { success } = await loginRateLimit.limit(`reset_${email}`);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        );
      }
    }

    await connectDB();

    const agent = await Agent.findOne({ email });

    if (agent) {
      // Use randomBytes(32) for higher entropy (256-bit) vs randomUUID() (122-bit)
      const resetPasswordToken = crypto.randomBytes(32).toString('hex');
      const resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

      agent.resetPasswordToken = resetPasswordToken;
      agent.resetPasswordExpires = resetPasswordExpires;
      await agent.save();

      await sendPasswordResetEmail(agent.email, resetPasswordToken, request);
    }

    // Always return the same message to prevent email enumeration
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
