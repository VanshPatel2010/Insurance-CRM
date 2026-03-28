// next-auth.d.ts — extends the built-in NextAuth session/user types to include
// the custom `id` and `agencyName` fields set in the JWT + session callbacks.
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      agencyName?: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    agencyName?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    agencyName?: string;
  }
}
