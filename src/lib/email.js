import nodemailer from 'nodemailer';

export function getAppBaseUrl(request) {
  // 1. Explicit production domain — highest priority, always correct.
  //    Set APP_URL (or NEXT_PUBLIC_APP_URL) in your hosting platform env vars.
  const explicitUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL;

  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, '');
  }

  // 2. Vercel automatic deployment URL
  const vercelUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  // 3. Derive from the incoming request headers (works on most platforms)
  if (request) {
    const forwardedHost = request.headers?.get?.('x-forwarded-host');
    const host = forwardedHost || request.headers?.get?.('host');
    const proto = request.headers?.get?.('x-forwarded-proto') || 'https';
    const origin = request.headers?.get?.('origin');

    if (origin) return origin.replace(/\/$/, '');
    if (host) return `${proto}://${host}`.replace(/\/$/, '');
  }

  // 4. Last resort: NEXTAUTH_URL then hardcoded localhost
  const fallback = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  if (process.env.NODE_ENV === 'production' && fallback.includes('localhost')) {
    console.error(
      '[Email] ⚠️  getAppBaseUrl() is falling back to localhost in PRODUCTION. ' +
      'Set the APP_URL environment variable to your production domain!'
    );
  }

  return fallback.replace(/\/$/, '');
}

export async function sendVerificationEmail(email, token, request) {
  // Try to use provided SMTP settings or fallback to a dummy/console transport
  // for development if SMTP is not configured.
  const transportConfig = process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }
    : {
        host: 'localhost',
        port: 1025,
        ignoreTLS: true,
      };

  const transporter = nodemailer.createTransport(transportConfig);
  
  const baseUrl = getAppBaseUrl(request);
  const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Insurance Tracker" <noreply@insurancetracker.com>',
    to: email,
    subject: 'Verify your email address',
    html: `
      <h2>Welcome to Insurance Tracker!</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background-color:#007bff;color:#fff;text-decoration:none;border-radius:5px;">Verify Email</a>
      <p>Or copy and paste this link into your browser:</p>
      <p>${verifyUrl}</p>
      <p>This link will expire in 24 hours.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[Email] Verification email sent to:', email, info.messageId || '');
    if (!process.env.SMTP_HOST) {
       console.log('[Email] Verification URL (Dev Mode):', verifyUrl);
    }
  } catch (error) {
    console.error('[Email] Failed to send verification email:', error);
    // You might want to throw the error if you want signup to fail when email fails,
    // but typically it's better to just log it so the user can still be created 
    // and they can request a new verification email later.
  }
}

export async function sendPasswordResetEmail(email, token, request) {
  const transportConfig = process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }
    : {
        host: 'localhost',
        port: 1025,
        ignoreTLS: true,
      };

  const transporter = nodemailer.createTransport(transportConfig);
  
  const baseUrl = getAppBaseUrl(request);
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Insurance Tracker" <noreply@insurancetracker.com>',
    to: email,
    subject: 'Reset your password',
    html: `
      <h2>Reset Password</h2>
      <p>You requested a password reset. Please click the link below to set a new password:</p>
      <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background-color:#007bff;color:#fff;text-decoration:none;border-radius:5px;">Reset Password</a>
      <p>Or copy and paste this link into your browser:</p>
      <p>${resetUrl}</p>
      <p>This link will expire in 1 hour. If you did not request this, please ignore this email.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[Email] Password reset email sent to:', email, info.messageId || '');
    if (!process.env.SMTP_HOST) {
       console.log('[Email] Password reset URL (Dev Mode):', resetUrl);
    }
  } catch (error) {
    console.error('[Email] Failed to send password reset email:', error);
  }
}
