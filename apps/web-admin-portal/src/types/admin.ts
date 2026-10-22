/**
 * Admin portal shared types.
 *
 * Extends the shared types from `shared/types` for the administration
 * surface. Role and organization identity are constrained server-side;
 * this module only defines what the portal reads and writes.
 */

import type {
  Role,
  CommunicationMethod,
  SessionStatus,
  SessionEndReason,
  TellerStatus,
  MessageRecord,
} from "../../../../shared/types/translation";

export type { Role, CommunicationMethod, SessionStatus, SessionEndReason, TellerStatus, MessageRecord };

/** Organization configuration exposed to the portal. */
export interface OrganizationProfile {
  id: string;
  name: string;
  shortName: string;
  welcomeMessage: string;
  serviceName: string;
  counterLabel: string;
  colors: { primary: string; background: string };
  logoUrl?: string;
  restrictRegistrationByDomain: boolean;
  allowedEmailDomains: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Public-facing admin user summary (never contains password/TOTP secrets). */
export interface AdminUserSummary {
  id: string;
  organization: string;
  role: Role;
  name: string;
  email?: string;
  avatar?: string;
  twoFactorEnabled: boolean;
  twoFactorConfirmedAt?: string;
  isActive: boolean;
  createdAt: string;
}

/** Teller record as surfaced by the admin portal. */
export interface Teller {
  id: string;
  organization: string;
  name: string;
  serviceLabel?: string;
  serviceDesk: string;
  counterNumber: string;
  pairingCode?: string;
  staffUser?: string;
  status: TellerStatus;
  createdAt: string;
  updatedAt: string;
}

/** Session summary for the admin sessions/history view. */
export interface AdminSession {
  id: string;
  organization: string;
  teller: { id: string; name: string; status: TellerStatus } | null;
  deafUser: { id: string; name: string } | null;
  method: CommunicationMethod;
  status: SessionStatus;
  pairingCode?: string;
  startedAt: string;
  endedAt?: string;
  endReason?: SessionEndReason;
  messageCount: number;
  createdAt: string;
}

/** Audit log entry as surfaced by the admin audit view. */
export interface AuditLogEntry {
  id: string;
  organization: string;
  action: string;
  actor?: { id: string; name: string } | null;
  target?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
}

/** Overview metrics surfaced for the admin dashboard. */
export interface OverviewMetrics {
  organization: OrganizationProfile;
  staffCount: number;
  staffActiveCount: number;
  staffPendingCount: number;
  tellerCount: number;
  tellerAvailableCount: number;
  tellerBusyCount: number;
  tellerOfflineCount: number;
  activeSessionCount: number;
  totalSessionCount: number;
}

/** Pagination result shape shared across admin list endpoints. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
