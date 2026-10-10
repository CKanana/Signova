import { useStaffWorkspace } from "../context/StaffWorkspaceContext";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge, tellerBadge } from "../components/ui/Badge";
import { EmptyState, ErrorBanner, LoadingState } from "../components/ui/States";
import { IconMapPin, IconMessage, IconUsers } from "../components/ui/Icons";
import type { SessionRequestPayload } from "../services/events";

/**
 * The dashboard home: identity header, the assigned teller's live state,
 * the incoming Deaf-user request (the star of the show), and today's
 * recent sessions. All values come from the backend — there are no
 * placeholder statistics anywhere on this screen.
 */

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

interface DashboardPageProps {
  onOpenSession: () => void;
  onOpenHistory: () => void;
}

export function DashboardPage({ onOpenSession, onOpenHistory }: DashboardPageProps) {
  const {
    organization,
    user,
    assignedTellers,
    tellers,
    isLoadingOrg,
    isLoadingTellers,
    pendingRequest,
    acceptRequest,
    declineRequest,
    isLoadingSession,
    error,
  } = useStaffWorkspace();

  const teller = assignedTellers[0];

  return (
    <div className="staff-stack">
      <div>
        <div className="staff-eyebrow">Dashboard</div>
        <h2 className="staff-section-title">
          {user ? `Hello, ${user.name.split(" ")[0]}` : "Staff dashboard"}
        </h2>
        <p className="staff-section-lede">
          This is your communication desk. When a Deaf user selects your counter, their request
          arrives here in real time.
        </p>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {pendingRequest ? (
        <IncomingRequestCard
          request={pendingRequest}
          tellerName={tellerNameFor(pendingRequest.tellerId, assignedTellers, tellers)}
          onAccept={() => void acceptRequest().then(onOpenSession)}
          onDecline={declineRequest}
          isAccepting={isLoadingSession}
        />
      ) : (
        <Card>
          <EmptyState
            title="No one is waiting right now"
            action={
              <Button variant="secondary" onClick={onOpenHistory}>
                View session history
              </Button>
            }
          >
            You will see a request here the moment a Deaf user selects your counter from their app.
          </EmptyState>
        </Card>
      )}

      <div className="staff-grid staff-grid--2">
        <Card>
          <CardHeader title="Your counter" eyebrow="Assignment" />
          <div className="staff-card__body">
            {isLoadingTellers ? (
              <LoadingState label="Loading teller details…" />
            ) : teller ? (
              <>
                <div className="staff-row staff-row--between" style={{ marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-heading)" }}>
                      {teller.name}
                    </div>
                    <div style={{ color: "var(--signova-muted-text)", fontSize: 14, marginTop: 2 }}>
                      {teller.serviceLabel || "Service counter"}
                    </div>
                  </div>
                  <Badge tone={tellerBadge(teller.status).tone} dot pulse={teller.status === "BUSY"}>
                    {tellerBadge(teller.status).label}
                  </Badge>
                </div>
                <dl className="staff-kv">
                  <dt>Counter</dt>
                  <dd>{teller.counterNumber}</dd>
                  <dt>Service desk</dt>
                  <dd>
                    <IconMapPin /> {teller.serviceDesk}
                  </dd>
                  <dt>Pairing code</dt>
                  <dd>{teller.pairingCode}</dd>
                </dl>
              </>
            ) : (
              <EmptyState title="No teller assigned">
                Your administrator has not assigned you to a service counter yet. You can still see
                organization activity, but requests cannot reach you.
              </EmptyState>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Organization" eyebrow="Where you work" />
          <div className="staff-card__body">
            {isLoadingOrg ? (
              <LoadingState label="Loading organization…" />
            ) : organization ? (
              <dl className="staff-kv">
                <dt>Name</dt>
                <dd>{organization.name}</dd>
                <dt>Code</dt>
                <dd>{organization.shortName}</dd>
                <dt>Service</dt>
                <dd>{organization.serviceName}</dd>
                <dt>Counters</dt>
                <dd>{tellers.length}</dd>
              </dl>
            ) : (
              <LoadingState label="Loading organization…" />
            )}
          </div>
        </Card>
      </div>

      {tellers.length > 1 ? (
        <Card>
          <CardHeader title="All counters" eyebrow="Live status" />
          <div className="staff-card__body">
            <div className="staff-stack" style={{ gap: 8 }}>
              {tellers.map((t) => (
                <div
                  key={t._id}
                  className="staff-row staff-row--between"
                  style={{
                    padding: "10px 14px",
                    border: "1.5px solid var(--signova-border)",
                    borderRadius: 12,
                  }}
                >
                  <div className="staff-row">
                    <span className="staff-avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                      {t.name.split(" ").map((p: string) => p[0]).slice(0, 2).join("")}
                    </span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{t.name}</div>
                      <div style={{ color: "var(--signova-muted-text)", fontSize: 12 }}>
                        Counter {t.counterNumber} · {t.serviceDesk}
                      </div>
                    </div>
                  </div>
                  <Badge tone={tellerBadge(t.status).tone} dot>
                    {tellerBadge(t.status).label}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

interface IncomingRequestCardProps {
  request: SessionRequestPayload;
  tellerName: string;
  onAccept: () => void;
  onDecline: () => void;
  isAccepting: boolean;
}

function IncomingRequestCard({
  request,
  tellerName,
  onAccept,
  onDecline,
  isAccepting,
}: IncomingRequestCardProps) {
  return (
    <section className="staff-request" aria-live="polite">
      <div className="staff-request__head">
        <Badge tone="solid" dot pulse>
          New
        </Badge>
        <h2 className="staff-request__title">New communication request</h2>
      </div>
      <p className="staff-section-lede" style={{ marginBottom: 16 }}>
        A Deaf user has selected {tellerName} and is waiting to communicate.
      </p>
      <dl className="staff-kv staff-request__facts">
        <dt>Teller</dt>
        <dd>
          <IconUsers /> {tellerName}
        </dd>
        <dt>Communication method</dt>
        <dd>{request.method === "sign" ? "Sign language" : "Typed message"}</dd>
        <dt>Time received</dt>
        <dd>{formatTime(request.startedAt)}</dd>
        <dt>Session status</dt>
        <dd>Waiting for staff</dd>
      </dl>
      <div className="staff-row">
        <Button onClick={onAccept} loading={isAccepting}>
          <IconMessage />
          Accept and start communicating
        </Button>
        <Button variant="ghost" onClick={onDecline} disabled={isAccepting}>
          Dismiss
        </Button>
      </div>
      <p className="staff-field__hint" style={{ marginTop: 10 }}>
        Accepting opens the conversation workspace and connects you to the Deaf user in real time.
      </p>
    </section>
  );
}

function tellerNameFor(
  tellerId: string,
  assigned: Array<{ _id: string; name: string }>,
  all: Array<{ _id: string; name: string }>,
): string {
  return assigned.find((t) => t._id === tellerId)?.name ?? all.find((t) => t._id === tellerId)?.name ?? "your counter";
}
