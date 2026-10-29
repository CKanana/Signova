import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";
import { useAdminAuth, applyOrganizationTheme } from "../context/AdminAuthContext";
import { adminApi, ApiError } from "../services/api";
import type { OrganizationProfile } from "../types/admin";
import {
  PageHeading,
  PageBody,
  Card,
  CardHeader,
  CardContent,
  Button,
  Input,
  Textarea,
  FormGroup,
  Alert,
  Badge,
  Spinner,
  RefreshIcon,
  CheckIcon,
} from "../components/ui";

import signovaBadge from "../assets/brand/signova-badge-circular.png";
import signovaLogoHorizontalLight from "../assets/brand/signova-logo-horizontal-light.png";
import signovaLogoHorizontal from "../assets/brand/signova-logo-horizontal.png";
import signovaMarkLight from "../assets/brand/signova-mark-light.png";
import signovaMarkPurple from "../assets/brand/signova-mark-purple.png";

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

const COLOR_PRESETS = [
  { name: "Signova Institutional (Default)", primary: "#5B2A86", background: "#FFF8DC" },
  { name: "Oceanic Teal", primary: "#134E4A", background: "#F0FDF4" },
  { name: "Midnight Cobalt", primary: "#1E3A8A", background: "#F0F9FF" },
  { name: "Institutional Charcoal", primary: "#27272A", background: "#F8F6F2" },
];

const BUILT_IN_ASSETS = [
  { label: "Circular Badge", src: signovaBadge, desc: "Teal & purple circular emblem" },
  { label: "Horizontal Light", src: signovaLogoHorizontalLight, desc: "Full white wordmark with teal mark" },
  { label: "White Mark", src: signovaMarkLight, desc: "Clean white SVG mark for dark sidebars" },
  { label: "Purple Mark", src: signovaMarkPurple, desc: "Rich purple icon mark" },
  { label: "Horizontal Dark", src: signovaLogoHorizontal, desc: "Full dark wordmark for light surfaces" },
];

