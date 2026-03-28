'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const router = useRouter();

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
        setApiError('Invalid email or password. Please try again.');
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
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
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

        <h1 style={styles.heading}>Welcome back</h1>
        <p style={styles.subheading}>Sign in to your agent account</p>

        {/* API Error */}
        {apiError && (
          <div style={styles.errorBanner}>
            <span>⚠</span> {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

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
            <div style={styles.passwordWrapper}>
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
                type="button" style={styles.eyeBtn}
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
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </>
            ) : 'Sign In'}
          </button>
        </form>

        {/* Signup link */}
        <p style={styles.footer}>
          Don&apos;t have an account?{' '}
          <Link href="/signup" style={styles.link}>Sign up</Link>
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
  passwordWrapper: { position: 'relative' },
  eyeBtn: {
    position: 'absolute', right: 12, top: '50%',
    transform: 'translateY(-50%)',
    background: 'none', border: 'none', padding: 0,
    color: '#718096', cursor: 'pointer',
    display: 'flex', alignItems: 'center',
  },
  errorBanner: {
    background: '#fde8e6', border: '1px solid #f7b8b8', color: '#c0392b',
    borderRadius: 8, padding: '12px 14px', fontSize: 13.5, fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
  },
  footer: { textAlign: 'center', fontSize: 13.5, color: '#718096', marginTop: 24 },
  link:   { color: '#0F4C81', fontWeight: 700, textDecoration: 'underline' },
};
