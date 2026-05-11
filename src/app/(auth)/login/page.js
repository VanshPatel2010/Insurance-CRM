import { Suspense } from 'react';
import LoginContent from './LoginContent';

// page.js is a Server Component — Suspense here is the correct Next.js App Router
// pattern for client components that use useSearchParams(), preventing hydration mismatches.
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a3660 0%, #0F4C81 50%, #1a5c9a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ color: '#fff', fontSize: 14, opacity: 0.8 }}>Loading…</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
