export type AutomationRunStatus = "queued" | "running" | "success" | "failed";

export interface AutomationWorkflow {
  id: string;
  name: string;
  category: string;
  description: string;
  triggers: string[];
  recommended: boolean;
  successRate: number;
  averageDurationMinutes: number;
  lastRunStatus: AutomationRunStatus;
}

export interface AutomationRun {
  id: string;
  workflowId: string;
  workflowName: string;
  deviceName: string;
  status: AutomationRunStatus;
  startedAt: string;
  durationMinutes: number;
  result: string;
}
