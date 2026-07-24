import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth?.token;

    if (token && (pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password' || pathname === '/reset-password')) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        if (pathname.startsWith('/dashboard')) return !!token;
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
  ],
};
