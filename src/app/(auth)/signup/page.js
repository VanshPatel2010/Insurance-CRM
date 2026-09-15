'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    agencyName: '', phone: '',
  });
  const [showPassword, setShowPassword]        = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors]   = useState({});
  const [apiError, setApiError]   = useState('');
  const [success, setSuccess]     = useState('');
  const [loading, setLoading]     = useState(false);

  // ── Field update helper ────────────────────────────────────────────────────
  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((err) => { const x = { ...err }; delete x[field]; return x; });
    setApiError('');
  };

  // ── Client-side validation ─────────────────────────────────────────────────
  function validate() {
    const e = {};
    if (!form.name.trim())         e.name        = 'Full name is required.';
    if (!form.email.trim())        e.email       = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                   e.email       = 'Enter a valid email address.';
    if (!form.password)            e.password    = 'Password is required.';
    else if (form.password.length < 8)
                                   e.password    = 'Password must be at least 8 characters.';
    if (!form.confirmPassword)     e.confirmPassword = 'Please confirm your password.';
    else if (form.password !== form.confirmPassword)
                                   e.confirmPassword = 'Passwords do not match.';
    if (!form.agencyName.trim())   e.agencyName  = 'Agency name is required.';
    if (!form.phone.trim())        e.phone       = 'Phone number is required.';
    return e;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    setApiError('');
    setSuccess('');

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:       form.name.trim(),
          email:      form.email.trim(),
          password:   form.password,
          agencyName: form.agencyName.trim(),
          phone:      form.phone.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setApiError(data.message || 'Something went wrong. Please try again.');
        return;
      }

      setSuccess(data.message || 'Account created successfully! Please check your email to verify your account.');
      setTimeout(() => router.push('/login'), 3000);
    } catch {
      setApiError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Eye toggle icon ─────────────────────────────────────────────────────────
  function EyeIcon({ visible }) {
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
      <div className="auth-card auth-card-wide">
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

        <h1 className="auth-heading">Create your account</h1>
        <p className="auth-subheading">Start managing policies in minutes</p>

        {/* API Success */}
        {success && (
          <div className="auth-banner auth-banner-success">
            <span>✓</span> {success}
          </div>
        )}

        {/* API Error */}
        {apiError && (
          <div className="auth-banner auth-banner-error">
            <span>⚠</span> {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-form-grid">

            {/* Full Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="name">
                Full Name <span className="required">*</span>
              </label>
              <input
                id="name" className={`form-control ${errors.name ? 'error' : ''}`}
                placeholder="Ravi Shah"
                value={form.name} onChange={update('name')}
                disabled={loading}
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email Address <span className="required">*</span>
              </label>
              <input
                id="email" type="email" className={`form-control ${errors.email ? 'error' : ''}`}
                placeholder="ravi@agency.co"
                value={form.email} onChange={update('email')}
                disabled={loading}
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
                  placeholder="Min. 8 characters"
                  value={form.password} onChange={update('password')}
                  disabled={loading}
                />
                <button
                  type="button" className="auth-eye-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1} aria-label="Toggle password visibility"
                >
                  <EyeIcon visible={showPassword} />
                </button>
              </div>
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>

            {/* Confirm Password */}
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
                  placeholder="Re-enter your password"
                  value={form.confirmPassword} onChange={update('confirmPassword')}
                  disabled={loading}
                />
                <button
                  type="button" className="auth-eye-btn"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  tabIndex={-1} aria-label="Toggle confirm password visibility"
                >
                  <EyeIcon visible={showConfirmPassword} />
                </button>
              </div>
              {errors.confirmPassword && <span className="form-error">{errors.confirmPassword}</span>}
            </div>

            {/* Agency Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="agencyName">
                Agency Name <span className="required">*</span>
              </label>
              <input
                id="agencyName" className={`form-control ${errors.agencyName ? 'error' : ''}`}
                placeholder="Shah Insurance Agency"
                value={form.agencyName} onChange={update('agencyName')}
                disabled={loading}
              />
              {errors.agencyName && <span className="form-error">{errors.agencyName}</span>}
            </div>

            {/* Phone */}
            <div className="form-group">
              <label className="form-label" htmlFor="phone">
                Phone Number <span className="required">*</span>
              </label>
              <input
                id="phone" className={`form-control ${errors.phone ? 'error' : ''}`}
                placeholder="9876543210"
                value={form.phone} onChange={update('phone')}
                disabled={loading}
                maxLength={15}
              />
              {errors.phone && <span className="form-error">{errors.phone}</span>}
            </div>

          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 24, opacity: loading ? 0.75 : 1 }}
            disabled={loading || !!success}
          >
            {loading
              ? <><Spinner /> Creating account…</>
              : 'Create Account'
            }
          </button>
        </form>

        {/* Login link */}
        <p className="auth-footer">
          Already have an account?{' '}
          <Link href="/login" className="auth-link">Login</Link>
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ animation: 'spin 0.75s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}
