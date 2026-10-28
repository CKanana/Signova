import { type Transporter } from "nodemailer";
/**
 * Email delivery for Signova (new-staff welcome + password reset + invitations).
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
/** Test hook: inject a mock transport (e.g. nodemailer's jsonTransport). */
export declare function setMailTransport(t: Transporter | null): void;
/** True when SMTP credentials are configured. */
export declare function isMailConfigured(): boolean;
/**
 * Send a message. Returns true on success.
 *
 * On failure the error is logged WITHOUT the recipient's address or message
 * body (to avoid leaking PII/tokens into logs) and false is returned so the
 * caller can respond safely. Never throws — a mail outage must not crash
 * the request path.
 */
export declare function sendMail(message: MailMessage): Promise<boolean>;
/** Build the password-reset email body (plain + HTML). */
export declare function buildResetEmail(resetUrl: string): {
    subject: string;
    text: string;
    html: string;
};
export declare function buildSetupEmail(name: string, orgName: string, setupUrl: string, expiresAt: Date): {
    subject: string;
    text: string;
    html: string;
};
/**
 * Build the new-staff welcome email (plain + HTML).
 *
 * Sent when a staff member self-registers. Since new registrations require
 * administrator approval before access is granted, the email confirms that the
 * registration was received and is pending review.
 */
export declare function buildWelcomeEmail(name: string, isPendingApproval?: boolean): {
    subject: string;
    text: string;
    html: string;
};
/**
 * Build the staff invitation email (plain + HTML).
 */
export declare function buildInvitationEmail(name: string, invitationUrl: string, expiresAt: Date): {
    subject: string;
    text: string;
    html: string;
};
export {};
