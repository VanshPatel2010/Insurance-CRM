import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Agent from '@/models/Agent';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    await connectDB();

    const agent = await Agent.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Password reset token is invalid or has expired.' },
        { status: 400 }
      );
    }

    const salt = await bcrypt.genSalt(10);
    agent.password = await bcrypt.hash(password, salt);
    agent.resetPasswordToken = null;
    agent.resetPasswordExpires = null;

    await agent.save();

    return NextResponse.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}
