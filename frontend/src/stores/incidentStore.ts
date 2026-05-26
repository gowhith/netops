import { create } from "zustand";
import type { Incident } from "../types/incident";
import { sortIncidents } from "../lib/utils";

interface IncidentStoreState {
  incidents: Incident[];
  setIncidents: (incidents: Incident[]) => void;
  upsertIncident: (incident: Incident) => void;
}

export const useIncidentStore = create<IncidentStoreState>((set) => ({
  incidents: [],
  setIncidents: (incidents) => set({ incidents: sortIncidents(incidents) }),
  upsertIncident: (incident) =>
    set((state) => ({
      incidents: sortIncidents([
        incident,
        ...state.incidents.filter((item) => item.id !== incident.id),
      ]).slice(0, 20),
    })),
}));
