import nodemailer from 'nodemailer';

export async function sendVerificationEmail(email, token) {
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
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
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
