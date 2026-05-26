import { alerts, devices, incidents, telemetryHistory } from "../data/mockData";
import type { Alert } from "../types/alert";
import type { Incident } from "../types/incident";
import type { ConnectionMode } from "../types/common";
import type { TelemetrySample } from "../types/telemetry";
import { useDeviceStore } from "../stores/deviceStore";
import { clamp, inferDeviceStatus } from "./utils";

const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:8020/ws";

interface LiveHandlers {
  onConnectionMode: (mode: ConnectionMode) => void;
  onTelemetry: (sample: TelemetrySample) => void;
  onAlert: (alert: Alert) => void;
  onIncident: (incident: Incident) => void;
}

interface WrappedEvent<T> {
  type?: string;
  data?: T;
  ts?: string;
}

function normalizeDeviceStatus(status: string | null | undefined) {
  switch ((status ?? "").toLowerCase()) {
    case "healthy":
      return "healthy" as const;
    case "warning":
      return "warning" as const;
    case "critical":
      return "critical" as const;
    case "offline":
      return "offline" as const;
    default:
      return "degraded" as const;
  }
}

function normalizeSeverity(severity: string | null | undefined) {
  switch ((severity ?? "").toLowerCase()) {
    case "critical":
    case "high":
      return "critical" as const;
    case "warning":
    case "medium":
      return "warning" as const;
    default:
      return "info" as const;
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

function normalizeAlertStatus(status: string | null | undefined) {
  switch ((status ?? "").toLowerCase()) {
    case "acknowledged":
      return "acknowledged" as const;
    case "resolved":
      return "resolved" as const;
    default:
      return "open" as const;
  }
}

function mapTelemetryPayload(
  payload: {
    device_id: string;
    timestamp?: string;
    cpu_percent?: number | null;
    memory_percent?: number | null;
    latency_ms?: number | null;
    packet_loss_percent?: number | null;
    bandwidth_mbps?: number | null;
    status?: string | null;
    health_status?: string | null;
    interface_status?: string | null;
  },
  timestampFallback: string,
): TelemetrySample {
  const status = normalizeDeviceStatus(payload.status ?? payload.health_status);
  return {
    deviceId: payload.device_id,
    timestamp: payload.timestamp ?? timestampFallback,
    cpu: payload.cpu_percent ?? 0,
    memory: payload.memory_percent ?? 0,
    latencyMs: payload.latency_ms ?? 0,
    packetLossPercent: payload.packet_loss_percent ?? 0,
    bandwidthMbps: payload.bandwidth_mbps ?? 0,
    status,
    interfaceStatus:
      payload.interface_status === "down"
        ? "down"
        : payload.interface_status === "degraded"
          ? "degraded"
          : "up",
  };
}

function mapDeviceEventToTelemetry(
  payload: {
    device_id: string;
    status?: string | null;
    last_seen?: string | null;
  },
  timestampFallback: string,
): TelemetrySample {
  const store = useDeviceStore.getState();
  const lastSample =
    store.telemetry[payload.device_id]?.[store.telemetry[payload.device_id].length - 1];
  const device = store.devices.find((item) => item.id === payload.device_id);
  const status = normalizeDeviceStatus(payload.status ?? device?.status);

  return {
    deviceId: payload.device_id,
    timestamp: payload.last_seen ?? timestampFallback,
    cpu: lastSample?.cpu ?? device?.cpu ?? 0,
    memory: lastSample?.memory ?? device?.memory ?? 0,
    latencyMs: lastSample?.latencyMs ?? device?.latencyMs ?? 0,
    packetLossPercent: lastSample?.packetLossPercent ?? device?.packetLossPercent ?? 0,
    bandwidthMbps: lastSample?.bandwidthMbps ?? device?.bandwidthMbps ?? 0,
    status,
    interfaceStatus: status === "offline" ? "down" : status === "degraded" ? "degraded" : "up",
  };
}

function mapAlertPayload(
  payload: {
    id?: number | string;
    device_id: string;
    rule?: string | null;
    severity?: string | null;
    status?: string | null;
    message?: string | null;
    created_at?: string | null;
  },
  timestampFallback: string,
): Alert {
  const device = useDeviceStore
    .getState()
    .devices.find((item) => item.id === payload.device_id);
  return {
    id: String(payload.id ?? `alert-live-${Date.now()}`),
    severity: normalizeSeverity(payload.severity),
    status: normalizeAlertStatus(payload.status),
    deviceId: payload.device_id,
    deviceName: device?.name ?? payload.device_id,
    reason: payload.message ?? "Alert raised",
    suggestedAction: payload.rule?.includes("config")
      ? "Validate drift and compare the current config against baseline."
      : "Inspect the device and consider automation or incident escalation.",
    source: payload.rule ?? "websocket",
    timestamp: payload.created_at ?? timestampFallback,
  };
}

function mapIncidentPayload(
  payload: {
    id?: number | string;
    device_id: string;
    title?: string | null;
    severity?: string | null;
    status?: string | null;
    created_at?: string | null;
  },
  timestampFallback: string,
): Incident {
  const device = useDeviceStore
    .getState()
    .devices.find((item) => item.id === payload.device_id);
  return {
    id: String(payload.id ?? `inc-live-${Date.now()}`),
    title: payload.title ?? `Incident for ${payload.device_id}`,
    severity: normalizeSeverity(payload.severity),
    status: normalizeIncidentStatus(payload.status),
    deviceIds: [payload.device_id],
    affectedServices: [device?.group ?? "network-fabric"],
    rootCause: "Live incident event received from backend.",
    summary: "Live incident update received through WebSocket.",
    openedAt: payload.created_at ?? timestampFallback,
    updatedAt: timestampFallback,
    automationActions: [],
    timeline: [],
  };
}

export function connectLiveUpdates(handlers: LiveHandlers) {
  if (import.meta.env.VITE_DISABLE_BACKEND_WS === "true") {
    return startMockStream(handlers);
  }

  handlers.onConnectionMode("connecting");

  const channels = ["telemetry", "alerts", "incidents", "devices"];
  const sockets: WebSocket[] = [];
  let openConnections = 0;
  let cleanedUp = false;
  let mockCleanup: (() => void) | null = null;

  const fallbackTimer = window.setTimeout(() => {
    if (openConnections === 0 && !cleanedUp) {
      sockets.forEach((socket) => socket.close());
      mockCleanup = startMockStream(handlers);
    }
  }, 1_400);

  for (const channel of channels) {
    try {
      const socket = new WebSocket(`${WS_BASE_URL}/${channel}`);

      socket.onopen = () => {
        openConnections += 1;
        handlers.onConnectionMode("connected");
      };

      socket.onmessage = (event) => {
        if (event.data === "pong") {
          return;
        }

        try {
          const envelope = JSON.parse(event.data) as WrappedEvent<Record<string, unknown>>;
          const payload = envelope.data ?? {};
          const timestamp = envelope.ts ?? new Date().toISOString();

          if (channel === "telemetry") {
            handlers.onTelemetry(
              mapTelemetryPayload(
                payload as {
                  device_id: string;
                  timestamp?: string;
                  cpu_percent?: number | null;
                  memory_percent?: number | null;
                  latency_ms?: number | null;
                  packet_loss_percent?: number | null;
                  bandwidth_mbps?: number | null;
                  status?: string | null;
                  health_status?: string | null;
                  interface_status?: string | null;
                },
                timestamp,
              ),
            );
            return;
          }

          if (channel === "devices") {
            handlers.onTelemetry(
              mapDeviceEventToTelemetry(
                payload as {
                  device_id: string;
                  status?: string | null;
                  last_seen?: string | null;
                },
                timestamp,
              ),
            );
            return;
          }

          if (channel === "alerts") {
            handlers.onAlert(
              mapAlertPayload(
                payload as {
                  id?: number | string;
                  device_id: string;
                  rule?: string | null;
                  severity?: string | null;
                  status?: string | null;
                  message?: string | null;
                  created_at?: string | null;
                },
                timestamp,
              ),
            );
            return;
          }

          if (channel === "incidents") {
            handlers.onIncident(
              mapIncidentPayload(
                payload as {
                  id?: number | string;
                  device_id: string;
                  title?: string | null;
                  severity?: string | null;
                  status?: string | null;
                  created_at?: string | null;
                },
                timestamp,
              ),
            );
          }
        } catch {
          handlers.onConnectionMode("mock");
        }
      };

      socket.onerror = () => {
        if (openConnections === 0 && !mockCleanup) {
          handlers.onConnectionMode("offline");
        }
      };

      sockets.push(socket);
    } catch {
      handlers.onConnectionMode("offline");
    }
  }

  return () => {
    cleanedUp = true;
    window.clearTimeout(fallbackTimer);
    sockets.forEach((socket) => socket.close());
    mockCleanup?.();
  };
}

function startMockStream(handlers: LiveHandlers) {
  handlers.onConnectionMode("mock");
  let tick = 0;
  let alertCursor = 0;
  let incidentCursor = 0;

  const interval = window.setInterval(() => {
    const device = devices[tick % devices.length];
    const history = telemetryHistory[device.id];
    const base = history[history.length - 1];
    const pressure = tick % 7 === 0 ? 14 : tick % 4 === 0 ? 6 : 0;
    const packetLoss = clamp(
      base.packetLossPercent + pressure * 0.12 + (tick % 3 === 0 ? 0.4 : -0.2),
      0,
      12,
    );
    const latencyMs = clamp(base.latencyMs + pressure * 4.5, 12, 420);
    const cpu = clamp(base.cpu + pressure * 0.65, 12, 99);
    const memory = clamp(base.memory + pressure * 0.48, 10, 99);
    const status =
      tick % 15 === 0 && device.id === "switch-15"
        ? "offline"
        : inferDeviceStatus({
            cpu,
            latencyMs,
            packetLossPercent: packetLoss,
          });

    handlers.onTelemetry({
      ...base,
      timestamp: new Date().toISOString(),
      cpu,
      memory,
      latencyMs,
      packetLossPercent: packetLoss,
      bandwidthMbps: clamp(base.bandwidthMbps - pressure * 6, 20, 1000),
      status,
      interfaceStatus: status === "offline" ? "down" : status === "degraded" ? "degraded" : "up",
    });

    if (
      (status === "warning" || status === "critical" || status === "offline") &&
      tick % 2 === 0
    ) {
      const source = alerts[alertCursor % alerts.length];
      handlers.onAlert({
        ...source,
        id: `alert-live-${Date.now()}`,
        deviceId: device.id,
        deviceName: device.name,
        status: "open",
        timestamp: new Date().toISOString(),
        severity:
          status === "offline" || status === "critical" ? "critical" : "warning",
        reason:
          status === "offline"
            ? "Mock stream detected missing heartbeat from live channel"
            : `Live ${status} telemetry update detected on ${device.name}`,
      });
      alertCursor += 1;
    }

    if ((status === "critical" || status === "offline") && tick % 4 === 0) {
      const source = incidents[incidentCursor % incidents.length];
      handlers.onIncident({
        ...source,
        id: `inc-live-${Date.now()}`,
        title: `${device.name} live incident`,
        deviceIds: [device.id],
        openedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: status === "offline" ? "investigating" : "open",
      });
      incidentCursor += 1;
    }

    tick += 1;
  }, 4_000);

  return () => {
    window.clearInterval(interval);
  };
}
