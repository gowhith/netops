import type { Alert } from "../types/alert";
import type { Device, DeviceStatus } from "../types/device";
import type { Incident } from "../types/incident";
import type { Severity } from "../types/common";
import type { TelemetrySample } from "../types/telemetry";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

export function formatLatency(value: number) {
  return `${Math.round(value)} ms`;
}

export function formatBandwidth(value: number) {
  return `${Math.round(value)} Mbps`;
}

export function formatTimestamp(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function minutesAgo(value: string) {
  const deltaMinutes = Math.round(
    (Date.now() - new Date(value).getTime()) / 60_000,
  );

  if (deltaMinutes <= 0) {
    return "just now";
  }

  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const hours = Math.floor(deltaMinutes / 60);
  const minutes = deltaMinutes % 60;
  return `${hours}h ${minutes}m ago`;
}

export function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function severityClassName(severity: Severity) {
  return `status-badge--${severity}`;
}

export function statusClassName(status: DeviceStatus | string) {
  return `status-badge--${status}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function inferDeviceStatus(sample: Pick<TelemetrySample, "cpu" | "latencyMs" | "packetLossPercent">): DeviceStatus {
  if (sample.packetLossPercent >= 5 || sample.latencyMs >= 240 || sample.cpu >= 92) {
    return "critical";
  }

  if (sample.packetLossPercent >= 2 || sample.latencyMs >= 120 || sample.cpu >= 75) {
    return "warning";
  }

  if (sample.latencyMs >= 90) {
    return "degraded";
  }

  return "healthy";
}

export function calculateHealthScore(sample: Pick<TelemetrySample, "cpu" | "memory" | "latencyMs" | "packetLossPercent">) {
  const cpuPenalty = sample.cpu * 0.25;
  const memoryPenalty = sample.memory * 0.18;
  const latencyPenalty = sample.latencyMs * 0.12;
  const packetPenalty = sample.packetLossPercent * 7.5;
  return clamp(Math.round(100 - cpuPenalty - memoryPenalty - latencyPenalty - packetPenalty), 8, 100);
}

export function formatDeviceType(type: Device["type"]) {
  switch (type) {
    case "access-point":
      return "Access Point";
    case "edge-node":
      return "Edge Node";
    case "server":
      return "Server";
    default:
      return `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
  }
}

export function getSeverityTone(value: Severity | DeviceStatus) {
  if (value === "critical" || value === "offline") {
    return "critical";
  }

  if (value === "warning") {
    return "warning";
  }

  if (value === "degraded") {
    return "degraded";
  }

  if (value === "info") {
    return "info";
  }

  return "healthy";
}

export function aggregateMetricHistory(
  histories: Record<string, TelemetrySample[]>,
  key: keyof Pick<
    TelemetrySample,
    "cpu" | "memory" | "latencyMs" | "packetLossPercent" | "bandwidthMbps"
  >,
) {
  const deviceIds = Object.keys(histories);
  if (deviceIds.length === 0) {
    return [];
  }

  const longest = Math.max(...deviceIds.map((deviceId) => histories[deviceId]?.length ?? 0));

  return Array.from({ length: longest }, (_, index) => {
    const values = deviceIds
      .map((deviceId) => histories[deviceId]?.[index]?.[key])
      .filter((value): value is number => typeof value === "number");
    return average(values);
  });
}

export function sortDevicesByRisk(devices: Device[]) {
  return [...devices].sort((left, right) => left.healthScore - right.healthScore);
}

export function sortAlerts(alerts: Alert[]) {
  return [...alerts].sort(
    (left, right) =>
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
}

export function sortIncidents(incidents: Incident[]) {
  return [...incidents].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export function diffConfigLines(left: string, right: string) {
  const leftLines = left.trim().split("\n");
  const rightLines = right.trim().split("\n");
  const maxLines = Math.max(leftLines.length, rightLines.length);

  return Array.from({ length: maxLines }, (_, index) => ({
    left: leftLines[index] ?? "",
    right: rightLines[index] ?? "",
    changed: (leftLines[index] ?? "") !== (rightLines[index] ?? ""),
  }));
}
