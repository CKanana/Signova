import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../config/env.js";

/** Email delivery for Signova (new-staff welcome + password reset + invitations).
 * Uses Gmail SMTP via Nodemailer. Credentials from env (SMTP_USER + SMTP_APP_PASSWORD).
 * Nothing here is hardcoded, logged, or exposed to the frontend.
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

/** Send a message. Returns true on success. Never throws. */
export async function sendMail(message: MailMessage): Promise<boolean> {
  if (!overrideTransport && !isMailConfigured()) {
    console.error("[mail] SMTP is not configured; skipping email delivery");
    return false;
  }
  try {
    const result = await getTransport().sendMail({
      from: config.smtp.user,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return Boolean(result);
  } catch (err) {
    console.error("[mail] delivery failed:", (err as Error).message);
    return false;
  }
}

/** Build the password-reset email body (plain + HTML).
 * Exported as `buildResetEmail` for `authService.ts`.
 */
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

/** Shared helper: build an absolute invitation/setup URL from the configured
 * admin portal base URL. Never logs or exposes raw tokens.
 */
export function buildInvitationUrl(token: string): string {
  const base = config.appPublicBaseUrl;
  if (!base) {
    throw new Error("APP_PUBLIC_BASE_URL is not configured");
  }
  try {
    const [protocol, host] = base.split("://");
    if (!protocol || !host) {
      throw new Error("APP_PUBLIC_BASE_URL must be an absolute URL with a hostname");
    }
    const url = new URL(`/invite?token=${encodeURIComponent(token)}`, base);
    return url.toString();
  } catch (err) {
    throw new Error(`Invalid APP_PUBLIC_BASE_URL "${config.appPublicBaseUrl}": ${(err as Error).message}`);
  }
}

/** Sign-in URL shown in the welcome email (trusted, from env). */
function signInUrl(): string {
  return config.passwordResetBaseUrl;
}

const SETUP_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Set up your Signova account</title>
</head>
<body style="margin:0;background:#FFF8DC;font-family:Arial,Helvetica,sans-serif;color:#241f27">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF8DC;padding:32px 16px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(40,20,10,0.08)">
          <tr>
            <td style="background:#5B2A86;padding:24px 28px">
              <img src="cid:signova-logo" alt="Signova" width="140" style="display:block;width:140px;max-width:100%;height:auto" />
              <p style="margin:14px 0 0;color:#ffffff;font-size:13px;line-height:18px;opacity:.9">Real-time sign language support for service counters.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px">
              <h1 style="margin:0 0 8px;font-size:22px;color:#5B2A86;line-height:28px">You're invited to Signova</h1>
              <p style="margin:0 0 18px;font-size:15px;line-height:22px;color:#241f27">Hi {{firstName}},</p>
              <p style="margin:0 0 18px;font-size:15px;line-height:22px;color:#241f27">You have been invited to join <strong>{{orgName}}</strong> as an administrator. Complete the short setup below to activate your account.</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:22px;color:#241f27">
                <a href="{{setupUrl}}" style="display:inline-block;background:#5B2A86;color:#ffffff;padding:14px 22px;border-radius:14px;text-decoration:none;font-weight:bold">Open account setup</a>
              </p>
              <p style="margin:0 0 18px;font-size:14px;line-height:20px;color:#2E8B8F">This link expires on <strong>{{expiresOn}}</strong>. If the button doesn't work, copy and paste this URL:</p>
              <p style="margin:0 0 24px;padding:12px 14px;background:#FFF8DC;border-radius:12px;font-family:monospace;font-size:13px;color:#241f27;word-break:break-all">{{setupUrl}}</p>
              <p style="margin:0 0 10px;font-size:13px;line-height:19px;color:#463f48">If you did not expect this invitation, you can safely ignore this email — no account will be created without your confirmation.</p>
              <p style="margin:0;font-size:13px;line-height:19px;color:#463f48">Signova support will never ask you to share a setup link or password.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#ffffff;border-top:1px solid #efe9d2">
              <p style="margin:0;font-size:12px;line-height:18px;color:#68636b">Need help? Contact <a href="mailto:support@signova.example" style="color:#5B2A86;text-decoration:underline">support@signova.example</a> or reply to this email.</p>
              <p style="margin:10px 0 0;font-size:12px;line-height:18px;color:#68636b">&copy; <span id="year"></span> Signova. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

const SETUP_TEXT = [
  "Hi {{firstName}},",
  "",
  "You have been invited to join {{orgName}} as an administrator.",
  "",
  "Set up your account: {{setupUrl}}",
  "",
  "This link expires on {{expiresOn}}.",
  "",
  "If you did not expect this invitation, you can safely ignore this email.",
  "",
  "Signova support will never ask you to share a setup link or password.",
].join("\n");

function render(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
}

export function buildSetupEmail(
  name: string,
  orgName: string,
  setupUrl: string,
  expiresAt: Date,
): { subject: string; text: string; html: string } {
  const firstName = name.trim().split(" ")[0] || "there";
  const expiresOn = new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(expiresAt);

  const values = { firstName, orgName, setupUrl, expiresOn };

  const subject = "Set up your Signova administrator account";
  const text = render(SETUP_TEXT, values);
  const html = render(SETUP_HTML, values).replace('<span id="year"></span>', String(new Date().getFullYear()));

  return { subject, text, html };
}

/** Build the new-staff welcome email (plain + HTML). */
export function buildWelcomeEmail(
  name: string,
  isPendingApproval = true,
): { subject: string; text: string; html: string } {
  const firstName = name.trim().split(" ")[0] || "there";
  const url = signInUrl();

  if (isPendingApproval) {
    const subject = "Signova registration received — pending approval";
    const text = [
      `Hi ${firstName},`,
      "",
      "Your Signova staff registration has been received and is pending administrator approval.",
      "",
      "Once an administrator approves your account, you will be able to sign in at:",
      url,
      "",
      "On your first sign-in you'll set up two-factor authentication with an",
      "authenticator app — this keeps your account secure.",
      "",
      "Signova support will never ask you to share your password.",
    ].join("\n");
    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#241f27">
  <h2 style="color:#5B2A86">Registration received</h2>
  <p>Hi ${firstName},</p>
  <p>Your Signova staff registration has been received and is pending administrator approval.</p>
  <p>
    Once an administrator approves your account, you will be able to sign in to your workspace.
  </p>
  <p style="font-size:13px;color:#68636b">
    On your first sign-in you'll set up two-factor authentication with an
    authenticator app — this keeps your account secure.
  </p>
  <p style="font-size:13px;color:#68636b">
    Signova support will never ask you to share your password.
  </p>
</div>`.trim();
    return { subject, text, html };
  }

  const subject = "Welcome to Signova";
  const text = [
    `Hi ${firstName},`,
    "",
    "Your Signova staff account is active. Welcome aboard.",
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
  <p>Your Signova staff account is active. Welcome aboard.</p>
  <p>
    <a href="${url}"
       style="display:inline-block;background:#5B2A86;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:bold">
      Sign in to your workspace
    </a>
  </p>
  <p style="font-size:13px;color:#68636b">
    On your first sign-in you'll set up two-factor authentication with an
    authenticator app — this keeps your account secure.
  </p>
  <p style="font-size:13px;color:#68636b">
    Signova support will never ask you to share your password.
  </p>
</div>`.trim();
  return { subject, text, html };
}

/** Build the staff invitation email (plain + HTML). */
export function buildInvitationEmail(
  name: string,
  invitationUrl: string,
  expiresAt: Date
): { subject: string; text: string; html: string } {
  const firstName = name.trim().split(" ")[0] || "there";
  const expiresOn = new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(expiresAt);

  const subject = "You are invited to Signova";
  const text = [
    `Hi ${firstName},`,
    "",
    "You have been invited to join Signova as a staff member.",
    "",
    `Accept your invitation: ${invitationUrl}`,
    "",
    `This link expires on ${expiresOn}.`,
    "",
    "Signova support will never ask you to share your password.",
  ].join("\n");
  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#241f27">
  <h2 style="color:#5B2A86">You are invited to Signova</h2>
  <p>Hi ${firstName},</p>
  <p>You have been invited to join Signova as a staff member.</p>
  <p>
    <a href="${invitationUrl}"
       style="display:inline-block;background:#5B2A86;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:bold">
      Accept invitation
    </a>
  </p>
  <p style="font-size:13px;color:#68636b">
    This link expires on ${expiresOn}. If you did not expect this invitation, you can safely ignore this email.
  </p>
  <p style="font-size:13px;color:#68636b">
    Signova support will never ask you to share your password.
  </p>
</div>`.trim();
  return { subject, text, html };
}
