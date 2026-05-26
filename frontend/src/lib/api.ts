import {
  alerts as mockAlerts,
  configs as mockConfigs,
  devices as mockDevices,
  incidents as mockIncidents,
  mockBootstrapData,
  reports as mockReports,
  runs as mockRuns,
  settings as mockSettings,
  telemetryHistory as mockTelemetryHistory,
  workflows as mockWorkflows,
} from "../data/mockData";
import { clearAccessToken, ensureAccessToken } from "./auth";
import type { Alert } from "../types/alert";
import type { AlertStatus } from "../types/alert";
import type { AutomationRun, AutomationWorkflow } from "../types/automation";
import type { DeviceConfigSnapshot } from "../types/config";
import type { DashboardBootstrap } from "../types/dashboard";
import type { Device, DeviceStatus, DeviceType } from "../types/device";
import type { Incident } from "../types/incident";
import type { IncidentStatus } from "../types/incident";
import type { ReportTemplate } from "../types/report";
import type { AppSettings } from "../types/settings";
import type { TelemetrySample } from "../types/telemetry";
import type { TopologyEdge, TopologyNode } from "../types/topology";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8020/api";

interface BackendDevice {
  id: number;
  device_id: string;
  name: string;
  device_type: string;
  location: string | null;
  ip_address: string | null;
  firmware: string | null;
  vendor: string | null;
  group_name: string | null;
  status: string;
  health_score: number;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendTelemetry {
  time: string;
  device_id: string;
  cpu_percent: number | null;
  memory_percent: number | null;
  latency_ms: number | null;
  packet_loss_percent: number | null;
  bandwidth_mbps: number | null;
  health_score: number | null;
  interface_status: string | null;
  health_status: string | null;
}

interface BackendAlert {
  id: number;
  device_id: string;
  rule: string;
  severity: string;
  status: string;
  message: string;
  metric_value: number | null;
  threshold: number | null;
  created_at: string;
  resolved_at: string | null;
}

interface BackendIncident {
  id: number;
  device_id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  root_cause: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface BackendIncidentEvent {
  id: number;
  incident_id: number;
  event_type: string;
  message: string;
  actor: string | null;
  created_at: string;
}

interface BackendIncidentTimeline {
  incident: BackendIncident;
  events: BackendIncidentEvent[];
}

interface BackendConfig {
  device_id: string;
  baseline_config: Record<string, unknown>;
  current_config: Record<string, unknown>;
  drift_detected: boolean;
  last_checked_at: string | null;
  updated_at: string;
}

interface BackendConfigVersion {
  id: number;
  device_id: string;
  version: number;
  config: Record<string, unknown>;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

interface BackendDriftReport {
  device_id: string;
  drift_detected: boolean;
  differences: Record<string, unknown>;
  baseline_version?: number | null;
  checked_at: string;
}

interface BackendConfigValidation {
  device_id: string;
  compliant: boolean;
  drift_detected: boolean;
  differences: Record<string, unknown>;
  checked_at: string;
}

interface BackendWorkflow {
  id: number;
  name: string;
  description: string | null;
  trigger: string;
  actions: Array<Record<string, unknown>>;
  enabled: boolean;
  created_at: string;
}

interface BackendRun {
  id: number;
  workflow_id: number;
  device_id: string | null;
  incident_id: number | null;
  status: string;
  log: Array<Record<string, unknown>>;
  started_at: string;
  finished_at: string | null;
}

interface BackendUptimeReport {
  hours: number;
  devices: Array<{
    device_id: string;
    name: string;
    samples: number;
    offline_samples: number;
    uptime_pct: number;
    current_status: string;
  }>;
}

interface BackendSlaReport {
  hours: number;
  total_incidents: number;
  open_incidents: number;
  resolved_incidents: number;
  mttr_seconds: number;
}

interface BackendComplianceReport {
  total_devices_with_config: number;
  drift_detected: number;
  compliant: number;
  compliance_pct: number;
  drifted_devices: string[];
}

interface BackendSettings {
  users: Array<{
    id: number;
    username: string;
    email: string;
    role: "admin" | "engineer" | "viewer";
    is_active: boolean;
    created_at: string;
  }>;
  alert_thresholds: {
    cpu_warning: number;
    cpu_critical: number;
    latency_warning_ms: number;
    latency_critical_ms: number;
    packet_loss_warning: number;
    packet_loss_critical: number;
  };
  notification_channels: Array<{
    id: string;
    type: "email" | "webhook" | "slack";
    target: string;
    enabled: boolean;
  }>;
  device_groups: string[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function wait(ms = 220) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalizeDeviceType(type: string | null | undefined): DeviceType {
  switch ((type ?? "").toLowerCase()) {
    case "ap":
      return "access-point";
    case "edge":
      return "edge-node";
    case "server":
      return "server";
    case "switch":
      return "switch";
    default:
      return "router";
  }
}

function normalizeDeviceStatus(status: string | null | undefined): DeviceStatus {
  switch ((status ?? "").toLowerCase()) {
    case "healthy":
      return "healthy";
    case "warning":
      return "warning";
    case "critical":
      return "critical";
    case "offline":
      return "offline";
    case "degraded":
    case "unknown":
    default:
      return "degraded";
  }
}

function normalizeSeverity(
  severity: string | null | undefined,
): "info" | "warning" | "critical" {
  switch ((severity ?? "").toLowerCase()) {
    case "critical":
    case "high":
      return "critical";
    case "warning":
    case "medium":
      return "warning";
    default:
      return "info";
  }
}

function normalizeAlertStatus(status: string | null | undefined) {
  switch ((status ?? "").toLowerCase()) {
    case "acknowledged":
      return "acknowledged" as const;
    case "resolved":
      return "resolved" as const;
    case "active":
    default:
      return "open" as const;
  }
}

function normalizeIncidentStatus(status: string | null | undefined) {
  switch ((status ?? "").toLowerCase()) {
    case "investigating":
      return "investigating" as const;
    case "mitigated":
      return "mitigated" as const;
    case "resolved":
      return "resolved" as const;
    default:
      return "open" as const;
  }
}

function normalizeRunStatus(status: string | null | undefined) {
  switch ((status ?? "").toLowerCase()) {
    case "pending":
      return "queued" as const;
    case "running":
      return "running" as const;
    case "failed":
      return "failed" as const;
    default:
      return "success" as const;
  }
}

function toJsonBlock(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function countDiffEntries(value: unknown): number {
  if (!value || typeof value !== "object") {
    return 0;
  }

  const entries = Object.values(value as Record<string, unknown>);
  if (entries.length === 0) {
    return 0;
  }

  return entries.reduce<number>((count, entry) => {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      return count + Math.max(1, countDiffEntries(entry));
    }
    return count + 1;
  }, 0);
}

function deriveSuggestedAction(alert: BackendAlert) {
  const rule = alert.rule.toLowerCase();
  if (rule.includes("packet") || rule.includes("latency")) {
    return "Inspect path quality and consider rollback or isolation workflow.";
  }
  if (rule.includes("heartbeat") || rule.includes("offline")) {
    return "Restart the device workflow and confirm heartbeat recovery.";
  }
  if (rule.includes("config")) {
    return "Validate drift and compare against the approved baseline.";
  }
  return "Review telemetry, then escalate to incident or automation if sustained.";
}

function toBackendAlertStatus(status: AlertStatus) {
  switch (status) {
    case "acknowledged":
      return "acknowledged";
    case "resolved":
      return "resolved";
    default:
      return "active";
  }
}

function buildDevice(
  raw: BackendDevice,
  latest: BackendTelemetry | null,
  uptimePercent: number,
  configDrift: boolean,
): Device {
  const healthScore = Math.round(latest?.health_score ?? raw.health_score ?? 0);
  const packetLossPercent = latest?.packet_loss_percent ?? 0;
  const reliabilityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(uptimePercent * 0.58 + healthScore * 0.42 - packetLossPercent * 1.6),
    ),
  );

