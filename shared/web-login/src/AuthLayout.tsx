import React from "react";

export interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  rightPanel: React.ReactNode;
  footer?: React.ReactNode;
  illustration?: React.ReactNode;
  logo?: React.ReactNode;
}

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  rightPanel,
  footer,
  illustration,
  logo,
}: AuthLayoutProps) {
  return (
    <main className="staff-login">
      <section className="staff-login__brand">
        <header className="staff-login__brandmark">
          {logo ? logo : null}
          <span className="staff-login__wordmark">Signova</span>
        </header>
        <div className="staff-login__intro">
          <p className="staff-login__tagline">{eyebrow}</p>
          <h2 className="staff-login__headline">{title}</h2>
          <p className="staff-login__copy">{subtitle}</p>
        </div>
        <div className="staff-login__illustration" aria-hidden="true">
          {illustration}
        </div>
        <p className="staff-login__security">{footer}</p>
      </section>

      <section className="staff-login__panel">
        <div className="staff-login__card">{rightPanel}</div>
      </section>
    </main>
  );
}
