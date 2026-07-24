'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((err) => { const x = { ...err }; delete x[field]; return x; });
    setApiError('');
  };

  function validate() {
    const e = {};
    if (!form.password) e.password = 'Password is required.';
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    
    if (form.password !== form.confirmPassword) {
      e.confirmPassword = 'Passwords do not match.';
    }
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    if (!token) {
      setApiError('Invalid or missing reset token.');
      return;
    }

    setLoading(true);
    setApiError('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: form.password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      setSuccess(true);
    } catch (err) {
      setApiError(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

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

        <h1 style={styles.heading}>Reset Password</h1>
        <p style={styles.subheading}>Create a new strong password</p>

        {apiError && (
          <div style={styles.errorBanner}>
            <span>⚠</span> {apiError}
          </div>
        )}

        {success && (
          <div style={{...styles.errorBanner, background: '#e4f5ec', border: '1px solid #a7e3be', color: '#1a7d3e'}}>
            <span>✓</span> Password has been reset successfully! You can now log in.
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="password">
                New Password <span className="required">*</span>
              </label>
              <div style={styles.passwordWrapper}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-control ${errors.password ? 'error' : ''}`}
                  style={{ paddingRight: 40 }}
                  placeholder="Enter new password"
                  value={form.password} onChange={update('password')}
                  disabled={loading}
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

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">
                Confirm Password <span className="required">*</span>
              </label>
              <div style={styles.passwordWrapper}>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`form-control ${errors.confirmPassword ? 'error' : ''}`}
                  style={{ paddingRight: 40 }}
                  placeholder="Confirm new password"
                  value={form.confirmPassword} onChange={update('confirmPassword')}
                  disabled={loading}
                />
                <button
                  type="button" style={styles.eyeBtn}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  tabIndex={-1} aria-label="Toggle password visibility"
                >
                  {showConfirmPassword ? (
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
              {errors.confirmPassword && <span className="form-error">{errors.confirmPassword}</span>}
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
                  Resetting…
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </>
              ) : 'Reset Password'}
            </button>
          </form>
        )}

        <p style={styles.footer}>
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
