import { create } from "zustand";
import type { Device } from "../types/device";
import type { TelemetrySample } from "../types/telemetry";
import { calculateHealthScore } from "../lib/utils";

interface DeviceStoreState {
  devices: Device[];
  telemetry: Record<string, TelemetrySample[]>;
  setDevices: (devices: Device[]) => void;
  setTelemetry: (telemetry: Record<string, TelemetrySample[]>) => void;
  upsertTelemetrySample: (sample: TelemetrySample) => void;
}

export const useDeviceStore = create<DeviceStoreState>((set) => ({
  devices: [],
  telemetry: {},
  setDevices: (devices) => set({ devices }),
  setTelemetry: (telemetry) => set({ telemetry }),
  upsertTelemetrySample: (sample) =>
    set((state) => {
      const existingSamples = state.telemetry[sample.deviceId] ?? [];
      const nextSamples = [...existingSamples, sample].slice(-24);
      const devices = state.devices.map((device) => {
        if (device.id !== sample.deviceId) {
          return device;
        }

        return {
          ...device,
          status: sample.status,
          cpu: sample.cpu,
          memory: sample.memory,
          latencyMs: sample.latencyMs,
          packetLossPercent: sample.packetLossPercent,
          bandwidthMbps: sample.bandwidthMbps,
          lastHeartbeat: sample.timestamp,
          healthScore:
            sample.status === "offline" ? 18 : calculateHealthScore(sample),
        };
      });

      return {
        devices,
        telemetry: {
          ...state.telemetry,
          [sample.deviceId]: nextSamples,
        },
      };
    }),
}));