export function OrganizationSettings() {
  const { organization, setOrganization } = useAdminAuth();
  const [profile, setProfile] = useState<OrganizationProfile | null>(organization);
  const [originalProfile, setOriginalProfile] = useState<OrganizationProfile | null>(organization);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Email domains input
  const [domainInput, setDomainInput] = useState("");

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getOrganizationSettings();
      setProfile(res.profile);
      setOriginalProfile(res.profile);
      setOrganization(res.profile);
      setDomainInput(res.profile.allowedEmailDomains?.join(", ") ?? "");
      applyOrganizationTheme(res.profile.colors);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load organization settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleFileUpload = (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload a valid image file (PNG, JPG, SVG, or WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image file size must be less than 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result && profile) {
        setProfile({ ...profile, logoUrl: result });
      }
    };
    reader.onerror = () => {
      setUploadError("Failed to process image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError(null);
    setSuccess(null);

    // Validate colors
    if (profile.colors?.primary && !HEX_COLOR_REGEX.test(profile.colors.primary)) {
      setError("Primary color must be a valid 6-character hex code (e.g. #5B2A86).");
      return;
    }
    if (profile.colors?.background && !HEX_COLOR_REGEX.test(profile.colors.background)) {
      setError("Background color must be a valid 6-character hex code (e.g. #FFF8DC).");
      return;
    }

    setSaving(true);
    try {
      const parsedDomains = domainInput
        .split(/[\s,]+/)
        .map((d) => d.trim().toLowerCase())
        .filter((d) => d.length > 0);

      const res = await adminApi.updateOrganizationSettings({
        name: profile.name,
        shortName: profile.shortName,
        welcomeMessage: profile.welcomeMessage,
        serviceName: profile.serviceName,
        counterLabel: profile.counterLabel,
        colors: profile.colors,
        logoUrl: profile.logoUrl ?? undefined,
        restrictRegistrationByDomain: profile.restrictRegistrationByDomain,
        allowedEmailDomains: parsedDomains,
      });

      setProfile(res.profile);
      setOriginalProfile(res.profile);
      setOrganization(res.profile);
      setDomainInput(res.profile.allowedEmailDomains?.join(", ") ?? "");
      applyOrganizationTheme(res.profile.colors);
      setSuccess("Organization settings successfully saved and applied across Admin, Staff, and Deaf kiosks.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to save organization settings.");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = JSON.stringify(profile) !== JSON.stringify(originalProfile);

  return (
    <PageBody>
      <PageHeading
        eyebrow="System Configuration"
        title="Organisation Settings"
        description="Institutional service identity, branding assets & logo, counter tablet display customization, and staff registration security policies."
        action={
          <Button variant="secondary" size="sm" onClick={loadSettings} loading={loading} icon={<RefreshIcon className="w-3.5 h-3.5" />}>
            Reload
          </Button>
        }
      />

      {error && (
        <Alert variant="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {loading && !profile ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
          <Spinner className="w-8 h-8" color="var(--admin-primary)" />
        </div>
      ) : profile ? (
        <form onSubmit={handleSave}>
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Section 1: Institutional Identity */}
            <Card>
              <CardHeader
                title="Institutional Identity"
                subtitle="Organization naming and service desk representation"
              />
              <CardContent>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: "16px" }}>
                  <FormGroup label="Institution Full Name">
                    <Input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      required
                    />
                  </FormGroup>

                  <FormGroup label="Short Name / Acronym">
                    <Input
                      type="text"
                      value={profile.shortName}
                      onChange={(e) => setProfile({ ...profile, shortName: e.target.value })}
                      required
                    />
                  </FormGroup>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <FormGroup label="Service Desk Name" hint="Displayed on staff counter interface">
                    <Input
                      type="text"
                      value={profile.serviceName}
                      onChange={(e) => setProfile({ ...profile, serviceName: e.target.value })}
                      required
                    />
                  </FormGroup>

                  <FormGroup label="Counter Device Label" hint="Displayed on kiosk tablet header">
                    <Input
                      type="text"
                      value={profile.counterLabel}
                      onChange={(e) => setProfile({ ...profile, counterLabel: e.target.value })}
                      required
                    />
                  </FormGroup>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Logo & Branding Assets */}
            <Card>
              <CardHeader
                title="Logo &amp; Brand Assets"
                subtitle="Upload your hospital or organization logo to display in the Admin sidebar, staff desk, and Deaf kiosk tablet"
              />
              <CardContent>
                {uploadError && (
                  <Alert variant="danger" onClose={() => setUploadError(null)}>
                    {uploadError}
                  </Alert>
                )}

                {/* Dual Context Live Preview */}
                <div style={{ marginBottom: "20px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--admin-text)", display: "block", marginBottom: "8px" }}>
                    Logo Placement Previews
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                    {/* Preview on Dark Purple Sidebar */}
                    <div
                      style={{
                        padding: "18px",
                        borderRadius: "12px",
                        background: "linear-gradient(180deg, var(--admin-primary, #5B2A86), #381855)",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        border: "1.5px solid rgba(255, 255, 255, 0.2)",
                      }}
                    >
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "10px",
                          background: "rgba(255, 255, 255, 0.15)",
                          display: "grid",
                          placeItems: "center",
                          overflow: "hidden",
                          flexShrink: 0,
                        }}
                      >
                        {profile.logoUrl ? (
                          <img
                            src={profile.logoUrl}
                            alt="Sidebar Logo"
                            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                          />
                        ) : (
                          <img
                            src={signovaMarkLight}
                            alt="Default Mark"
                            style={{ width: "32px", height: "32px", objectFit: "contain" }}
                          />
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: "800", letterSpacing: "0.02em" }}>
                          {profile.shortName || "Signova"}
                        </div>
                        <div style={{ fontSize: "11px", color: "#CDB8F5", textTransform: "uppercase", fontWeight: "700" }}>
                          Sidebar Nav Lockup
                        </div>
                      </div>
                    </div>

                    {/* Preview on Light Canvas */}
                    <div
                      style={{
                        padding: "18px",
                        borderRadius: "12px",
                        background: profile.colors?.background || "#FFF8DC",
                        color: "var(--admin-text)",
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        border: "1.5px solid var(--admin-border)",
                      }}
                    >
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "10px",
                          background: "#FFFFFF",
                          display: "grid",
                          placeItems: "center",
                          overflow: "hidden",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                          flexShrink: 0,
                        }}
                      >
                        {profile.logoUrl ? (
                          <img
                            src={profile.logoUrl}
                            alt="Canvas Logo"
                            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                          />
                        ) : (
                          <img
                            src={signovaBadge}
                            alt="Signova Badge"
                            style={{ width: "36px", height: "36px", objectFit: "contain" }}
                          />
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: "800", color: "var(--admin-primary, #5B2A86)" }}>
                          {profile.name || "Institution Name"}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--admin-text-secondary)", fontWeight: "600" }}>
                          Counter Tablet &amp; Kiosk View
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upload Drag & Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${isDragging ? "var(--admin-primary)" : "var(--admin-border)"}`,
                    borderRadius: "12px",
                    padding: "24px",
                    textAlign: "center",
                    background: isDragging ? "var(--admin-primary-soft)" : "var(--admin-surface-muted)",
                    transition: "all 0.15s ease",
                    marginBottom: "18px",
                  }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                    style={{ display: "none" }}
                  />
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--admin-text)", marginBottom: "4px" }}>
                    Drag &amp; drop your logo here, or browse files
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--admin-text-secondary)", marginBottom: "14px" }}>
                    PNG, JPG, SVG, or WebP up to 5MB (transparent background recommended)
                  </div>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse Image File
                    </Button>
                    {profile.logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setProfile({ ...profile, logoUrl: "" })}
                      >
                        Reset to Default Mark
                      </Button>
                    )}
                  </div>
                </div>

                {/* Preset Brand Asset Selector */}
                <div style={{ marginBottom: "16px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--admin-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>
                    Or select an official Signova brand mark:
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                    {BUILT_IN_ASSETS.map((asset) => {
                      const isSelected = profile.logoUrl === asset.src;
                      return (
                        <button
                          key={asset.label}
                          type="button"
                          onClick={() => setProfile({ ...profile, logoUrl: asset.src })}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: `1.5px solid ${isSelected ? "var(--admin-primary)" : "var(--admin-border)"}`,
                            background: isSelected ? "var(--admin-primary-soft)" : "var(--admin-surface)",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: isSelected ? "700" : "600",
                            color: isSelected ? "var(--admin-primary)" : "var(--admin-text)",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <img src={asset.src} alt={asset.label} style={{ width: "20px", height: "20px", objectFit: "contain" }} />
                          <span>{asset.label}</span>
                          {isSelected && <CheckIcon className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Direct Image URL input */}
                <FormGroup label="Custom Logo URL (optional)" hint="You can also paste a hosted image URL or base64 data URI">
                  <Input
                    type="text"
                    value={profile.logoUrl ?? ""}
                    onChange={(e) => setProfile({ ...profile, logoUrl: e.target.value })}
                    placeholder="https://cdn.hospital.org/logo.png"
                  />
                </FormGroup>
              </CardContent>
            </Card>

            {/* Section 3: Counter Display & Welcome Message */}
            <Card>
              <CardHeader
                title="Kiosk Welcome Display"
                subtitle="Greeting and instructions presented to Deaf signers on counter tablets"
              />
              <CardContent>
                <FormGroup label="Tablet Welcome Message" hint="Rendered in large, high-legibility font on the counter tablet">
                  <Textarea
                    value={profile.welcomeMessage}
                    onChange={(e) => setProfile({ ...profile, welcomeMessage: e.target.value })}
                    rows={3}
                  />
                </FormGroup>
              </CardContent>
            </Card>

            {/* Section 4: Brand Palette Tokens */}
            <Card>
              <CardHeader
                title="Brand Color Palette"
                subtitle="Theme colors rendered dynamically across the counter tablet, hearing staff desk, and admin portals"
              />
              <CardContent>
                {/* Color Presets */}
                <div style={{ marginBottom: "18px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--admin-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>
                    Color Palette Presets:
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                    {COLOR_PRESETS.map((preset) => {
                      const isSelected =
                        profile.colors?.primary === preset.primary &&
                        profile.colors?.background === preset.background;
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            const newColors = { primary: preset.primary, background: preset.background };
                            setProfile({ ...profile, colors: newColors });
                            applyOrganizationTheme(newColors);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: `1.5px solid ${isSelected ? "var(--admin-primary)" : "var(--admin-border)"}`,
                            background: isSelected ? "var(--admin-primary-soft)" : "var(--admin-surface)",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: isSelected ? "700" : "600",
                            color: isSelected ? "var(--admin-primary)" : "var(--admin-text)",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <span
                            style={{
                              width: "14px",
                              height: "14px",
                              borderRadius: "50%",
                              background: preset.primary,
                              border: "1px solid rgba(0,0,0,0.15)",
                              display: "inline-block",
                            }}
                          />
                          <span>{preset.name}</span>
                          {isSelected && <CheckIcon className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
                  <div>
                    <FormGroup label="Primary Accent Color">
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <input
                          type="color"
                          value={profile.colors?.primary ?? "#5B2A86"}
                          onChange={(e) => {
                            const newColors = { ...profile.colors, primary: e.target.value };
                            setProfile({ ...profile, colors: newColors });
                            applyOrganizationTheme(newColors);
                          }}
                          style={{
                            width: "40px",
                            height: "40px",
                            border: "1px solid var(--admin-border)",
                            borderRadius: "var(--admin-radius-md)",
                            cursor: "pointer",
                            padding: "2px",
                          }}
                        />
                        <Input
                          type="text"
                          value={profile.colors?.primary ?? "#5B2A86"}
                          onChange={(e) => {
                            const newColors = { ...profile.colors, primary: e.target.value };
                            setProfile({ ...profile, colors: newColors });
                            if (HEX_COLOR_REGEX.test(e.target.value)) {
                              applyOrganizationTheme(newColors);
                            }
                          }}
                          style={{ fontFamily: "var(--admin-font-mono)", fontWeight: "700" }}
                        />
                      </div>
                    </FormGroup>
                  </div>

                  <div>
                    <FormGroup label="Background Canvas Color">
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <input
                          type="color"
                          value={profile.colors?.background ?? "#FFF8DC"}
                          onChange={(e) => {
                            const newColors = { ...profile.colors, background: e.target.value };
                            setProfile({ ...profile, colors: newColors });
                            applyOrganizationTheme(newColors);
                          }}
                          style={{
                            width: "40px",
                            height: "40px",
                            border: "1px solid var(--admin-border)",
                            borderRadius: "var(--admin-radius-md)",
                            cursor: "pointer",
                            padding: "2px",
                          }}
                        />
                        <Input
                          type="text"
                          value={profile.colors?.background ?? "#FFF8DC"}
                          onChange={(e) => {
                            const newColors = { ...profile.colors, background: e.target.value };
                            setProfile({ ...profile, colors: newColors });
                            if (HEX_COLOR_REGEX.test(e.target.value)) {
                              applyOrganizationTheme(newColors);
                            }
                          }}
                          style={{ fontFamily: "var(--admin-font-mono)", fontWeight: "700" }}
                        />
                      </div>
                    </FormGroup>
                  </div>
                </div>

                {/* Color swatch preview */}
                <div
                  style={{
                    marginTop: "16px",
                    padding: "16px",
                    borderRadius: "var(--admin-radius-md)",
                    background: profile.colors?.background ?? "#FFF8DC",
                    border: "1px solid var(--admin-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#241F27" }}>
                    Live Surface &amp; Button Contrast
                  </span>
                  <span
                    style={{
                      background: profile.colors?.primary ?? "#5B2A86",
                      color: "#FFFFFF",
                      padding: "6px 14px",
                      borderRadius: "var(--admin-radius-pill)",
                      fontSize: "12px",
                      fontWeight: "700",
                    }}
                  >
                    Action Button
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Section 5: Registration Security Policies */}
            <Card>
              <CardHeader
                title="Staff Access &amp; Domain Restrictions"
                subtitle="Governs public staff registration eligibility"
              />
              <CardContent>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={profile.restrictRegistrationByDomain}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          restrictRegistrationByDomain: e.target.checked,
                        })
                      }
                      style={{ width: "18px", height: "18px", accentColor: "var(--admin-primary)", cursor: "pointer" }}
                    />
                    <div>
                      <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--admin-text)", display: "block" }}>
                        Restrict staff registration to authorized email domains
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--admin-text-secondary)" }}>
                        When enabled, self-service sign-up is only permitted for emails matching the list below.
                      </span>
                    </div>
                  </label>

                  {profile.restrictRegistrationByDomain && (
                    <FormGroup
                      label="Allowed Email Domains"
                      hint="Comma or space separated domain names (e.g. gmail.com, signova.test, knh.or.ke)"
                    >
                      <Input
                        type="text"
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        placeholder="e.g. gmail.com, signova.test, knh.or.ke"
                      />
                    </FormGroup>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Save / Discard Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                background: "var(--admin-surface)",
                border: "1px solid var(--admin-border)",
                borderRadius: "var(--admin-radius-lg)",
                boxShadow: "var(--admin-shadow-sm)",
              }}
            >
              <div>
                {isDirty ? (
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--admin-warning)" }}>
                    ● You have unsaved configuration changes.
                  </span>
                ) : (
                  <span style={{ fontSize: "13px", color: "var(--admin-text-muted)" }}>
                    All settings are synced with the institutional cluster.
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!isDirty || saving}
                  onClick={() => {
                    setProfile(originalProfile);
                    setDomainInput(originalProfile?.allowedEmailDomains?.join(", ") ?? "");
                    applyOrganizationTheme(originalProfile?.colors);
                  }}
                >
                  Discard Changes
                </Button>
                <Button type="submit" variant="primary" loading={saving} disabled={!isDirty || saving}>
                  Save Configuration
                </Button>
              </div>
            </div>
          </div>
        </form>
      ) : null}
    </PageBody>
  );
}
