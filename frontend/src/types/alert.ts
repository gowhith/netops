import type { Severity } from "./common";

export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface Alert {
  id: string;
  severity: Severity;
  status: AlertStatus;
  deviceId: string;
  deviceName: string;
  reason: string;
  suggestedAction: string;
  source: string;
  timestamp: string;
}
