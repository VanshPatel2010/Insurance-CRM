'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px', padding: '20px' }}>
      <div style={{ 
        backgroundColor: 'var(--surface)', 
        border: '1px solid var(--border)', 
        borderRadius: 'var(--radius)', 
        padding: '30px', 
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%'
      }}>
        <div style={{ fontSize: '40px', marginBottom: '15px' }}>🚨</div>
        <h2 style={{ color: 'var(--text)', marginBottom: '10px' }}>Something went wrong</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '25px', wordBreak: 'break-word' }}>
          {error.message || 'An unexpected error occurred'}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button 
            onClick={() => reset()}
            style={{ 
              backgroundColor: 'var(--primary)', 
              color: 'white', 
              border: 'none', 
              padding: '10px 20px', 
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Try again
          </button>
          <Link 
            href="/dashboard"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              padding: '10px 20px',
              borderRadius: 'var(--radius)',
              textDecoration: 'none',
              fontWeight: 500
            }}
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