  return {
    id: raw.device_id,
    name: raw.name,
    type: normalizeDeviceType(raw.device_type),
    ipAddress: raw.ip_address ?? "Unassigned",
    location: raw.location ?? "Unknown location",
    group: raw.group_name ?? "Unassigned",
    model: raw.vendor ? `${raw.vendor} ${raw.device_type}` : raw.device_type,
    firmwareVersion: raw.firmware ?? "Unknown",
    status: normalizeDeviceStatus(latest?.health_status ?? raw.status),
    healthScore,
    reliabilityScore,
    uptimePercent,
    cpu: latest?.cpu_percent ?? 0,
    memory: latest?.memory_percent ?? 0,
    latencyMs: latest?.latency_ms ?? 0,
    packetLossPercent,
    bandwidthMbps: latest?.bandwidth_mbps ?? 0,
    configDrift,
    lastHeartbeat: raw.last_seen ?? latest?.time ?? raw.updated_at,
  };
}

function buildAlert(
  raw: BackendAlert,
  deviceIndex: Map<string, Device>,
): Alert {
  const device = deviceIndex.get(raw.device_id);
  return {
    id: String(raw.id),
    severity: normalizeSeverity(raw.severity),
    status: normalizeAlertStatus(raw.status),
    deviceId: raw.device_id,
    deviceName: device?.name ?? raw.device_id,
    reason: raw.message,
    suggestedAction: deriveSuggestedAction(raw),
    source: raw.rule,
    timestamp: raw.created_at,
  };
}

function buildIncident(
  raw: BackendIncident,
  timeline: BackendIncidentEvent[],
  deviceIndex: Map<string, Device>,
): Incident {
  const device = deviceIndex.get(raw.device_id);
  const affectedService =
    device?.group && device.group !== "Unassigned"
      ? device.group
      : device?.type === "access-point"
        ? "wireless-edge"
        : device?.type === "server"
          ? "host-monitoring"
          : "network-fabric";

  return {
    id: String(raw.id),
    title: raw.title,
    severity: normalizeSeverity(raw.severity),
    status: normalizeIncidentStatus(raw.status),
    deviceIds: [raw.device_id],
    affectedServices: [affectedService],
    rootCause: raw.root_cause ?? raw.description ?? "Awaiting root cause analysis",
    summary: raw.description ?? raw.root_cause ?? raw.title,
    openedAt: raw.created_at,
    updatedAt: raw.resolved_at ?? timeline[timeline.length - 1]?.created_at ?? raw.created_at,
    automationActions: timeline
      .filter((event) => (event.actor ?? "").includes("automation"))
      .map((event) => event.message),
    timeline: timeline.map((event) => ({
      id: String(event.id),
      timestamp: event.created_at,
      title: event.event_type.split("_").join(" "),
      detail: event.message,
    })),
  };
}

function buildConfigSnapshot(
  raw: BackendConfig,
  versions: BackendConfigVersion[],
  drift: BackendDriftReport,
): DeviceConfigSnapshot {
  const diffCount = countDiffEntries(drift.differences);
  return {
    deviceId: raw.device_id,
    driftStatus: drift.drift_detected ? "drift-detected" : "compliant",
    complianceScore: drift.drift_detected
      ? Math.max(40, 100 - diffCount * 12)
      : 100,
    baselineConfig: toJsonBlock(raw.baseline_config),
    currentConfig: toJsonBlock(raw.current_config),
    rollbackTarget: "baseline",
    versions: versions.map((version) => ({
      id: String(version.id),
      versionLabel: `v${version.version}`,
      author: version.changed_by ?? "system",
      createdAt: version.created_at,
      summary: version.reason ?? "Configuration snapshot",
    })),
  };
}

function workflowCategory(trigger: string) {
  if (trigger.includes("offline")) {
    return "Recovery";
  }
  if (trigger.includes("drift")) {
    return "Configuration";
  }
  return "Operations";
}

function buildWorkflow(
  raw: BackendWorkflow,
  runs: BackendRun[],
): AutomationWorkflow {
  const workflowRuns = runs.filter((run) => run.workflow_id === raw.id);
  const completedRuns = workflowRuns.filter(
    (run) => normalizeRunStatus(run.status) !== "running" && normalizeRunStatus(run.status) !== "queued",
  );
  const successCount = completedRuns.filter(
    (run) => normalizeRunStatus(run.status) === "success",
  ).length;
  const successRate =
    completedRuns.length > 0
      ? Math.round((successCount / completedRuns.length) * 100)
      : raw.enabled
        ? 100
        : 0;
  const averageDurationMinutes =
    workflowRuns.length > 0
      ? Math.max(
          1,
          Math.round(
            workflowRuns.reduce((total, run) => {
              if (!run.finished_at) {
                return total + 3;
              }
              return (
                total +
                Math.max(
                  1,
                  Math.round(
                    (new Date(run.finished_at).getTime() -
                      new Date(run.started_at).getTime()) /
                      60_000,
                  ),
                )
              );
            }, 0) / workflowRuns.length,
          ),
        )
      : Math.max(1, raw.actions.length * 2);
  const lastRun = workflowRuns[0];

  return {
    id: String(raw.id),
    name: raw.name,
    category: workflowCategory(raw.trigger),
    description: raw.description ?? "Automation workflow",
    triggers: [raw.trigger],
    recommended: raw.enabled,
    successRate,
    averageDurationMinutes,
    lastRunStatus: lastRun ? normalizeRunStatus(lastRun.status) : "queued",
  };
}

function buildRun(
  raw: BackendRun,
  workflowIndex: Map<number, BackendWorkflow>,
  deviceIndex: Map<string, Device>,
): AutomationRun {
  const workflow = workflowIndex.get(raw.workflow_id);
  const device = raw.device_id ? deviceIndex.get(raw.device_id) : undefined;
  const durationMinutes = raw.finished_at
    ? Math.max(
        1,
        Math.round(
          (new Date(raw.finished_at).getTime() - new Date(raw.started_at).getTime()) /
            60_000,
        ),
      )
    : Math.max(1, raw.log.length);

  return {
    id: String(raw.id),
    workflowId: String(raw.workflow_id),
    workflowName: workflow?.name ?? `Workflow ${raw.workflow_id}`,
    deviceName: device?.name ?? raw.device_id ?? "Shared scope",
    status: normalizeRunStatus(raw.status),
    startedAt: raw.started_at,
    durationMinutes,
    result:
      raw.log[raw.log.length - 1]?.result
        ? JSON.stringify(raw.log[raw.log.length - 1].result)
        : raw.log[raw.log.length - 1]?.message
          ? String(raw.log[raw.log.length - 1].message)
          : raw.log[raw.log.length - 1]?.action
            ? `Last action: ${String(raw.log[raw.log.length - 1].action)}`
            : "Workflow queued",
  };
}

function buildSettings(raw: BackendSettings): AppSettings {
  return {
    users: raw.users.map((user) => ({
      id: String(user.id),
      name: user.username,
      role: user.role,
      email: user.email,
      timezone: "UTC",
    })),
    alertThresholds: {
      cpuWarning: raw.alert_thresholds.cpu_warning,
      cpuCritical: raw.alert_thresholds.cpu_critical,
      latencyWarning: raw.alert_thresholds.latency_warning_ms,
      latencyCritical: raw.alert_thresholds.latency_critical_ms,
      packetLossWarning: raw.alert_thresholds.packet_loss_warning,
      packetLossCritical: raw.alert_thresholds.packet_loss_critical,
    },
    notificationChannels: raw.notification_channels,
    deviceGroups: raw.device_groups,
  };
}

function buildReportTemplates(
  uptime: BackendUptimeReport,
  sla: BackendSlaReport,
  compliance: BackendComplianceReport,
): ReportTemplate[] {
  const now = new Date().toISOString();
  return [
    {
      id: "uptime",
      title: "Uptime & SLA",
      description: `${uptime.devices.length} devices tracked, ${sla.open_incidents} open incidents, MTTR ${sla.mttr_seconds}s.`,
      primaryFormat: "pdf",
      lastGenerated: now,
    },
    {
      id: "incidents",
      title: "Incident Review",
      description: `${sla.total_incidents} incidents in range with ${sla.resolved_incidents} resolved.`,
      primaryFormat: "json",
      lastGenerated: now,
    },
    {
      id: "config-compliance",
      title: "Config Compliance",
      description: `${compliance.compliance_pct}% compliant across ${compliance.total_devices_with_config} tracked configs.`,
      primaryFormat: "csv",
      lastGenerated: now,
    },
    {
      id: "reliability",
      title: "Reliability Summary",
      description: `Combines uptime, incident pressure, and drift coverage for the NOC summary.`,
      primaryFormat: "pdf",
      lastGenerated: now,
    },
  ];
}

export function buildTopologyFromDevices(devices: Device[]) {
  const nodes: TopologyNode[] = devices.map((device, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    return {
      id: device.id,
      label: device.name.length > 18 ? `${device.name.slice(0, 18)}...` : device.name,
      role: device.group,
      status: device.status,
      x: 140 + column * 200,
      y: 120 + row * 150,
    };
  });

  const routers = devices.filter((device) => device.type === "router");
  const anchors = routers.length > 0 ? routers : devices.slice(0, 2);
  const edges: TopologyEdge[] = [];

  anchors.forEach((device, index) => {
    const next = anchors[index + 1];
    if (!next) {
      return;
    }
    edges.push({
      id: `anchor-${device.id}-${next.id}`,
      source: device.id,
      target: next.id,
      health:
        device.status === "critical" || next.status === "critical"
          ? "failed"
          : device.status === "warning" || next.status === "warning" || device.status === "degraded" || next.status === "degraded"
            ? "degraded"
            : "stable",
      latencyMs: Math.round((device.latencyMs + next.latencyMs) / 2),
    });
  });

  devices.forEach((device, index) => {
    const anchor = anchors[index % Math.max(anchors.length, 1)];
    if (!anchor || anchor.id === device.id) {
      return;
    }
    edges.push({
      id: `edge-${anchor.id}-${device.id}`,
      source: anchor.id,
      target: device.id,
      health:
        device.status === "critical" || device.status === "offline"
          ? "failed"
          : device.status === "warning" || device.status === "degraded"
            ? "degraded"
            : "stable",
      latencyMs: Math.round(Math.max(12, device.latencyMs || anchor.latencyMs || 18)),
    });
  });

  return { nodes, edges };
}

async function requestJsonStrict<T>(
  path: string,
  init?: RequestInit,
  options?: { auth?: boolean },
) {
  const requiresAuth = options?.auth !== false;
  const headers = new Headers(init?.headers);

  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (requiresAuth) {
    const token = await ensureAccessToken();
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && requiresAuth) {
    clearAccessToken();
    const token = await ensureAccessToken();
    headers.set("Authorization", `Bearer ${token}`);
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  }

  if (!response.ok) {
    throw new Error(`Request failed for ${path} with ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

async function requestJson<T>(
  path: string,
  fallback: T,
  init?: RequestInit,
  options?: { auth?: boolean },
) {
  try {
    return await requestJsonStrict<T>(path, init, options);
  } catch {
    await wait();
    return clone(fallback);
  }
}

async function touchExport(path: string) {
  const fallback = false;
  try {
    const token = await ensureAccessToken();
    let response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      clearAccessToken();
      const refreshedToken = await ensureAccessToken();
      response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
          Authorization: `Bearer ${refreshedToken}`,
        },
      });
    }

    if (!response.ok) {
      throw new Error(`Export failed for ${path}`);
    }

    await response.arrayBuffer();
    return true;
  } catch {
    await wait();
    return fallback;
  }
}

async function fetchDevicesRaw() {
  return requestJson<BackendDevice[]>("/devices", []);
}

async function fetchLatestTelemetryRaw(deviceId: string) {
  return requestJson<BackendTelemetry | null>(`/telemetry/${deviceId}`, null);
}

async function fetchTelemetryHistoryRaw(deviceId: string) {
  return requestJson<BackendTelemetry[]>(
    `/telemetry/${deviceId}/history?minutes=180&limit=120`,
    [],
  );
}

async function fetchAlertsRaw() {
  return requestJson<BackendAlert[]>("/alerts", []);
}

async function fetchIncidentsRaw() {
  return requestJson<BackendIncident[]>("/incidents", []);
}

async function fetchIncidentTimelineRaw(incidentId: string) {
  return requestJson<BackendIncidentTimeline>(
    `/incidents/${incidentId}/timeline`,
    {
      incident: {
        id: Number(incidentId),
        device_id: "",
        title: "",
        description: null,
        severity: "medium",
        status: "open",
        root_cause: null,
        created_at: new Date().toISOString(),
        resolved_at: null,
      },
      events: [],
    },
  );
}

async function fetchConfigRaw(deviceId: string) {
  return requestJson<BackendConfig>(`/configs/${deviceId}`, {
    device_id: deviceId,
    baseline_config: {},
    current_config: {},
    drift_detected: false,
    last_checked_at: null,
    updated_at: new Date().toISOString(),
  });
}

async function fetchConfigVersionsRaw(deviceId: string) {
  return requestJson<BackendConfigVersion[]>(`/configs/${deviceId}/versions`, []);
}

async function fetchConfigDriftRaw(deviceId: string) {
  return requestJson<BackendDriftReport>(`/configs/${deviceId}/drift`, {
    device_id: deviceId,
    drift_detected: false,
    differences: {},
    checked_at: new Date().toISOString(),
  });
}

async function fetchWorkflowsRaw() {
  return requestJson<BackendWorkflow[]>("/automation/workflows", []);
}

async function fetchRunsRaw() {
  return requestJson<BackendRun[]>("/automation/runs", []);
}

async function fetchUptimeReportRaw() {
  return requestJson<BackendUptimeReport>("/reports/uptime", {
    hours: 24,
    devices: [],
  });
}

async function fetchSlaReportRaw() {
  return requestJson<BackendSlaReport>("/reports/sla", {
    hours: 24,
    total_incidents: 0,
    open_incidents: 0,
    resolved_incidents: 0,
    mttr_seconds: 0,
  });
}

async function fetchComplianceReportRaw() {
  return requestJson<BackendComplianceReport>("/reports/config-compliance", {
    total_devices_with_config: 0,
    drift_detected: 0,
    compliant: 0,
    compliance_pct: 100,
    drifted_devices: [],
  });
}

async function fetchSettingsRaw() {
  return requestJson<BackendSettings>("/settings", {
    users: [],
    alert_thresholds: {
      cpu_warning: 75,
      cpu_critical: 90,
      latency_warning_ms: 120,
      latency_critical_ms: 200,
      packet_loss_warning: 2,
      packet_loss_critical: 5,
    },
    notification_channels: [],
    device_groups: [],
  });
}

function mapTelemetrySample(raw: BackendTelemetry): TelemetrySample {
  return {
    deviceId: raw.device_id,
    timestamp: raw.time,
    cpu: raw.cpu_percent ?? 0,
    memory: raw.memory_percent ?? 0,
    latencyMs: raw.latency_ms ?? 0,
    packetLossPercent: raw.packet_loss_percent ?? 0,
    bandwidthMbps: raw.bandwidth_mbps ?? 0,
    interfaceStatus:
      raw.interface_status === "down"
        ? "down"
        : raw.interface_status === "degraded"
          ? "degraded"
          : "up",
    status: normalizeDeviceStatus(raw.health_status),
  };
}

export async function fetchBootstrap() {
  const [
    devicesRaw,
    alertsRaw,
    incidentsRaw,
    runsRaw,
    workflowsRaw,
    uptimeReport,
    slaReport,
    complianceReport,
    settingsRaw,
  ] = await Promise.all([
    fetchDevicesRaw(),
    fetchAlertsRaw(),
    fetchIncidentsRaw(),
    fetchRunsRaw(),
    fetchWorkflowsRaw(),
    fetchUptimeReportRaw(),
    fetchSlaReportRaw(),
    fetchComplianceReportRaw(),
    fetchSettingsRaw(),
  ]);

  if (devicesRaw.length === 0) {
    await wait();
    return clone(mockBootstrapData) satisfies DashboardBootstrap;
  }

  const [latestTelemetryEntries, telemetryEntries, configEntries, incidentTimelines] =
    await Promise.all([
      Promise.all(
        devicesRaw.map(async (device) => [device.device_id, await fetchLatestTelemetryRaw(device.device_id)] as const),
      ),
      Promise.all(
        devicesRaw.map(async (device) => [device.device_id, await fetchTelemetryHistoryRaw(device.device_id)] as const),
      ),
      Promise.all(
        devicesRaw.map(
          async (device) =>
            [
              device.device_id,
              buildConfigSnapshot(
                await fetchConfigRaw(device.device_id),
                await fetchConfigVersionsRaw(device.device_id),
                await fetchConfigDriftRaw(device.device_id),
              ),
            ] as const,
        ),
      ),
      Promise.all(
        incidentsRaw.map(
          async (incident) =>
            [String(incident.id), await fetchIncidentTimelineRaw(String(incident.id))] as const,
        ),
      ),
    ]);

  const latestTelemetryIndex = new Map(latestTelemetryEntries);
  const uptimeIndex = new Map(
    uptimeReport.devices.map((item) => [item.device_id, item.uptime_pct] as const),
  );
  const driftSet = new Set(complianceReport.drifted_devices);
  const configsIndex = Object.fromEntries(configEntries);
  const mappedDevices = devicesRaw.map((device) =>
    buildDevice(
      device,
      latestTelemetryIndex.get(device.device_id) ?? null,
      uptimeIndex.get(device.device_id) ?? 100,
      driftSet.has(device.device_id),
    ),
  );
  const deviceIndex = new Map(mappedDevices.map((device) => [device.id, device] as const));
  const workflowIndex = new Map(workflowsRaw.map((workflow) => [workflow.id, workflow] as const));

  return {
    devices: mappedDevices,
    alerts: alertsRaw.map((alert) => buildAlert(alert, deviceIndex)),
    incidents: incidentsRaw.map((incident) =>
      buildIncident(
        incident,
        incidentTimelines.find(([id]) => id === String(incident.id))?.[1].events ?? [],
        deviceIndex,
      ),
    ),
    telemetry: Object.fromEntries(
      telemetryEntries.map(([deviceId, rows]) => [
        deviceId,
        rows.map((row) => mapTelemetrySample(row)).reverse(),
      ]),
    ),
    configs: configsIndex,
    workflows: workflowsRaw.map((workflow) => buildWorkflow(workflow, runsRaw)),
    runs: runsRaw.map((run) => buildRun(run, workflowIndex, deviceIndex)),
    reports: buildReportTemplates(uptimeReport, slaReport, complianceReport),
    topology: buildTopologyFromDevices(mappedDevices),
    settings: buildSettings(settingsRaw),
  } satisfies DashboardBootstrap;
}

export async function listDevices() {
  const [devicesRaw, latestTelemetryEntries, uptimeReport, complianceReport] =
    await Promise.all([
      fetchDevicesRaw(),
      fetchDevicesRaw().then((rows) =>
        Promise.all(
          rows.map(async (device) => [device.device_id, await fetchLatestTelemetryRaw(device.device_id)] as const),
        ),
      ),
      fetchUptimeReportRaw(),
      fetchComplianceReportRaw(),
    ]);

  if (devicesRaw.length === 0) {
    return clone(mockDevices);
  }

  const latestTelemetryIndex = new Map(latestTelemetryEntries);
  const uptimeIndex = new Map(
    uptimeReport.devices.map((item) => [item.device_id, item.uptime_pct] as const),
  );
  const driftSet = new Set(complianceReport.drifted_devices);

  return devicesRaw.map((device) =>
    buildDevice(
      device,
      latestTelemetryIndex.get(device.device_id) ?? null,
      uptimeIndex.get(device.device_id) ?? 100,
      driftSet.has(device.device_id),
    ),
  );
}

export async function getDevice(deviceId: string) {
  try {
    const [rawDevice, latestTelemetry, uptimeReport, driftReport] = await Promise.all([
      requestJson<BackendDevice | null>(`/devices/${deviceId}`, null),
      fetchLatestTelemetryRaw(deviceId),
      fetchUptimeReportRaw(),
      fetchConfigDriftRaw(deviceId),
    ]);

    if (!rawDevice) {
      throw new Error("Device not found");
    }

    const uptimePercent =
      uptimeReport.devices.find((item) => item.device_id === deviceId)?.uptime_pct ?? 100;
    return buildDevice(rawDevice, latestTelemetry, uptimePercent, driftReport.drift_detected);
  } catch {
    return clone(mockDevices.find((device) => device.id === deviceId) ?? mockDevices[0]);
  }
}

export async function getDeviceMetrics(deviceId: string) {
  const rows = await fetchTelemetryHistoryRaw(deviceId);
  if (rows.length === 0 && mockTelemetryHistory[deviceId]) {
    return clone(mockTelemetryHistory[deviceId]);
  }
  return rows.map((row) => mapTelemetrySample(row)).reverse();
}

export async function listAlerts() {
  const [alertsRaw, devicesList] = await Promise.all([fetchAlertsRaw(), listDevices()]);
  const deviceIndex = new Map(devicesList.map((device) => [device.id, device] as const));
  if (alertsRaw.length === 0) {
    return clone(mockAlerts);
  }
  return alertsRaw.map((alert) => buildAlert(alert, deviceIndex));
}

export async function listIncidents() {
  const [incidentsRaw, devicesList] = await Promise.all([fetchIncidentsRaw(), listDevices()]);
  const deviceIndex = new Map(devicesList.map((device) => [device.id, device] as const));
  if (incidentsRaw.length === 0) {
    return clone(mockIncidents);
  }

  const timelines = await Promise.all(
    incidentsRaw.map((incident) => fetchIncidentTimelineRaw(String(incident.id))),
  );

  return incidentsRaw.map((incident, index) =>
    buildIncident(incident, timelines[index]?.events ?? [], deviceIndex),
  );
}

export async function getConfig(deviceId: string) {
  try {
    const [configRaw, versionsRaw, driftRaw] = await Promise.all([
      fetchConfigRaw(deviceId),
      fetchConfigVersionsRaw(deviceId),
      fetchConfigDriftRaw(deviceId),
    ]);
    return buildConfigSnapshot(configRaw, versionsRaw, driftRaw);
  } catch {
    return clone(mockConfigs[deviceId] ?? Object.values(mockConfigs)[0]);
  }
}

export async function listWorkflows() {
  const [workflowsRaw, runsRaw] = await Promise.all([fetchWorkflowsRaw(), fetchRunsRaw()]);
  if (workflowsRaw.length === 0) {
    return clone(mockWorkflows);
  }
  return workflowsRaw.map((workflow) => buildWorkflow(workflow, runsRaw));
}

export async function listRuns() {
  const [runsRaw, workflowsRaw, devicesList] = await Promise.all([
    fetchRunsRaw(),
    fetchWorkflowsRaw(),
    listDevices(),
  ]);

  if (runsRaw.length === 0) {
    return clone(mockRuns);
  }

  const workflowIndex = new Map(workflowsRaw.map((workflow) => [workflow.id, workflow] as const));
  const deviceIndex = new Map(devicesList.map((device) => [device.id, device] as const));
  return runsRaw.map((run) => buildRun(run, workflowIndex, deviceIndex));
}

export async function listReports() {
  const [uptime, sla, compliance] = await Promise.all([
    fetchUptimeReportRaw(),
    fetchSlaReportRaw(),
    fetchComplianceReportRaw(),
  ]);

  if (uptime.devices.length === 0 && compliance.total_devices_with_config === 0) {
    return clone(mockReports);
  }

  return buildReportTemplates(uptime, sla, compliance);
}

export async function listSettings() {
  const raw = await fetchSettingsRaw();
  if (raw.users.length === 0 && raw.device_groups.length === 0) {
    return clone(mockSettings);
  }
  return buildSettings(raw);
}

export async function updateAlertStatus(
  alertId: string,
  status: Extract<AlertStatus, "open" | "acknowledged" | "resolved">,
) {
  const raw = await requestJsonStrict<BackendAlert>(`/alerts/${alertId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: toBackendAlertStatus(status),
    }),
  });
  const devicesList = await listDevices();
  return buildAlert(raw, new Map(devicesList.map((device) => [device.id, device] as const)));
}

export async function updateIncidentStatus(payload: {
  incidentId: string;
  status: IncidentStatus;
  rootCause?: string;
}) {
  const raw = await requestJsonStrict<BackendIncident>(
    `/incidents/${payload.incidentId}/resolve`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: payload.status,
        root_cause: payload.rootCause || undefined,
      }),
    },
  );
  const [timeline, devicesList] = await Promise.all([
    fetchIncidentTimelineRaw(String(raw.id)),
    listDevices(),
  ]);
  return buildIncident(
    raw,
    timeline.events,
    new Map(devicesList.map((device) => [device.id, device] as const)),
  );
}

