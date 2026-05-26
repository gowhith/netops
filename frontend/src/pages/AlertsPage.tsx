import { useDeferredValue, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ActivityFeed } from "../components/ActivityFeed";
import { DataTable } from "../components/DataTable";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { updateAlertStatus } from "../lib/api";
import { formatTimestamp } from "../lib/utils";
import { useAlertStore } from "../stores/alertStore";
import { useSessionStore } from "../stores/sessionStore";
import type { AlertStatus } from "../types/alert";
import type { Severity } from "../types/common";

const severityFilters: Array<Severity | "all"> = ["all", "info", "warning", "critical"];
const statusFilters: Array<AlertStatus | "all"> = [
  "all",
  "open",
  "acknowledged",
  "resolved",
];

export function AlertsPage() {
  const alerts = useAlertStore((state) => state.alerts);
  const upsertAlert = useAlertStore((state) => state.upsertAlert);
  const searchQuery = useSessionStore((state) => state.searchQuery);
  const deferredSearch = useDeferredValue(searchQuery);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "all">("all");
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();

  const alertMutation = useMutation({
    mutationFn: ({
      alertId,
      status,
    }: {
      alertId: string;
      status: Extract<AlertStatus, "acknowledged" | "resolved">;
    }) => updateAlertStatus(alertId, status),
    onSuccess: (alert) => {
      upsertAlert(alert);
      setMessage(`Alert ${alert.id} moved to ${alert.status}.`);
      void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: () => {
      setMessage("Backend alert update failed. Check API availability and permissions.");
    },
  });

  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch =
      `${alert.deviceName} ${alert.reason} ${alert.source}`
        .toLowerCase()
        .includes(deferredSearch.toLowerCase());
    const matchesSeverity =
      severityFilter === "all" ? true : alert.severity === severityFilter;
    const matchesStatus = statusFilter === "all" ? true : alert.status === statusFilter;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Alerts"
        title="Real-time alerts"
        description="Threshold, drift, and heartbeat alerts. This page maps directly to the planned alerts feed with severity, device, reason, status, and suggested action."
      />

      <section className="three-column-grid">
        <MetricCard
          label="Critical"
          value={`${alerts.filter((alert) => alert.severity === "critical").length}`}
          delta="high-priority events"
          detail="immediate response"
          tone="critical"
        />
        <MetricCard
          label="Warning"
          value={`${alerts.filter((alert) => alert.severity === "warning").length}`}
          delta="watchlist pressure"
          detail="degraded service"
          tone="warning"
        />
        <MetricCard
          label="Open alerts"
          value={`${alerts.filter((alert) => alert.status === "open").length}`}
          delta="pending acknowledgment"
          detail="triage queue"
          tone="degraded"
        />
      </section>

      <SectionCard
        eyebrow="Filters"
        title="Alert controls"
        description="Use these filters to move between the signal feed and the incident queue. Status changes are sent back to the backend."
      >
        <div className="stack">
          <div className="filter-row">
            {severityFilters.map((filter) => (
              <button
                key={filter}
                className={`filter-chip ${severityFilter === filter ? "active" : ""}`}
                onClick={() => setSeverityFilter(filter)}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="filter-row">
            {statusFilters.map((filter) => (
              <button
                key={filter}
                className={`filter-chip ${statusFilter === filter ? "active" : ""}`}
                onClick={() => setStatusFilter(filter)}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
          {message ? <div className="tone-chip tone-chip--healthy">{message}</div> : null}
        </div>
      </SectionCard>

      <section className="split-grid">
        <SectionCard
          eyebrow="Alert table"
          title={`${filteredAlerts.length} alerts in view`}
          description="Recommended action is kept close to the signal to support fast triage."
        >
          <DataTable
            rows={filteredAlerts}
            getRowKey={(alert) => alert.id}
            columns={[
              {
                key: "severity",
                header: "Severity",
                render: (alert) => <StatusBadge label={alert.severity} tone={alert.severity} />,
              },
              {
                key: "device",
                header: "Device",
                render: (alert) => (
                  <div>
                    <strong>{alert.deviceName}</strong>
                    <div className="small-text muted-text">{alert.source}</div>
                  </div>
                ),
              },
              {
                key: "reason",
                header: "Reason",
                render: (alert) => alert.reason,
              },
              {
                key: "status",
                header: "Status",
                render: (alert) => <StatusBadge label={alert.status} tone="info" />,
              },
              {
                key: "action",
                header: "Suggested action",
                render: (alert) => alert.suggestedAction,
              },
              {
                key: "controls",
                header: "Backend controls",
                render: (alert) => (
                  <div className="inline-actions">
                    {alert.status === "open" ? (
                      <button
                        className="button button--ghost"
                        disabled={alertMutation.isPending}
                        onClick={() =>
                          alertMutation.mutate({
                            alertId: alert.id,
                            status: "acknowledged",
                          })
                        }
                        type="button"
                      >
                        Acknowledge
                      </button>
                    ) : null}
                    {alert.status !== "resolved" ? (
                      <button
                        className="button button--teal"
                        disabled={alertMutation.isPending}
                        onClick={() =>
                          alertMutation.mutate({
                            alertId: alert.id,
                            status: "resolved",
                          })
                        }
                        type="button"
                      >
                        Resolve
                      </button>
                    ) : (
                      <span className="tone-chip tone-chip--healthy">synced</span>
                    )}
                  </div>
                ),
              },
              {
                key: "time",
                header: "Timestamp",
                render: (alert) => formatTimestamp(alert.timestamp),
              },
            ]}
          />
        </SectionCard>

        <SectionCard
          eyebrow="Response"
          title="Suggested actions"
          description="Alert suggestions can hand off cleanly into automation runs or config review."
        >
          <ActivityFeed
            items={filteredAlerts.slice(0, 6).map((alert) => ({
              id: alert.id,
              title: alert.deviceName,
              subtitle: alert.suggestedAction,
              meta: formatTimestamp(alert.timestamp),
              tone: alert.severity === "critical" ? "critical" : alert.severity,
            }))}
          />
        </SectionCard>
      </section>
    </div>
  );
}
