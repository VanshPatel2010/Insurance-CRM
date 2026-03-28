import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import Agent from '@/models/Agent';

/** @type {import('next-auth').NextAuthOptions} */
export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },

      async authorize(credentials) {
        const { email, password } = credentials ?? {};

        if (!email || !password) return null;

        await connectDB();

        const agent = await Agent.findOne({ email: email.toLowerCase() }).select('+password');
        if (!agent) return null;

        const isMatch = await bcrypt.compare(password, agent.password);
        if (!isMatch) return null;

        return {
          id:         agent._id.toString(),
          name:       agent.name,
          email:      agent.email,
          agencyName: agent.agencyName,
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
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id         = token.id;
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
