import type { Severity } from "./common";

export type IncidentStatus =
  | "open"
  | "investigating"
  | "mitigated"
  | "resolved";

export interface IncidentEvent {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  deviceIds: string[];
  affectedServices: string[];
  rootCause: string;
  summary: string;
  openedAt: string;
  updatedAt: string;
  automationActions: string[];
  timeline: IncidentEvent[];
}
