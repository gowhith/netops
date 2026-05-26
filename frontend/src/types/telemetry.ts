import type { DeviceStatus } from "./device";

export interface TelemetrySample {
  deviceId: string;
  timestamp: string;
  cpu: number;
  memory: number;
  latencyMs: number;
  packetLossPercent: number;
  bandwidthMbps: number;
  interfaceStatus: "up" | "degraded" | "down";
  status: DeviceStatus;
}
