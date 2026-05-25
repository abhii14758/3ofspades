import { Resend } from 'resend';

const FROM = process.env.RESEND_FROM || 'noreply@example.com';
const BASE_URL = process.env.NEXTAUTH_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';

export async function sendPasswordResetEmail(toEmail: string, rawToken: string): Promise<void> {
  const resetUrl = `${BASE_URL}/reset-password/${rawToken}`;

  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL DEV] Password reset link for ${toEmail}:\n${resetUrl}`);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: '3 of Spades — Reset your password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#7c3aed">3 of Spades ♠</h2>
        <p>Click the link below to reset your password. The link expires in 1 hour.</p>
        <p><a href="${resetUrl}" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Reset Password</a></p>
        <p style="color:#666;font-size:12px">If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}
