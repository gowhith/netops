export type DeviceType =
  | "router"
  | "switch"
  | "access-point"
  | "edge-node"
  | "server";

export type DeviceStatus =
  | "healthy"
  | "warning"
  | "critical"
  | "degraded"
  | "offline";

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  ipAddress: string;
  location: string;
  group: string;
  model: string;
  firmwareVersion: string;
  status: DeviceStatus;
  healthScore: number;
  reliabilityScore: number;
  uptimePercent: number;
  cpu: number;
  memory: number;
  latencyMs: number;
  packetLossPercent: number;
  bandwidthMbps: number;
  configDrift: boolean;
  lastHeartbeat: string;
}
