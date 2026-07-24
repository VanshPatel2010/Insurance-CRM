'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordContent() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      setSuccess('Check your email for a reset link. It will expire in 1 hour.');
    } catch (err) {
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <div style={styles.logoIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <div style={styles.logoTitle}>InsureCRM</div>
            <div style={styles.logoSub}>Agent Management System</div>
          </div>
        </div>

        <h1 style={styles.heading}>Forgot Password</h1>
        <p style={styles.subheading}>Enter your email to receive a reset link</p>

        {error && (
          <div style={styles.errorBanner}>
            <span>⚠</span> {error}
          </div>
        )}

        {success && (
          <div style={{...styles.errorBanner, background: '#e4f5ec', border: '1px solid #a7e3be', color: '#1a7d3e'}}>
            <span>✓</span> {success}
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email Address <span className="required">*</span>
              </label>
              <input
                id="email" type="email"
                className={`form-control ${error ? 'error' : ''}`}
                placeholder="ravi@agency.co"
                value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }}
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: 8, opacity: loading ? 0.75 : 1 }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ animation: 'spin 0.75s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Sending…
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </>
              ) : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p style={styles.footer}>
          Remember your password?{' '}
          <Link href="/login" style={styles.link}>Back to Login</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a3660 0%, #0F4C81 50%, #1a5c9a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: '40px 40px 32px',
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
  },
  logoRow: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28,
  },
  logoIcon: {
    width: 44, height: 44, borderRadius: 12,
    background: 'linear-gradient(135deg, #0F4C81, #1a5c9a)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(15,76,129,0.35)',
  },
  logoTitle: { fontSize: 16, fontWeight: 800, color: '#1a202c', letterSpacing: '-0.3px' },
  logoSub:   { fontSize: 11, color: '#718096', fontWeight: 500, marginTop: 1 },
  heading:   { fontSize: 24, fontWeight: 800, color: '#1a202c', letterSpacing: '-0.5px', marginBottom: 4 },
  subheading:{ fontSize: 13.5, color: '#718096', marginBottom: 24 },
  errorBanner: {
    background: '#fde8e6', border: '1px solid #f7b8b8', color: '#c0392b',
    borderRadius: 8, padding: '12px 14px', fontSize: 13.5, fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
  },
  footer: { textAlign: 'center', fontSize: 13.5, color: '#718096', marginTop: 24 },
  link:   { color: '#0F4C81', fontWeight: 700, textDecoration: 'underline' },
};
