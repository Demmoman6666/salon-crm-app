// lib/email.ts — transactional email via Resend
import { Resend } from "resend";

// Lazily create the client at call-time, not import-time, so the build (and any
// route that imports this module) doesn't fail when RESEND_API_KEY isn't set.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Email is not configured (RESEND_API_KEY missing).");
  }
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

// Until a custom domain is verified in Resend, use their shared test sender.
// Once fieldcrm.app (or similar) is verified, set EMAIL_FROM in env, e.g.
//   EMAIL_FROM="FieldCRM <noreply@fieldcrm.app>"
const FROM = process.env.EMAIL_FROM || "FieldCRM <onboarding@resend.dev>";

export async function sendInviteEmail(opts: {
  to: string;
  fullName: string;
  companyName: string;
  inviteUrl: string;
}) {
  const { to, fullName, companyName, inviteUrl } = opts;

  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
      <h2 style="color:#0f172a;">You've been invited to ${escapeHtml(companyName)} on FieldCRM</h2>
      <p>Hi ${escapeHtml(fullName || "there")},</p>
      <p>You've been invited to join <strong>${escapeHtml(companyName)}</strong> on FieldCRM. Click the button below to set your password and get started.</p>
      <p style="margin: 28px 0;">
        <a href="${inviteUrl}" style="background:#2563eb; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">
          Accept invitation
        </a>
      </p>
      <p style="color:#64748b; font-size:14px;">This link expires in 7 days. If you weren't expecting this, you can ignore this email.</p>
      <p style="color:#94a3b8; font-size:12px; margin-top:24px;">If the button doesn't work, paste this link into your browser:<br>${inviteUrl}</p>
    </div>
  `;

  const result = await getResend().emails.send({
    from: FROM,
    to,
    subject: `You're invited to ${companyName} on FieldCRM`,
    html,
  });

  if (result.error) {
    throw new Error(`Email send failed: ${result.error.message || "unknown"}`);
  }
  return result;
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  fullName?: string | null;
  resetUrl: string;
}) {
  const { to, fullName, resetUrl } = opts;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
      <h2 style="color:#0f172a;">Reset your FieldCRM password</h2>
      <p>Hi ${escapeHtml(fullName || "there")},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one.</p>
      <p style="margin: 28px 0;">
        <a href="${resetUrl}" style="background:#2563eb; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">
          Reset password
        </a>
      </p>
      <p style="color:#64748b; font-size:14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      <p style="color:#94a3b8; font-size:12px; margin-top:24px;">If the button doesn't work, paste this link into your browser:<br>${resetUrl}</p>
    </div>
  `;
  const result = await getResend().emails.send({
    from: FROM,
    to,
    subject: "Reset your FieldCRM password",
    html,
  });
  if (result.error) throw new Error(`Email send failed: ${result.error.message || "unknown"}`);
  return result;
}
