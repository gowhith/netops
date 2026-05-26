import { useQuery } from "@tanstack/react-query";
import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { listSettings } from "../lib/api";
import { formatPercent } from "../lib/utils";

export function SettingsPage() {
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: listSettings,
  });

  if (!settingsQuery.data) {
    return <div className="surface-card empty-state">Loading settings...</div>;
  }

  const settings = settingsQuery.data;

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Settings"
        title="Admin and policy settings"
        description="Users, thresholds, notifications, and device groups from the backend settings snapshot. This page is read-only because the backend currently exposes GET /api/settings only."
        actions={<span className="tone-chip tone-chip--warning">backend read-only</span>}
      />

      <section className="two-column-grid">
        <SectionCard
          eyebrow="Access"
          title="Users and roles"
          description="Role coverage for admin, engineer, and viewer experiences."
        >
          <DataTable
            rows={settings.users}
            getRowKey={(user) => user.id}
            columns={[
              {
                key: "name",
                header: "User",
                render: (user) => (
                  <div>
                    <strong>{user.name}</strong>
                    <div className="small-text muted-text">{user.email}</div>
                  </div>
                ),
              },
              {
                key: "role",
                header: "Role",
                render: (user) => <StatusBadge label={user.role} tone="info" />,
              },
              {
                key: "timezone",
                header: "Timezone",
                render: (user) => user.timezone,
              },
            ]}
          />
        </SectionCard>

        <SectionCard
          eyebrow="Thresholds"
          title="Alert policies"
          description="These values mirror the active backend rule configuration."
        >
          <div className="stack">
            <div className="metric-card__subline">
              <span>CPU warning / critical</span>
              <strong>
                {formatPercent(settings.alertThresholds.cpuWarning)} /{" "}
                {formatPercent(settings.alertThresholds.cpuCritical)}
              </strong>
            </div>
            <div className="metric-card__subline">
              <span>Latency warning / critical</span>
              <strong>
                {settings.alertThresholds.latencyWarning} ms /{" "}
                {settings.alertThresholds.latencyCritical} ms
              </strong>
            </div>
            <div className="metric-card__subline">
              <span>Packet loss warning / critical</span>
              <strong>
                {formatPercent(settings.alertThresholds.packetLossWarning, 1)} /{" "}
                {formatPercent(settings.alertThresholds.packetLossCritical, 1)}
              </strong>
            </div>
            <div className="muted-text small-text">
              Current policy preview: CPU {formatPercent(settings.alertThresholds.cpuWarning)} /{" "}
              {formatPercent(settings.alertThresholds.cpuCritical)}, latency{" "}
              {settings.alertThresholds.latencyWarning} ms /{" "}
              {settings.alertThresholds.latencyCritical} ms, packet loss{" "}
              {formatPercent(settings.alertThresholds.packetLossWarning, 1)} /{" "}
              {formatPercent(settings.alertThresholds.packetLossCritical, 1)}.
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="two-column-grid">
        <SectionCard
          eyebrow="Notifications"
          title="Notification channels"
          description="Email, webhook, and collaboration feeds returned by the backend."
        >
          <div className="stack">
            {settings.notificationChannels.map((channel) => (
              <div className="activity-feed__item" key={channel.id}>
                <StatusBadge
                  label={channel.enabled ? "enabled" : "disabled"}
                  tone={channel.enabled ? "healthy" : "critical"}
                />
                <div>
                  <strong>{channel.type}</strong>
                  <div className="small-text muted-text">{channel.target}</div>
                </div>
                <span className="small-text muted-text">backend snapshot</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Segmentation"
          title="Device groups"
          description="Operational groupings for dashboards, alerts, and compliance reports."
        >
          <div className="pill-row">
            {settings.deviceGroups.map((group) => (
              <span className="pill" key={group}>
                {group}
              </span>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
