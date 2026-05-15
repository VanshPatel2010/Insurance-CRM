import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import Agent from '@/models/Agent';
import { loginRateLimit } from '@/lib/rateLimit';

async function enforceFailedLoginLimit(email) {
  if (!process.env.UPSTASH_REDIS_REST_URL) return;

  try {
    const { success } = await loginRateLimit.limit(`login_${email}`);
    if (!success) {
      throw new Error('Too many login attempts. Please wait 5 minutes.');
    }
  } catch (error) {
    if (error.message === 'Too many login attempts. Please wait 5 minutes.') {
      throw error;
    }

    console.warn('[Login Rate Limit Error]', error);
  }
}

/** @type {import('next-auth').NextAuthOptions} */
export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },

      async authorize(credentials, req) {
        const { email, password } = credentials ?? {};

        if (!email || !password) return null;
        const normalizedEmail = email.trim().toLowerCase();

        await connectDB();

        const agent = await Agent.findOne({ email: normalizedEmail }).select('+password');
        if (!agent) {
          await enforceFailedLoginLimit(normalizedEmail);
          return null;
        }

        const isMatch = await bcrypt.compare(password, agent.password);
        if (!isMatch) {
          await enforceFailedLoginLimit(normalizedEmail);
          return null;
        }

        if (!agent.isVerified) {
          throw new Error('Please verify your email address to log in.');
        }

        return {
          id:         agent._id.toString(),
          name:       agent.name,
          email:      agent.email,
          agencyName: agent.agencyName,
          isAdmin:    agent.isAdmin,
        };
      },
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id         = user.id;
        token.agencyName = user.agencyName;
        token.isAdmin    = user.isAdmin;
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id         = token.id;
        session.user.isAdmin    = token.isAdmin;
        session.user.agencyName = token.agencyName;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      return `${baseUrl}/dashboard`;
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },

  secret: process.env.NEXTAUTH_SECRET,
};
