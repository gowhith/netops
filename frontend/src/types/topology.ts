import type { DeviceStatus } from "./device";

export interface TopologyNode {
  id: string;
  label: string;
  role: string;
  status: DeviceStatus;
  x: number;
  y: number;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  health: "stable" | "degraded" | "failed";
  latencyMs: number;
}
