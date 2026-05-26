import { create } from "zustand";
import type { ConnectionMode } from "../types/common";

interface SessionStoreState {
  connectionMode: ConnectionMode;
  lastEventAt: string | null;
  searchQuery: string;
  setConnectionMode: (mode: ConnectionMode) => void;
  setLastEventAt: (value: string) => void;
  setSearchQuery: (value: string) => void;
}

export const useSessionStore = create<SessionStoreState>((set) => ({
  connectionMode: "connecting",
  lastEventAt: null,
  searchQuery: "",
  setConnectionMode: (connectionMode) => set({ connectionMode }),
  setLastEventAt: (lastEventAt) => set({ lastEventAt }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
