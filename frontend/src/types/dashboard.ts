import type { Alert } from "./alert";
import type { AutomationRun, AutomationWorkflow } from "./automation";
import type { DeviceConfigSnapshot } from "./config";
import type { Device } from "./device";
import type { Incident } from "./incident";
import type { ReportTemplate } from "./report";
import type { AppSettings } from "./settings";
import type { TelemetrySample } from "./telemetry";
import type { TopologyEdge, TopologyNode } from "./topology";

export interface DashboardBootstrap {
  devices: Device[];
  alerts: Alert[];
  incidents: Incident[];
  telemetry: Record<string, TelemetrySample[]>;
  configs: Record<string, DeviceConfigSnapshot>;
  workflows: AutomationWorkflow[];
  runs: AutomationRun[];
  reports: ReportTemplate[];
  topology: {
    nodes: TopologyNode[];
    edges: TopologyEdge[];
  };
  settings: AppSettings;
}
