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
    if (!form.password)           e.password        = 'Password is required.';
    else if (form.password.length < 8)
                                   e.password        = 'Password must be at least 8 characters.';
    if (!form.confirmPassword)    e.confirmPassword = 'Please confirm your password.';
    else if (form.password !== form.confirmPassword)
                                   e.confirmPassword = 'Passwords do not match.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!token) {
      setApiError('Invalid or missing reset token. Please request a new reset link.');
      return;
    }

    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

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

  function EyeToggle({ visible }) {
    return visible ? (
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
    );
  }

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

        <h1 className="auth-heading">Reset Password</h1>
        <p className="auth-subheading">Create a new strong password</p>

        {apiError && (
          <div className="auth-banner auth-banner-error">
            <span>⚠</span> {apiError}
          </div>
        )}

        {success && (
          <div className="auth-banner auth-banner-success">
            <span>✓</span> Password has been reset successfully! You can now{' '}
            <Link href="/login" className="auth-link">log in</Link>.
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} noValidate className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="password">
                New Password <span className="required">*</span>
              </label>
              <div className="auth-password-wrapper">
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
                  type="button" className="auth-eye-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1} aria-label="Toggle password visibility"
                >
                  <EyeToggle visible={showPassword} />
                </button>
              </div>
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">
                Confirm Password <span className="required">*</span>
              </label>
              <div className="auth-password-wrapper">
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
                  type="button" className="auth-eye-btn"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  tabIndex={-1} aria-label="Toggle confirm password visibility"
                >
                  <EyeToggle visible={showConfirmPassword} />
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
                </>
              ) : 'Reset Password'}
            </button>
          </form>
        )}

        <p className="auth-footer">
          <Link href="/login" className="auth-link">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
