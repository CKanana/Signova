import { Link, useNavigate } from "react-router-dom";
import signovaBadge from "../assets/brand/signova-badge-circular.png";

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="admin-auth-canvas" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
      <div
        className="admin-card"
        style={{
          maxWidth: "520px",
          width: "100%",
          textAlign: "center",
          padding: "40px 32px",
          border: "1.5px solid var(--admin-border)",
          boxShadow: "0 12px 32px rgba(91, 42, 134, 0.08)",
          borderRadius: "16px",
          background: "var(--admin-surface)",
        }}
      >
        <div style={{ display: "inline-flex", justifyContent: "center", marginBottom: "20px" }}>
          <img
            src={signovaBadge}
            alt="Signova"
            style={{ width: "72px", height: "72px", objectFit: "contain", borderRadius: "50%", boxShadow: "0 4px 14px rgba(91, 42, 134, 0.15)" }}
          />
        </div>

        <div
          style={{
            display: "inline-block",
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--admin-teal)",
            background: "var(--admin-teal-soft)",
            padding: "4px 12px",
            borderRadius: "20px",
            marginBottom: "14px",
          }}
        >
          404 · Route Not Found
        </div>

        <h1
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: "26px",
            fontWeight: 800,
            color: "var(--admin-primary)",
            margin: "0 0 12px 0",
            lineHeight: 1.25,
          }}
        >
          Lost in the Service Queue?
        </h1>

        <p
          style={{
            fontSize: "14px",
            color: "var(--admin-text-secondary)",
            lineHeight: 1.6,
            margin: "0 0 28px 0",
          }}
        >
          The administrative counter, staff profile, or page you are looking for has moved or is not registered in this Signova workspace.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", marginBottom: "28px" }}>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={() => navigate("/admin/overview")}
            style={{ minWidth: "150px" }}
          >
            Go to Overview
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => navigate(-1)}
          >
            Go Back
          </button>
        </div>

        <div
          style={{
            borderTop: "1px solid var(--admin-border-subtle)",
            paddingTop: "18px",
            display: "flex",
            justifyContent: "center",
            gap: "16px",
            fontSize: "13px",
          }}
        >
          <Link to="/admin/staff" style={{ color: "var(--admin-primary)", textDecoration: "none", fontWeight: 600 }}>
            Staff Directory
          </Link>
          <span style={{ color: "var(--admin-border-strong)" }}>•</span>
          <Link to="/admin/tellers" style={{ color: "var(--admin-primary)", textDecoration: "none", fontWeight: 600 }}>
            Service Counters
          </Link>
          <span style={{ color: "var(--admin-border-strong)" }}>•</span>
          <Link to="/admin/settings" style={{ color: "var(--admin-primary)", textDecoration: "none", fontWeight: 600 }}>
            Organization
          </Link>
        </div>

        <div
          style={{
            marginTop: "20px",
            fontSize: "11px",
            color: "var(--admin-text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--admin-teal)", display: "inline-block" }}></span>
          Signova Institutional Engine Online
        </div>
      </div>
    </div>
  );
}
