import { Link } from "react-router-dom";
import { ActivityFeed } from "../components/ActivityFeed";
import { DataTable } from "../components/DataTable";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { ProgressBar } from "../components/ProgressBar";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { WelcomePanel } from "../components/WelcomePanel";
import { BarListChart } from "../components/charts/BarListChart";
import { DonutChart } from "../components/charts/DonutChart";
import { SparklineChart } from "../components/charts/SparklineChart";
import { useAlertStore } from "../stores/alertStore";
import { useDeviceStore } from "../stores/deviceStore";
import { useIncidentStore } from "../stores/incidentStore";
import {
  aggregateMetricHistory,
  average,
  formatLatency,
  formatPercent,
  formatTimestamp,
  minutesAgo,
  sortDevicesByRisk,
} from "../lib/utils";

export function DashboardPage() {
  const devices = useDeviceStore((state) => state.devices);
  const telemetry = useDeviceStore((state) => state.telemetry);
  const alerts = useAlertStore((state) => state.alerts);
  const incidents = useIncidentStore((state) => state.incidents);

  const healthyCount = devices.filter((device) => device.status === "healthy").length;
  const onlineCount = devices.filter((device) => device.status !== "offline").length;
  const offlineCount = devices.filter((device) => device.status === "offline").length;
  const openAlerts = alerts.filter((alert) => alert.status === "open");
  const openIncidents = incidents.filter((incident) => incident.status !== "resolved");
  const averageLatency = average(devices.map((device) => device.latencyMs));
  const reliabilityScore = average(devices.map((device) => device.reliabilityScore));

  const aggregateCpu = aggregateMetricHistory(telemetry, "cpu");
  const aggregateLatency = aggregateMetricHistory(telemetry, "latencyMs");
  const aggregatePacketLoss = aggregateMetricHistory(telemetry, "packetLossPercent");
  const riskyDevices = sortDevicesByRisk(devices).slice(0, 5);
  const driftedDevices = devices.filter((device) => device.configDrift).length;
  const warningCount = devices.filter((device) => device.status === "warning").length;
  const degradedCount = devices.filter((device) => device.status === "degraded").length;
  const criticalCount = devices.filter(
    (device) => device.status === "critical" || device.status === "offline",
  ).length;
  const criticalAlertCount = alerts.filter((alert) => alert.severity === "critical").length;
  const devicesAbovePacketLossThreshold = devices.filter(
    (device) => device.packetLossPercent > 2,
  ).length;
  const devicesAboveLatencyThreshold = devices.filter(
    (device) => device.latencyMs >= 120,
  ).length;
  const latestHeartbeat = devices.reduce<string | null>((latest, device) => {
    if (!latest) {
      return device.lastHeartbeat;
    }
    return new Date(device.lastHeartbeat).getTime() > new Date(latest).getTime()
      ? device.lastHeartbeat
      : latest;
  }, null);
  const executiveTone =
    criticalAlertCount > 0 || criticalCount > 0
      ? "critical"
      : openIncidents.length > 0 || warningCount > 0 || degradedCount > 0
        ? "warning"
        : "healthy";

  const deviceStatusSegments = [
    {
      label: "Healthy",
      value: healthyCount,
      tone: "healthy" as const,
      description: "Operating within normal latency and packet-loss thresholds.",
    },
    {
      label: "Warning",
      value: warningCount,
      tone: "warning" as const,
      description: "Showing early pressure that may need operator attention soon.",
    },
    {
      label: "Degraded",
      value: degradedCount,
      tone: "degraded" as const,
      description: "Still reachable, but path quality or load is trending the wrong way.",
    },
    {
      label: "Critical",
      value: devices.filter((device) => device.status === "critical").length,
      tone: "critical" as const,
      description: "Actively impacting service quality or remediation flow.",
    },
    {
      label: "Offline",
      value: devices.filter((device) => device.status === "offline").length,
      tone: "info" as const,
      description: "No recent heartbeat, so the device likely needs recovery handling.",
    },
  ];

  const alertPressure = [
    {
      label: "Critical alerts",
      value: alerts.filter((alert) => alert.severity === "critical").length,
      valueLabel: `${alerts.filter((alert) => alert.severity === "critical").length} live`,
      tone: "critical" as const,
      description: "Signals that typically map to active incidents or immediate triage.",
    },
    {
      label: "Warning alerts",
      value: alerts.filter((alert) => alert.severity === "warning").length,
      valueLabel: `${alerts.filter((alert) => alert.severity === "warning").length} live`,
      tone: "warning" as const,
      description: "Useful for catching instability before it becomes customer-impacting.",
    },
    {
      label: "Informational alerts",
      value: alerts.filter((alert) => alert.severity === "info").length,
      valueLabel: `${alerts.filter((alert) => alert.severity === "info").length} live`,
      tone: "info" as const,
      description: "Low-urgency notices that round out the detection picture.",
    },
  ];

  const serviceCohorts = [
    {
      label: "Core backbone",
      value: average(
        devices
          .filter((device) => device.group === "Core Backbone")
          .map((device) => device.uptimePercent),
      ),
      valueLabel: formatPercent(
        average(
          devices
            .filter((device) => device.group === "Core Backbone")
            .map((device) => device.uptimePercent),
        ),
        1,
      ),
      tone: "healthy" as const,
      description: "Backbone routers and switches that anchor the rest of the estate.",
    },
    {
      label: "Regional edge",
      value: average(
        devices
          .filter((device) => device.group === "Regional Edge")
          .map((device) => device.uptimePercent),
      ),
      valueLabel: formatPercent(
        average(
          devices
            .filter((device) => device.group === "Regional Edge")
            .map((device) => device.uptimePercent),
        ),
        1,
      ),
      tone: "degraded" as const,
      description: "Regional aggregation and branch-edge segments carrying distributed traffic.",
    },
    {
      label: "Wireless footprint",
      value: average(
        devices
          .filter((device) => device.type === "access-point")
          .map((device) => device.uptimePercent),
      ),
      valueLabel: formatPercent(
        average(
          devices
            .filter((device) => device.type === "access-point")
            .map((device) => device.uptimePercent),
        ),
        1,
      ),
      tone: "warning" as const,
      description: "Access-layer wireless nodes that tend to reveal congestion first.",
    },
  ];

  const responseFeedItems = [
    ...openAlerts.slice(0, 3).map((alert) => ({
      id: alert.id,
      title: `${alert.deviceName}: ${alert.reason}`,
      subtitle: alert.suggestedAction,
      meta: minutesAgo(alert.timestamp),
      tone: alert.severity === "critical" ? "critical" : alert.severity,
    })),
    ...openIncidents.slice(0, 2).map((incident) => ({
      id: incident.id,
      title: incident.title,
      subtitle: incident.summary,
      meta: minutesAgo(incident.updatedAt),
      tone: incident.severity === "critical" ? "critical" : incident.severity,
    })),
  ];

  const timelineItems = openIncidents.flatMap((incident) =>
    incident.timeline.slice(0, 2).map((event) => ({
      ...event,
      incidentTitle: incident.title,
    })),
  );

  return (
    <div className="page-grid">
      <WelcomePanel />
      <PageHeader
        eyebrow="Overview"
        title="Network Operations Command"
        description="A professional control view for live network posture, active risk, and recovery readiness across the monitored estate."
        actions={
          <div className="inline-actions">
            <Link className="button button--ghost" to="/topology">
              View topology
            </Link>
            <Link className="button button--ghost" to="/reports">
              View reports
            </Link>
            <Link className="button button--teal" to="/automation">
              Launch workflow
            </Link>
          </div>
        }
      />

      <section className="split-grid split-grid--hero">
        <SectionCard
          eyebrow="Executive Brief"
          title="Current operating picture"
          description="This summary condenses availability, incident pressure, and configuration exposure into a single command brief for fast decision-making."
        >
          <div className="command-brief">
            <div className="command-brief__headline">
              <span className={`tone-chip tone-chip--${executiveTone}`}>{executiveTone}</span>
              <strong>
                {criticalAlertCount > 0 || criticalCount > 0
                  ? "Immediate service pressure is present."
                  : openIncidents.length > 0 || warningCount > 0 || degradedCount > 0
                    ? "The estate is stable, but requires attention."
                    : "The estate is operating within expected thresholds."}
              </strong>
            </div>
            <p className="command-brief__copy">
              The dashboard is correlating live telemetry, alert severity, config drift, and
              incident activity to show where operators should focus first and whether recovery
              automation can be applied safely.
            </p>
            <div className="command-brief__grid">
              <article className="brief-stat">
                <span className="brief-stat__label">Availability</span>
                <strong>{onlineCount}/{devices.length}</strong>
                <p>
                  Devices currently online and still participating in the monitoring plane.
                </p>
              </article>
              <article className="brief-stat">
                <span className="brief-stat__label">Escalation Queue</span>
                <strong>{openIncidents.length + openAlerts.length}</strong>
                <p>
                  Open incidents and unresolved alerts competing for operator attention.
                </p>
              </article>
              <article className="brief-stat">
                <span className="brief-stat__label">Config Exposure</span>
                <strong>{driftedDevices}</strong>
                <p>
                  Devices whose live state no longer matches the approved baseline cleanly.
                </p>
              </article>
              <article className="brief-stat">
                <span className="brief-stat__label">Telemetry Freshness</span>
                <strong>{latestHeartbeat ? minutesAgo(latestHeartbeat) : "waiting"}</strong>
                <p>
                  Indicates how recently the platform observed a fresh device heartbeat or sample.
                </p>
              </article>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Fleet Health"
          title="Device state composition"
          description="A ring view of the current estate, showing how far the platform has shifted away from healthy baseline behavior."
        >
          <DonutChart
            segments={deviceStatusSegments}
            valueLabel="Monitored devices"
            value={`${devices.length}`}
          />
        </SectionCard>
      </section>

      <section className="kpi-grid">
        <MetricCard
          label="Availability"
          value={`${onlineCount}/${devices.length}`}
          delta={`${healthyCount} healthy`}
          detail="active telemetry coverage"
          tone="healthy"
          visual={
            <SparklineChart
              ariaLabel="Fleet CPU trend"
              tone="healthy"
              values={aggregateCpu}
            />
          }
          caption="This card tracks fleet coverage and overlays aggregate CPU activity to reveal whether the network is warming up or settling down."
        />
        <MetricCard
          label="Alert Load"
          value={`${openAlerts.length}`}
          delta={`${criticalAlertCount} critical`}
          detail="requires triage"
          tone={criticalAlertCount > 0 ? "critical" : "warning"}
          visual={
            <SparklineChart
              ariaLabel="Packet loss trend"
              tone={criticalAlertCount > 0 ? "critical" : "warning"}
              values={aggregatePacketLoss}
            />
          }
          caption="The embedded trend follows packet-loss pressure, which often precedes alert storms, incident escalation, and rollback decisions."
        />
        <MetricCard
          label="Latency"
          value={formatLatency(averageLatency)}
          delta={`${degradedCount} degraded links`}
          detail="fleet average"
          tone={averageLatency > 140 ? "warning" : "healthy"}
          visual={
            <SparklineChart
              ariaLabel="Latency trend"
              tone={averageLatency > 140 ? "warning" : "healthy"}
              values={aggregateLatency}
            />
          }
          caption="This visualization summarizes path-quality drift so operators can intervene before user-facing services hard-fail."
        />
        <MetricCard
          label="Reliability"
          value={formatPercent(reliabilityScore)}
          delta={`${openIncidents.length} active incidents`}
          detail="service posture"
          tone={reliabilityScore < 88 ? "warning" : "healthy"}
          visual={<ProgressBar value={reliabilityScore} />}
          caption="A composite service-health score blending uptime, health, and packet loss into one executive posture indicator."
        />
      </section>

      <section className="split-grid">
        <SectionCard
          eyebrow="Priority Queue"
          title="Immediate remediation candidates"
          description="The table below surfaces the devices most likely to need operator action because of low health, elevated latency, or heartbeat loss."
        >
          <DataTable
            rows={riskyDevices}
            getRowKey={(device) => device.id}
            columns={[
              {
                key: "name",
                header: "Device",
                render: (device) => (
                  <div>
                    <strong>{device.name}</strong>
                    <div className="small-text muted-text">{device.location}</div>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (device) => <StatusBadge label={device.status} />,
              },
              {
                key: "health",
                header: "Health",
                render: (device) => (
                  <div>
                    <strong>{device.healthScore}</strong>
                    <ProgressBar value={device.healthScore} />
                  </div>
                ),
              },
              {
                key: "latency",
                header: "Latency",
                render: (device) => formatLatency(device.latencyMs),
              },
              {
                key: "drift",
                header: "Config",
                render: (device) => (
                  <StatusBadge
                    label={device.configDrift ? "drift" : "aligned"}
                    tone={device.configDrift ? "warning" : "healthy"}
                  />
                ),
              },
              {
                key: "action",
                header: "Action",
                render: (device) => (
                  <Link className="button button--ghost" to={`/devices/${device.id}`}>
                    Inspect
                  </Link>
                ),
              },
            ]}
          />
        </SectionCard>

        <SectionCard
          eyebrow="Signal Pressure"
          title="Alert load by severity"
          description="These bars show whether the monitored estate is experiencing routine watchlist activity or incident-grade pressure."
        >
          <BarListChart items={alertPressure} />
          <div className="chart-caption">
            Longer bars indicate which severity band is consuming the most operator attention right now.
          </div>
        </SectionCard>
      </section>

      <section className="three-column-grid">
        <SectionCard
          eyebrow="Telemetry"
          title="CPU utilization trend"
          description="Fleet-wide aggregate across recent telemetry windows, used to detect load concentration before devices fall into warning or critical states."
        >
          <SparklineChart ariaLabel="Aggregate CPU pressure" tone="healthy" values={aggregateCpu} />
          <div className="chart-caption">
            Latest sample updated {latestHeartbeat ? minutesAgo(latestHeartbeat) : "recently"}.
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Telemetry"
          title="Latency watch"
          description="Latency trends are useful for spotting path quality degradation even before hard outages show up in the estate."
        >
          <SparklineChart
            ariaLabel="Aggregate latency watch"
            tone={devicesAboveLatencyThreshold > 0 ? "warning" : "healthy"}
            values={aggregateLatency}
          />
          <div className="chart-caption">
            {devicesAboveLatencyThreshold} devices are above the warning latency threshold.
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Telemetry"
          title="Packet-loss watch"
          description="Packet-loss spikes can trigger incident creation, config validation, or rollback workflows depending on sustained severity."
        >
          <SparklineChart
            ariaLabel="Aggregate packet loss profile"
            tone={aggregatePacketLoss.some((value) => value > 3) ? "critical" : "warning"}
            values={aggregatePacketLoss}
          />
          <div className="chart-caption">
            {devicesAbovePacketLossThreshold} devices are above the warning packet-loss threshold.
          </div>
        </SectionCard>
      </section>

      <section className="split-grid">
        <SectionCard
          eyebrow="Service Assurance"
          title="Stability by device cohort"
          description="Each bar compares average uptime across the main infrastructure cohorts so weak segments stand out quickly."
        >
          <BarListChart items={serviceCohorts} maxValue={100} />
          <div className="chart-caption">
            This comparison helps explain whether risk is concentrated in the core, the edge, or the wireless access layer.
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Response Stream"
          title="Detection to action"
          description="A concise live feed of what the platform is detecting and the action path it is recommending to the operator."
        >
          <ActivityFeed items={responseFeedItems} />
        </SectionCard>
      </section>

      <section className="split-grid" id="dashboard-guide">
        <SectionCard
          eyebrow="Operator Guidance"
          title="How to read this command view"
          description="The structure is intentionally organized from posture, to pressure, to response so operators can move from understanding to action quickly."
        >
          <div className="stack">
            <div className="surface-card surface-card--inset">
              <strong>Posture first</strong>
              <div className="small-text muted-text">
                The hero summary and KPI strip answer whether the estate is healthy, overloaded, or drifting away from safe baselines.
              </div>
            </div>
            <div className="surface-card surface-card--inset">
              <strong>Pressure second</strong>
              <div className="small-text muted-text">
                Priority queues, alert distributions, and telemetry trends show where risk is concentrating and which devices deserve immediate review.
              </div>
            </div>
            <div className="surface-card surface-card--inset">
              <strong>Response third</strong>
              <div className="small-text muted-text">
                Cohort stability, live feed, and incident milestones help decide whether to inspect manually, escalate, or trigger automation.
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Incident Milestones"
          title="Latest recovery checkpoints"
          description="Recent incident events, ordered to show how the response path is progressing through investigation, mitigation, and resolution."
        >
          {timelineItems.length > 0 ? (
            <div className="timeline">
              {timelineItems.map((event) => (
                <div className="timeline__item" key={event.id}>
                  <div className="timeline__time">{formatTimestamp(event.timestamp)}</div>
                  <strong>{event.incidentTitle}</strong>
                  <div className="muted-text">{event.title}</div>
                  <div className="small-text muted-text">{event.detail}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No active incident checkpoints right now. The recovery queue is currently quiet.
            </div>
          )}
        </SectionCard>
      </section>
    </div>
  );
}
