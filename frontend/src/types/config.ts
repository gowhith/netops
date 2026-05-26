export interface ConfigVersion {
  id: string;
  versionLabel: string;
  author: string;
  createdAt: string;
  summary: string;
}

export interface DeviceConfigSnapshot {
  deviceId: string;
  driftStatus: "compliant" | "drift-detected";
  complianceScore: number;
  baselineConfig: string;
  currentConfig: string;
  rollbackTarget: string;
  versions: ConfigVersion[];
}
