import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import Agent from '@/models/Agent';

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

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    // ── 2. Connect to MongoDB ────────────────────────────────────────────────
    await connectDB();

    // ── 3. Check for duplicate email ─────────────────────────────────────────
    const existingAgent = await Agent.findOne({ email: email.toLowerCase() });
    if (existingAgent) {
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    // ── 4. Hash the password ─────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 12);

    // ── 5. Create the agent record ───────────────────────────────────────────
    const agent = await Agent.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      agencyName: agencyName.trim(),
      phone: phone.trim(),
      licenseNumber: body.licenseNumber?.trim() || null,
    });

    // ── 6. Return success (never expose the hashed password) ─────────────────
    return NextResponse.json(
      {
        success: true,
        message: 'Account created successfully.',
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
