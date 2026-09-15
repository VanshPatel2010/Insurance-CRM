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
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo-row">
          <div className="auth-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <div className="auth-logo-title">InsureCRM</div>
            <div className="auth-logo-sub">Agent Management System</div>
          </div>
        </div>

        <h1 className="auth-heading">Forgot Password</h1>
        <p className="auth-subheading">Enter your email to receive a reset link</p>

        {error && (
          <div className="auth-banner auth-banner-error">
            <span>⚠</span> {error}
          </div>
        )}

        {success && (
          <div className="auth-banner auth-banner-success">
            <span>✓</span> {success}
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} noValidate className="auth-form">
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
                </>
              ) : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="auth-footer">
          Remember your password?{' '}
          <Link href="/login" className="auth-link">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
