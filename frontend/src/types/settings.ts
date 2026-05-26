export interface AppUser {
  id: string;
  name: string;
  role: "admin" | "engineer" | "viewer";
  email: string;
  timezone: string;
}

export interface AlertThresholds {
  cpuWarning: number;
  cpuCritical: number;
  latencyWarning: number;
  latencyCritical: number;
  packetLossWarning: number;
  packetLossCritical: number;
}

export interface NotificationChannel {
  id: string;
  type: "email" | "webhook" | "slack";
  target: string;
  enabled: boolean;
}

export interface AppSettings {
  users: AppUser[];
  alertThresholds: AlertThresholds;
  notificationChannels: NotificationChannel[];
  deviceGroups: string[];
}