export async function validateConfig(deviceId: string) {
  const raw = await requestJsonStrict<BackendConfigValidation>(
    `/configs/${deviceId}/validate`,
    {
      method: "POST",
    },
  );
  return {
    deviceId: raw.device_id,
    checkedAt: raw.checked_at,
    compliant: raw.compliant,
    driftDetected: raw.drift_detected,
    differenceCount: countDiffEntries(raw.differences),
  };
}

export async function rollbackConfig(deviceId: string) {
  const raw = await requestJsonStrict<BackendConfig>(`/configs/${deviceId}/rollback`, {
    method: "POST",
  });
  const [versionsRaw, driftRaw] = await Promise.all([
    fetchConfigVersionsRaw(deviceId),
    fetchConfigDriftRaw(deviceId),
  ]);
  return buildConfigSnapshot(raw, versionsRaw, driftRaw);
}

export async function runAutomation(payload: {
  workflowId: string;
  deviceId: string;
}) {
  const [devicesList, workflowsList] = await Promise.all([listDevices(), listWorkflows()]);
  const device = devicesList.find((item) => item.id === payload.deviceId) ?? mockDevices[0];
  const workflow = workflowsList.find((item) => item.id === payload.workflowId) ?? mockWorkflows[0];

  const backendPayload = {
    workflow_id: Number(payload.workflowId),
    device_id: payload.deviceId,
  };

  const fallback: AutomationRun = {
    id: `run-${Date.now()}`,
    workflowId: workflow.id,
    workflowName: workflow.name,
    deviceName: device.name,
    status: "queued",
    startedAt: new Date().toISOString(),
    durationMinutes: workflow.averageDurationMinutes,
    result: "Queued from frontend while backend automation endpoint is unavailable.",
  };

  try {
    const raw = await requestJson<BackendRun>("/automation/run", {
      id: Number(fallback.id.replace("run-", "")),
      workflow_id: Number(payload.workflowId),
      device_id: payload.deviceId,
      incident_id: null,
      status: "pending",
      log: [],
      started_at: fallback.startedAt,
      finished_at: null,
    }, {
      method: "POST",
      body: JSON.stringify(backendPayload),
    });

    return buildRun(
      raw,
      new Map([[Number(payload.workflowId), {
        id: Number(payload.workflowId),
        name: workflow.name,
        description: workflow.description,
        trigger: workflow.triggers[0] ?? "manual",
        actions: [],
        enabled: true,
        created_at: new Date().toISOString(),
      }]]),
      new Map([[device.id, device]]),
    );
  } catch {
    return fallback;
  }
}

export async function exportReport(
  reportId: string,
  format: ReportTemplate["primaryFormat"],
) {
  const report = (await listReports()).find((item) => item.id === reportId) ?? mockReports[0];
  const ok = await touchExport(`/reports/export/${format}`);
  return {
    reportId: report.id,
    title: report.title,
    generatedAt: new Date().toISOString(),
    format,
    message: ok
      ? `Downloaded ${format.toUpperCase()} export from the backend.`
      : "Report export queued in mock mode.",
  };
}

export async function getTopology() {
  const devicesList = await listDevices();
  if (devicesList.length === 0) {
    return clone(mockBootstrapData.topology);
  }
  return buildTopologyFromDevices(devicesList);
}

export async function getDashboardDeviceBundle(deviceId: string) {
  const [device, metrics, config] = await Promise.all([
    getDevice(deviceId),
    getDeviceMetrics(deviceId),
    getConfig(deviceId),
  ]);
  return {
    device,
    metrics,
    config,
  };
}
