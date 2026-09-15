'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get('verified');

  const [form, setForm]           = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors]       = useState({});
  const [apiError, setApiError]   = useState('');
  const [loading, setLoading]     = useState(false);

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((err) => { const x = { ...err }; delete x[field]; return x; });
    setApiError('');
  };

  function validate() {
    const e = {};
    if (!form.email.trim())    e.email    = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                               e.email    = 'Enter a valid email address.';
    if (!form.password)        e.password = 'Password is required.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    setApiError('');

    try {
      const result = await signIn('credentials', {
        email:    form.email.trim(),
        password: form.password,
        redirect: false,
      });

      if (result?.error) {
        const authMessages = {
          'Please verify your email address to log in.': 'Please verify your email address to log in.',
          'Too many login attempts. Please wait 5 minutes.': 'Too many login attempts. Please wait 5 minutes.',
        };

        setApiError(authMessages[result.error] || 'Invalid email or password. Please try again.');
      } else if (result?.ok) {
        router.push('/dashboard');
      }
    } catch {
      setApiError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
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

        <h1 className="auth-heading">Welcome back</h1>
        <p className="auth-subheading">Sign in to your agent account</p>

        {/* API Error */}
        {apiError && (
          <div className="auth-banner auth-banner-error">
            <span>⚠</span> {apiError}
          </div>
        )}

        {/* Verification Success */}
        {verified === 'true' && !apiError && (
          <div className="auth-banner auth-banner-success">
            <span>✓</span> Email verified successfully! You can now log in.
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="auth-form">

          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address <span className="required">*</span>
            </label>
            <input
              id="email" type="email"
              className={`form-control ${errors.email ? 'error' : ''}`}
              placeholder="ravi@agency.co"
              value={form.email} onChange={update('email')}
              disabled={loading}
              autoComplete="email"
            />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password <span className="required">*</span>
            </label>
            <div className="auth-password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={`form-control ${errors.password ? 'error' : ''}`}
                style={{ paddingRight: 40 }}
                placeholder="Enter your password"
                value={form.password} onChange={update('password')}
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button" className="auth-eye-btn"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1} aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>

          <div className="auth-forgot-link">
            <Link href="/forgot-password" className="auth-link">Forgot password?</Link>
          </div>

          {/* Submit */}
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
                Signing in…
              </>
            ) : 'Sign In'}
          </button>
        </form>

        {/* Signup link */}
        <p className="auth-footer">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="auth-link">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
