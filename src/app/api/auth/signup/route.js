import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import Agent from '@/models/Agent';
import { sendVerificationEmail } from '@/lib/email';

/**
 * Rate limit signup attempts to prevent account spam.
 * Uses IP address as the key; falls back gracefully if Redis is unavailable.
 */
async function enforceSignupRateLimit(request) {
  if (!process.env.UPSTASH_REDIS_REST_URL) return;
  try {
    const { loginRateLimit } = await import('@/lib/rateLimit');
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const { success } = await loginRateLimit.limit(`signup_${ip}`);
    if (!success) {
      throw Object.assign(new Error('Too many signup attempts. Please wait before trying again.'), { status: 429 });
    }
  } catch (err) {
    if (err.status === 429) throw err;
    console.warn('[Signup Rate Limit Error]', err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, password, agencyName, phone } = body;

    // ── 1. Validate required fields ─────────────────────────────────────────
    if (!name || !email || !password || !agencyName || !phone) {
      return NextResponse.json(
        { success: false, message: 'All fields (name, email, password, agencyName, phone) are required.' },
        { status: 400 }
      );
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    // ── 2. Rate limit signup attempts ──────────────────────────────────────
    await enforceSignupRateLimit(request);

    // ── 3. Connect to MongoDB ────────────────────────────────────────────────
    await connectDB();

    // ── 4. Check for duplicate email ─────────────────────────────────────────
    const existingAgent = await Agent.findOne({ email: email.toLowerCase() });
    if (existingAgent) {
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    // ── 5. Hash the password ─────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 12);

    // ── 6. Create the agent record ───────────────────────────────────────────
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    const agent = await Agent.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      agencyName: agencyName.trim(),
      phone: phone.trim(),
      licenseNumber: body.licenseNumber?.trim() || null,
      verificationToken,
      verificationTokenExpires,
    });

    // ── 7. Send verification email ───────────────────────────────────────────
    await sendVerificationEmail(agent.email, verificationToken, request);

    // ── 8. Return success (never expose the hashed password) ─────────────────
    return NextResponse.json(
      {
        success: true,
        message: 'Account created successfully. Please check your email to verify your account.',
        agent: {
          id: agent._id,
          name: agent.name,
          email: agent.email,
          agencyName: agent.agencyName,
          phone: agent.phone,
          createdAt: agent.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // Rate limit exceeded
    if (error.status === 429) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 429 }
      );
    }

    // Mongoose duplicate-key error (race condition fallback)
    if (error.code === 11000) {
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    // Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return NextResponse.json(
        { success: false, message: messages.join(', ') },
        { status: 400 }
      );
    }

    console.error('[Signup Error]', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error. Please try again later.' },
      { status: 500 }
    );
  }
}

