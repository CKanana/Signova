import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../config/env.js";

/**
 * Email delivery for Signova (new-staff welcome + password reset).
 *
 * Uses Gmail SMTP via Nodemailer. Credentials come exclusively from
 * environment variables (SMTP_USER + SMTP_APP_PASSWORD — a Gmail App
 * Password, never the account password). Nothing here is hardcoded, logged,
 * or exposed to the frontend.
 *
 * The transport is created lazily and can be replaced wholesale in tests via
 * `setMailTransport` so automated tests never touch real SMTP.
 */

interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let transporter: Transporter | null = null;
let overrideTransport: Transporter | null = null;

/** Test hook: inject a mock transport (e.g. nodemailer's jsonTransport). */
export function setMailTransport(t: Transporter | null): void {
  overrideTransport = t;
}

/** True when SMTP credentials are configured. */
export function isMailConfigured(): boolean {
  return Boolean(config.smtp.user && config.smtp.appPassword);
}

function getTransport(): Transporter {
  if (overrideTransport) return overrideTransport;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: false, // STARTTLS on 587
    auth: { user: config.smtp.user, pass: config.smtp.appPassword },
  });
  return transporter;
}

/**
 * Send a message. Returns true on success.
 *
 * On failure the error is logged WITHOUT the recipient's address or message
 * body (to avoid leaking PII/tokens into logs) and false is returned so the
 * caller can respond safely. Never throws — a mail outage must not crash
 * the request path.
 */
export async function sendMail(message: MailMessage): Promise<boolean> {
  // A test-injected transport bypasses the SMTP-config gate entirely.
  if (!overrideTransport && !isMailConfigured()) {
    // eslint-disable-next-line no-console
    console.error("[mail] SMTP is not configured; skipping email delivery");
    return false;
  }
  try {
    await getTransport().sendMail({
      from: config.smtp.user,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return true;
  } catch (err) {
    // Redacted: no recipient, no token, no credentials.
    // eslint-disable-next-line no-console
    console.error("[mail] delivery failed:", (err as Error).message);
    return false;
  }
}

/** Build the password-reset email body (plain + HTML). */
export function buildResetEmail(resetUrl: string): { subject: string; text: string; html: string } {
  const subject = "Reset your Signova password";
  const text = [
    "We received a request to reset your Signova password.",
    "",
    `Reset your password: ${resetUrl}`,
    "",
    "This link expires in 15 minutes.",
    "If you did not request a password reset, you can safely ignore this email.",
    "",
    "Signova support will never ask you to share your password or reset link.",
  ].join("\n");
  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#241f27">
  <h2 style="color:#5B2A86">Reset your Signova password</h2>
  <p>We received a request to reset your Signova password.</p>
  <p>
    <a href="${resetUrl}"
       style="display:inline-block;background:#5B2A86;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:bold">
      Reset password
    </a>
  </p>
  <p style="font-size:13px;color:#68636b">
    This link expires in 15 minutes. If you did not request a password reset,
    you can safely ignore this email.
  </p>
  <p style="font-size:13px;color:#68636b">
    Signova support will never ask you to share your password or reset link.
  </p>
</div>`.trim();
  return { subject, text, html };
}

/** Sign-in URL shown in the welcome email (trusted, from env). */
function signInUrl(): string {
  return config.passwordResetBaseUrl;
}

/**
 * Build the new-staff welcome email (plain + HTML).
 *
 * Sent when a staff member self-registers. It confirms the account was
 * created and points them to sign in — it contains NO password and NO token
 * (2FA enrollment happens in the browser after the first sign-in).
 */
export function buildWelcomeEmail(name: string): { subject: string; text: string; html: string } {
  const firstName = name.trim().split(" ")[0] || "there";
  const url = signInUrl();
  const subject = "Welcome to Signova";
  const text = [
    `Hi ${firstName},`,
    "",
    "Your Signova staff account has been created. Welcome aboard.",
    "",
    "Sign in to your workspace to get started:",
    url,
    "",
    "On your first sign-in you'll set up two-factor authentication with an",
    "authenticator app — this keeps your account secure.",
    "",
    "Signova support will never ask you to share your password.",
  ].join("\n");
  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#241f27">
  <h2 style="color:#5B2A86">Welcome to Signova</h2>
  <p>Hi ${firstName},</p>
  <p>Your Signova staff account has been created. Welcome aboard.</p>
  <p>
    <a href="${url}"
       style="display:inline-block;background:#5B2A86;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:bold">
      Sign in to your workspace
    </a>
  </p>
  <p style="font-size:13px;color:#68636b">
    On your first sign-in you&apos;ll set up two-factor authentication with an
    authenticator app — this keeps your account secure.
  </p>
  <p style="font-size:13px;color:#68636b">
    Signova support will never ask you to share your password.
  </p>
</div>`.trim();
  return { subject, text, html };
}
