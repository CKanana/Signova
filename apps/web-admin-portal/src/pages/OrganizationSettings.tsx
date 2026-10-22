import { useState, useEffect, type FormEvent } from "react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { adminApi, ApiError } from "../services/api";
import type { OrganizationProfile } from "../types/admin";
import {
  PageHeading,
  PageBody,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Input,
  Textarea,
  FormGroup,
  Alert,
  Badge,
  Spinner,
  BuildingIcon,
  ShieldIcon,
  RefreshIcon,
  CheckIcon,
} from "../components/ui";

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export function OrganizationSettings() {
  const { organization, setOrganization } = useAdminAuth();
  const [profile, setProfile] = useState<OrganizationProfile | null>(organization);
  const [originalProfile, setOriginalProfile] = useState<OrganizationProfile | null>(organization);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Email domains tag editor string
  const [domainInput, setDomainInput] = useState("");

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getOrganizationSettings();
      setProfile(res.profile);
      setOriginalProfile(res.profile);
      setOrganization(res.profile);
      setDomainInput(res.profile.allowedEmailDomains?.join(", ") ?? "");
    } catch (err: any) {
      setError(err?.message ?? "Failed to load organization settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

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
      // Parse allowed email domains from domainInput
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
        restrictRegistrationByDomain: profile.restrictRegistrationByDomain,
        allowedEmailDomains: parsedDomains,
      });

      setProfile(res.profile);
      setOriginalProfile(res.profile);
      setOrganization(res.profile);
      setDomainInput(res.profile.allowedEmailDomains?.join(", ") ?? "");
      setSuccess("Organization settings successfully saved and applied.");
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
        description="Institutional service identity, counter tablet display customization, and staff registration security policies."
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

            {/* Section 2: Counter Display & Welcome Message */}
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

            {/* Section 3: Brand Palette Tokens */}
            <Card>
              <CardHeader
                title="Brand Color Palette"
                subtitle="Theme colors rendered across the counter tablet and staff portals"
              />
              <CardContent>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
                  <div>
                    <FormGroup label="Primary Accent Color">
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <input
                          type="color"
                          value={profile.colors?.primary ?? "#5B2A86"}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              colors: { ...profile.colors, primary: e.target.value },
                            })
                          }
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
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              colors: { ...profile.colors, primary: e.target.value },
                            })
                          }
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
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              colors: { ...profile.colors, background: e.target.value },
                            })
                          }
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
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              colors: { ...profile.colors, background: e.target.value },
                            })
                          }
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
                    Live Preview: Kiosk Surface Contrast
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
                    Primary Button Preview
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Registration Security Policies */}
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
                        placeholder="e.g. gmail.com, signova.test"
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
