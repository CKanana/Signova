import { useState, useEffect, type FormEvent } from "react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { adminApi, ApiError } from "../services/api";
import type { Teller, TellerStatus, AdminUserSummary } from "../types/admin";
import {
  PageHeading,
  PageBody,
  Card,
  CardHeader,
  CardContent,
  Badge,
  Button,
  Input,
  Select,
  FormGroup,
  Alert,
  Modal,
  EmptyState,
  Spinner,
  PlusIcon,
  SearchIcon,
  TellerIcon,
  CopyIcon,
  CheckIcon,
  StaffIcon,
} from "../components/ui";

export function Tellers() {
  const { user } = useAdminAuth();
  const [tellers, setTellers] = useState<Teller[]>([]);
  const [staffUsers, setStaffUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TellerStatus>("all");

  // Create Counter Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createServiceDesk, setCreateServiceDesk] = useState("");
  const [createCounterNumber, setCreateCounterNumber] = useState("");
  const [createServiceLabel, setCreateServiceLabel] = useState("Kenyan Sign Language · English");
  const [createStaffUser, setCreateStaffUser] = useState("");
  const [createPairingCode, setCreatePairingCode] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Counter Modal State
  const [editingTeller, setEditingTeller] = useState<Teller | null>(null);
  const [editName, setEditName] = useState("");
  const [editServiceDesk, setEditServiceDesk] = useState("");
  const [editCounterNumber, setEditCounterNumber] = useState("");
  const [editServiceLabel, setEditServiceLabel] = useState("");
  const [editStaffUser, setEditStaffUser] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Quick Action / Copy Feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tellersRes, staffRes] = await Promise.all([
        adminApi.listTellers({
          page: 1,
          pageSize: 100,
          status: statusFilter !== "all" ? statusFilter : undefined,
          search: search.trim() || undefined,
        }),
        adminApi.listStaff({ pageSize: 100, onlyActive: true }),
      ]);
      setTellers(tellersRes.items);
      setStaffUsers(staffRes.items);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load tellers data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  const handleCreateCounter = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);
    try {
      await adminApi.createTeller({
        name: createName.trim(),
        serviceDesk: createServiceDesk.trim(),
        counterNumber: createCounterNumber.trim(),
        serviceLabel: createServiceLabel.trim() || undefined,
        staffUser: createStaffUser || undefined,
        pairingCode: createPairingCode.trim() || undefined,
      });
      setIsCreateOpen(false);
      setCreateName("");
      setCreateServiceDesk("");
      setCreateCounterNumber("");
      setCreateStaffUser("");
      setCreatePairingCode("");
      setFeedback({ type: "success", message: `Counter ${createCounterNumber} created successfully.` });
      loadData();
    } catch (err: any) {
      setCreateError(err?.message ?? "Failed to create counter.");
    } finally {
      setCreateLoading(false);
    }
  };

  const openEditModal = (teller: Teller) => {
    setEditingTeller(teller);
    setEditName(teller.name);
    setEditServiceDesk(teller.serviceDesk);
    setEditCounterNumber(teller.counterNumber);
    setEditServiceLabel(teller.serviceLabel ?? "");
    setEditStaffUser(teller.staffUser ?? "");
    setEditError(null);
  };

  const handleUpdateCounter = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingTeller) return;
    setEditError(null);
    setEditLoading(true);
    try {
      await adminApi.updateTeller(editingTeller.id, {
        name: editName.trim(),
        serviceDesk: editServiceDesk.trim(),
        counterNumber: editCounterNumber.trim(),
        serviceLabel: editServiceLabel.trim() || undefined,
        staffUser: editStaffUser || undefined,
      });
      setEditingTeller(null);
      setFeedback({ type: "success", message: `Counter ${editCounterNumber} updated.` });
      loadData();
    } catch (err: any) {
      setEditError(err?.message ?? "Failed to update counter.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleStatusChange = async (teller: Teller, newStatus: TellerStatus) => {
    setStatusUpdatingId(teller.id);
    try {
      await adminApi.setTellerStatus(teller.id, newStatus);
      setFeedback({ type: "success", message: `${teller.name} status updated to ${newStatus}.` });
      setTellers((prev) => prev.map((t) => (t.id === teller.id ? { ...t, status: newStatus } : t)));
    } catch (err: any) {
      setFeedback({ type: "danger", message: err?.message ?? "Failed to update counter status." });
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleStaffAssign = async (teller: Teller, newStaffId: string) => {
    try {
      await adminApi.assignStaffToTeller(teller.id, newStaffId);
      setTellers((prev) =>
        prev.map((t) => (t.id === teller.id ? { ...t, staffUser: newStaffId || undefined } : t))
      );
      const staffName = newStaffId ? staffMap.get(newStaffId) : null;
      setFeedback({
        type: "success",
        message: newStaffId
          ? `Allocated ${staffName} to Counter ${teller.counterNumber}.`
          : `Unassigned staff from Counter ${teller.counterNumber}.`,
      });
    } catch (err: any) {
      setFeedback({ type: "danger", message: err?.message ?? "Failed to allocate staff to counter." });
    }
  };

  const copyPairingCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const staffMap = new Map(staffUsers.map((s) => [s.id, s.name]));

  return (
    <PageBody>
      <PageHeading
        eyebrow="Counter Operations"
        title="Service Counters &amp; Tellers"
        description="Configure institutional service-desk counters, pair Deaf-user tablets, and assign hearing staff."
        action={
          <Button variant="primary" icon={<PlusIcon className="w-4 h-4" />} onClick={() => setIsCreateOpen(true)}>
            Add Service Counter
          </Button>
        }
      />

      {feedback && (
        <Alert variant={feedback.type} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" title="Error Loading Counters">
          {error}
        </Alert>
      )}

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-toolbar__filters">
          <div className="admin-search-box">
            <SearchIcon className="admin-search-box__icon" />
            <Input
              type="search"
              placeholder="Search by counter name, desk, or pairing code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ width: "160px" }}
          >
            <option value="all">All Counter States</option>
            <option value="FREE">Available (Free)</option>
            <option value="BUSY">In Service (Busy)</option>
            <option value="OFFLINE">Offline</option>
          </Select>

          {(search || statusFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        <span style={{ fontSize: "12px", color: "var(--admin-text-secondary)", fontWeight: "600" }}>
          {tellers.length} {tellers.length === 1 ? "counter" : "counters"} configured
        </span>
      </div>

      {/* Tellers Table */}
      {loading && tellers.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
          <Spinner className="w-8 h-8" color="var(--admin-primary)" />
        </div>
      ) : tellers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<TellerIcon className="w-6 h-6" />}
            title="No service counters found"
            description={
              search || statusFilter !== "all"
                ? "No service counters matched your active filters."
                : "No institutional counters configured yet. Add your first service counter."
            }
            action={
              <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
                Add Service Counter
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Counter</th>
                <th>Service Location</th>
                <th>Supported Languages</th>
                <th>Pairing Code</th>
                <th>Assigned Staff</th>
                <th>Counter Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tellers.map((t) => {
                const assignedName = t.staffUser ? staffMap.get(t.staffUser) : null;
                const isUpdating = statusUpdatingId === t.id;

                return (
                  <tr key={t.id}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: "800", color: "var(--admin-text)", fontSize: "14px" }}>
                          Counter {t.counterNumber}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--admin-text-secondary)" }}>
                          {t.name}
                        </span>
                      </div>
                    </td>

                    <td style={{ color: "var(--admin-text)" }}>
                      {t.serviceDesk}
                    </td>

                    <td style={{ color: "var(--admin-text-secondary)", fontSize: "12.5px" }}>
                      {t.serviceLabel || "Kenyan Sign Language · English"}
                    </td>

                    <td>
                      {t.pairingCode ? (
                        <button
                          className="admin-btn admin-btn--secondary admin-btn--sm"
                          onClick={() => copyPairingCode(t.pairingCode!)}
                          title="Click to copy pairing code"
                          style={{ fontFamily: "var(--admin-font-mono)", fontWeight: "700" }}
                        >
                          {copiedCode === t.pairingCode ? (
                            <CheckIcon className="w-3.5 h-3.5" />
                          ) : (
                            <CopyIcon className="w-3.5 h-3.5" />
                          )}
                          <span>{t.pairingCode}</span>
                        </button>
                      ) : (
                        <span style={{ color: "var(--admin-text-muted)", fontSize: "12px" }}>—</span>
                      )}
                    </td>

                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            flexShrink: 0,
                            color: t.staffUser ? "var(--admin-primary)" : "var(--admin-text-muted)",
                          }}
                        >
                          <StaffIcon className="w-3.5 h-3.5" />
                        </span>
                        <Select
                          value={t.staffUser ?? ""}
                          onChange={(e) => handleStaffAssign(t, e.target.value)}
                          style={{
                            height: "30px",
                            padding: "2px 8px",
                            fontSize: "12px",
                            fontWeight: t.staffUser ? "600" : "400",
                            width: "160px",
                            color: t.staffUser ? "var(--admin-text)" : "var(--admin-text-muted)",
                          }}
                          title="Quick-allocate staff member to this counter"
                        >
                          <option value="">— Unassigned —</option>
                          {staffUsers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </td>

                    <td>
                      <Select
                        value={t.status}
                        onChange={(e) => handleStatusChange(t, e.target.value as TellerStatus)}
                        disabled={isUpdating}
                        style={{
                          height: "30px",
                          padding: "2px 8px",
                          fontSize: "12px",
                          fontWeight: "700",
                          width: "130px",
                          borderColor:
                            t.status === "FREE"
                              ? "var(--admin-teal-border)"
                              : t.status === "BUSY"
                              ? "var(--admin-warning-border)"
                              : "var(--admin-border)",
                          background:
                            t.status === "FREE"
                              ? "var(--admin-teal-soft)"
                              : t.status === "BUSY"
                              ? "var(--admin-warning-soft)"
                              : "var(--admin-surface-muted)",
                          color:
                            t.status === "FREE"
                              ? "var(--admin-teal)"
                              : t.status === "BUSY"
                              ? "var(--admin-warning)"
                              : "var(--admin-text-secondary)",
                        }}
                      >
                        <option value="FREE">● Available</option>
                        <option value="BUSY">● In Service</option>
                        <option value="OFFLINE">● Offline</option>
                      </Select>
                    </td>

                    <td>
                      <div className="admin-table__actions">
                        <button
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          onClick={() => openEditModal(t)}
                        >
                          Configure
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Counter Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register New Service Counter"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)} disabled={createLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateCounter}
              loading={createLoading}
              disabled={!createName || !createCounterNumber || !createServiceDesk}
            >
              Create Counter
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateCounter}>
          {createError && (
            <Alert variant="danger">
              {createError}
            </Alert>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: "12px" }}>
            <FormGroup label="Counter Name">
              <Input
                type="text"
                placeholder="e.g. Outpatient Reception Counter"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
                autoFocus
              />
            </FormGroup>

            <FormGroup label="Counter #">
              <Input
                type="text"
                placeholder="04"
                value={createCounterNumber}
                onChange={(e) => setCreateCounterNumber(e.target.value)}
                required
              />
            </FormGroup>
          </div>

          <FormGroup label="Service Desk &amp; Location">
            <Input
              type="text"
              placeholder="e.g. Outpatient Services · Ground Floor"
              value={createServiceDesk}
              onChange={(e) => setCreateServiceDesk(e.target.value)}
              required
            />
          </FormGroup>

          <FormGroup label="Supported Languages &amp; Modalities">
            <Input
              type="text"
              placeholder="e.g. Kenyan Sign Language · English"
              value={createServiceLabel}
              onChange={(e) => setCreateServiceLabel(e.target.value)}
            />
          </FormGroup>

          <FormGroup label="Assign Initial Hearing Staff" optional>
            <Select value={createStaffUser} onChange={(e) => setCreateStaffUser(e.target.value)}>
              <option value="">Leave unassigned</option>
              {staffUsers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email})
                </option>
              ))}
            </Select>
          </FormGroup>

          <FormGroup label="Custom Pairing Code" optional hint="4-8 uppercase letters or digits. Leave blank to auto-generate.">
            <Input
              type="text"
              placeholder="e.g. KNH04"
              value={createPairingCode}
              onChange={(e) => setCreatePairingCode(e.target.value.toUpperCase())}
            />
          </FormGroup>
        </form>
      </Modal>

      {/* Edit Counter Modal */}
      <Modal
        isOpen={!!editingTeller}
        onClose={() => setEditingTeller(null)}
        title={`Configure Counter ${editCounterNumber}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingTeller(null)} disabled={editLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdateCounter}
              loading={editLoading}
              disabled={!editName || !editCounterNumber || !editServiceDesk}
            >
              Save Configuration
            </Button>
          </>
        }
      >
        <form onSubmit={handleUpdateCounter}>
          {editError && (
            <Alert variant="danger">
              {editError}
            </Alert>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: "12px" }}>
            <FormGroup label="Counter Name">
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </FormGroup>

            <FormGroup label="Counter #">
              <Input
                type="text"
                value={editCounterNumber}
                onChange={(e) => setEditCounterNumber(e.target.value)}
                required
              />
            </FormGroup>
          </div>

          <FormGroup label="Service Desk Location">
            <Input
              type="text"
              value={editServiceDesk}
              onChange={(e) => setEditServiceDesk(e.target.value)}
              required
            />
          </FormGroup>

          <FormGroup label="Supported Modalities">
            <Input
              type="text"
              value={editServiceLabel}
              onChange={(e) => setEditServiceLabel(e.target.value)}
            />
          </FormGroup>

          <FormGroup label="Assigned Staff Member">
            <Select value={editStaffUser} onChange={(e) => setEditStaffUser(e.target.value)}>
              <option value="">Unassigned</option>
              {staffUsers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email})
                </option>
              ))}
            </Select>
          </FormGroup>
        </form>
      </Modal>
    </PageBody>
  );
}
