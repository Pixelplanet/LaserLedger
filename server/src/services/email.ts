import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config.js';

let cachedTransporter: Transporter | null = null;

export function isEmailTransportConfigured(): boolean {
  return Boolean(env.SMTP_HOST);
}

export function emailTransportStatus(): { configured: boolean; host: string | null; port: number | null } {
  return {
    configured: isEmailTransportConfigured(),
    host: env.SMTP_HOST || null,
    port: env.SMTP_HOST ? env.SMTP_PORT : null,
  };
}

function getTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  if (!isEmailTransportConfigured()) return null;
  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return cachedTransporter;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    // Dev/test mode: console-only logging
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.info(`[email:stub] To: ${msg.to} | Subject: ${msg.subject}\n${msg.text}`);
    }
    return;
  }
  await transporter.sendMail({
    from: env.SMTP_FROM,
    replyTo: 'support@lasertools.org',
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
  });
}

// ─── Templates ─────────────────────────────────────────────────────────────
const layout = (title: string, body: string): string => `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family:Inter,system-ui,sans-serif;background:#0d0d1a;color:#e2e8f0;padding:24px;">
  <div style="max-width:560px;margin:auto;background:#14142b;border-radius:12px;padding:32px;">
    <h1 style="color:#a855f7;margin-top:0">${escapeHtml(title)}</h1>
    ${body}
    <hr style="border:none;border-top:1px solid #2a2a4a;margin:24px 0">
    <p style="font-size:12px;color:#94a3b8">LaserLedger · lasertools.org</p>
  </div>
</body></html>`;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function emailVerificationMessage(to: string, link: string): EmailMessage {
  return {
    to,
    subject: 'Verify your LaserLedger email',
    html: layout(
      'Verify your email',
      `<p>Welcome to LaserLedger! Please verify your email by clicking the link below (valid for 24 hours):</p>
       <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#a855f7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Verify email</a></p>
       <p style="font-size:12px;color:#94a3b8">If the button doesn't work: ${escapeHtml(link)}</p>`,
    ),
    text: `Welcome to LaserLedger! Verify your email (24h): ${link}`,
  };
}

export function passwordResetMessage(to: string, link: string): EmailMessage {
  return {
    to,
    subject: 'Reset your LaserLedger password',
    html: layout(
      'Reset your password',
      `<p>Click the link below to reset your password (valid for 1 hour):</p>
       <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#a855f7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Reset password</a></p>
       <p style="font-size:12px;color:#94a3b8">If you didn't request this, ignore this email.</p>`,
    ),
    text: `Reset your password (1h): ${link}`,
  };
}

export function welcomeMessage(to: string, displayName: string): EmailMessage {
  return {
    to,
    subject: 'Welcome to LaserLedger',
    html: layout(
      `Welcome, ${displayName}!`,
      `<p>Your email is verified. Start exploring the community-submitted laser settings or share your own.</p>
       <p><a href="${escapeHtml(env.APP_BASE_URL)}/search" style="color:#06b6d4">Browse settings →</a></p>`,
    ),
    text: `Welcome to LaserLedger, ${displayName}! Browse: ${env.APP_BASE_URL}/search`,
  };
}

export function submissionApprovedMessage(to: string, title: string, link: string): EmailMessage {
  return {
    to,
    subject: 'Your LaserLedger submission was approved',
    html: layout(
      'Submission approved',
      `<p>Your setting <strong>${escapeHtml(title)}</strong> is now published.</p>
       <p><a href="${escapeHtml(link)}" style="color:#06b6d4">View it here →</a></p>`,
    ),
    text: `Your setting "${title}" was approved. View: ${link}`,
  };
}

export function submissionRejectedMessage(
  to: string,
  title: string,
  reason: string,
  link: string,
): EmailMessage {
  return {
    to,
    subject: 'Your LaserLedger submission needs changes',
    html: layout(
      'Submission needs changes',
      `<p>Your setting <strong>${escapeHtml(title)}</strong> was not approved.</p>
       <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
       <p><a href="${escapeHtml(link)}" style="color:#06b6d4">Edit & resubmit →</a></p>`,
    ),
    text: `Your setting "${title}" was rejected: ${reason}\nEdit: ${link}`,
  };
}

export function imageRejectedMessage(
  to: string,
  filename: string,
  reason: string,
): EmailMessage {
  return {
    to,
    subject: 'An image you uploaded was rejected',
    html: layout(
      'Image rejected',
      `<p>Your image <strong>${escapeHtml(filename)}</strong> was not approved.</p>
       <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
       <p>You can re-upload a different image to your setting.</p>`,
    ),
    text: `Image "${filename}" rejected: ${reason}`,
  };
}

export function moderatorDigestMessage(
  to: string,
  pending: { settings: number; images: number; reports: number },
): EmailMessage {
  const lines = [
    `Pending settings:    ${pending.settings}`,
    `Pending images:      ${pending.images}`,
    `Pending reports:     ${pending.reports}`,
  ];
  return {
    to,
    subject: `Moderator digest — ${pending.settings + pending.images + pending.reports} items pending`,
    html: layout(
      'Moderation queue update',
      `<pre style="font-family:ui-monospace,monospace;background:#0d0d1a;padding:16px;border-radius:8px;color:#e2e8f0">${lines.map(escapeHtml).join('\n')}</pre>
       <p><a href="${escapeHtml(env.APP_BASE_URL)}/mod/queue" style="color:#06b6d4">Open queue →</a></p>`,
    ),
    text: lines.join('\n') + `\n\nQueue: ${env.APP_BASE_URL}/mod/queue`,
  };
}

export function accountLinkedMessage(to: string): EmailMessage {
  return {
    to,
    subject: 'Cloudify 3D account linked',
    html: layout(
      'Account linked',
      `<p>Your Cloudify 3D account has been linked to your LaserLedger account.</p>`,
    ),
    text: 'Your Cloudify 3D account has been linked to your LaserLedger account.',
  };
}
