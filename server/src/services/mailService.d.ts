import { type Transporter } from "nodemailer";
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
/** Test hook: inject a mock transport (e.g. nodemailer's jsonTransport). */
export declare function setMailTransport(t: Transporter | null): void;
/** True when SMTP credentials are configured. */
export declare function isMailConfigured(): boolean;
/** Send a message. Returns true on success. Never throws. */
export declare function sendMail(message: MailMessage): Promise<boolean>;
/** Build the password-reset email body (plain + HTML).
 * Exported as `buildResetEmail` for `authService.ts`.
 */
export declare function buildResetEmail(resetUrl: string): {
    subject: string;
    text: string;
    html: string;
};
/** Shared helper: build an absolute invitation/setup URL from the configured
 * admin portal base URL. Never logs or exposes raw tokens.
 */
export declare function buildInvitationUrl(token: string): string;
export declare function buildSetupEmail(name: string, orgName: string, setupUrl: string, expiresAt: Date): {
    subject: string;
    text: string;
    html: string;
};
/** Build the new-staff welcome email (plain + HTML). */
export declare function buildWelcomeEmail(name: string, isPendingApproval?: boolean): {
    subject: string;
    text: string;
    html: string;
};
/** Build the staff invitation email (plain + HTML). */
export declare function buildInvitationEmail(name: string, invitationUrl: string, expiresAt: Date): {
    subject: string;
    text: string;
    html: string;
};
export {};
