import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ActivityFeed } from "../components/ActivityFeed";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { SparklineChart } from "../components/charts/SparklineChart";
import { getDashboardDeviceBundle, listRuns } from "../lib/api";
import {
  diffConfigLines,
  formatBandwidth,
  formatDeviceType,
  formatLatency,
  formatPercent,
  formatTimestamp,
} from "../lib/utils";
import { useAlertStore } from "../stores/alertStore";

export function DeviceDetailPage() {
  const { deviceId = "" } = useParams();
  const alerts = useAlertStore((state) => state.alerts);
  const bundleQuery = useQuery({
    queryKey: ["device-bundle", deviceId],
    queryFn: () => getDashboardDeviceBundle(deviceId),
    enabled: Boolean(deviceId),
  });
  const runsQuery = useQuery({
    queryKey: ["runs"],
    queryFn: listRuns,
  });

  if (bundleQuery.isPending || !bundleQuery.data) {
    return <div className="surface-card empty-state">Loading device detail...</div>;
  }

  const { device, metrics, config } = bundleQuery.data;
  const deviceAlerts = alerts.filter((alert) => alert.deviceId === device.id).slice(0, 4);
  const deviceRuns =
    runsQuery.data?.filter((run) => run.deviceName === device.name).slice(0, 4) ?? [];
  const configDiff = diffConfigLines(config.baselineConfig, config.currentConfig);

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Device detail"
        title={device.name}
        description={`${formatDeviceType(device.type)} at ${device.location}. This page follows the plan's per-device CPU, memory, latency, packet loss, bandwidth, alerts, config status, and automation history view.`}
        actions={
          <div className="inline-actions">
            <StatusBadge label={device.status} />
            <Link
              className="button button--ghost"
              to={`/configs?deviceId=${device.id}`}
            >
              Review config
            </Link>
            <Link
              className="button button--teal"
              to={`/automation?deviceId=${device.id}&workflow=auto_recovery_offline`}
            >
              Trigger recovery
            </Link>
            <Link className="button button--ghost" to="/devices">
              Back to inventory
            </Link>
          </div>
        }
      />

      <section className="kpi-grid" id="telemetry">
        <MetricCard
          label="CPU"
          value={formatPercent(device.cpu)}
          delta={`Health ${device.healthScore}`}
          detail="current load"
          tone={device.cpu >= 90 ? "critical" : device.cpu >= 75 ? "warning" : "healthy"}
          visual={<SparklineChart values={metrics.map((sample) => sample.cpu)} />}
        />
        <MetricCard
          label="Memory"
          value={formatPercent(device.memory)}
          delta={`${device.firmwareVersion}`}
          detail="resident pressure"
          tone={device.memory >= 92 ? "critical" : device.memory >= 80 ? "warning" : "healthy"}
          visual={<SparklineChart values={metrics.map((sample) => sample.memory)} />}
        />
        <MetricCard
          label="Latency"
          value={formatLatency(device.latencyMs)}
          delta={`${device.ipAddress}`}
          detail="path quality"
          tone={device.latencyMs >= 200 ? "critical" : device.latencyMs >= 120 ? "warning" : "healthy"}
          visual={<SparklineChart values={metrics.map((sample) => sample.latencyMs)} />}
        />
        <MetricCard
          label="Packet loss"
          value={formatPercent(device.packetLossPercent, 1)}
          delta={device.configDrift ? "drift detected" : "config compliant"}
          detail="loss rate"
          tone={
            device.packetLossPercent >= 5
              ? "critical"
              : device.packetLossPercent >= 2
                ? "warning"
                : "healthy"
          }
          visual={
            <SparklineChart
              values={metrics.map((sample) => sample.packetLossPercent)}
            />
          }
        />
        <MetricCard
          label="Bandwidth"
          value={formatBandwidth(device.bandwidthMbps)}
          delta={formatPercent(device.reliabilityScore)}
          detail="throughput"
          tone="degraded"
          visual={<SparklineChart values={metrics.map((sample) => sample.bandwidthMbps)} />}
        />
      </section>

      <section className="split-grid">
        <SectionCard
          eyebrow="Signals"
          title="Recent alerts"
          description="Most recent advisory and critical events connected to this device."
        >
          <ActivityFeed
            items={deviceAlerts.map((alert) => ({
              id: alert.id,
              title: alert.reason,
              subtitle: alert.suggestedAction,
              meta: formatTimestamp(alert.timestamp),
              tone: alert.severity === "critical" ? "critical" : alert.severity,
            }))}
            emptyLabel="No active alert history for this device."
          />
        </SectionCard>

        <SectionCard
          eyebrow="Automation"
          title="Run history"
          description="Recovery actions and workflow traces for this device."
        >
          <ActivityFeed
            items={deviceRuns.map((run) => ({
              id: run.id,
              title: run.workflowName,
              subtitle: run.result,
              meta: formatTimestamp(run.startedAt),
              tone:
                run.status === "failed"
                  ? "critical"
                  : run.status === "running"
                    ? "warning"
                    : run.status === "queued"
                      ? "info"
                      : "healthy",
            }))}
            emptyLabel="No workflow history for this device yet."
          />
        </SectionCard>
      </section>

      <SectionCard
        eyebrow="Configuration"
        title={`Config status: ${config.driftStatus}`}
        description="Baseline and current config are shown side-by-side to support drift review and rollback planning."
      >
        <div className="config-grid">
          <div className="config-block">
            {configDiff.map((line, index) => (
              <span
                key={`baseline-${index}`}
                className={`code-line ${line.changed ? "code-line--changed" : ""} ${line.left ? "" : "code-line--muted"}`}
              >
                {line.left || " "}
              </span>
            ))}
          </div>
          <div className="config-block">
            {configDiff.map((line, index) => (
              <span
                key={`current-${index}`}
                className={`code-line ${line.changed ? "code-line--changed" : ""} ${line.right ? "" : "code-line--muted"}`}
              >
                {line.right || " "}
              </span>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
