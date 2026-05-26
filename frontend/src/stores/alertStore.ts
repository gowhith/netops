import { create } from "zustand";
import type { Alert } from "../types/alert";
import { sortAlerts } from "../lib/utils";

interface AlertStoreState {
  alerts: Alert[];
  unreadCount: number;
  setAlerts: (alerts: Alert[]) => void;
  upsertAlert: (alert: Alert) => void;
  markAllRead: () => void;
}

export const useAlertStore = create<AlertStoreState>((set) => ({
  alerts: [],
  unreadCount: 0,
  setAlerts: (alerts) =>
    set({
      alerts: sortAlerts(alerts),
      unreadCount: alerts.filter((alert) => alert.status === "open").length,
    }),
  upsertAlert: (alert) =>
    set((state) => {
      const nextAlerts = sortAlerts([
        alert,
        ...state.alerts.filter((item) => item.id !== alert.id),
      ]).slice(0, 30);
      return {
        alerts: nextAlerts,
        unreadCount: nextAlerts.filter((item) => item.status === "open").length,
      };
    }),
  markAllRead: () => set({ unreadCount: 0 }),
}));
