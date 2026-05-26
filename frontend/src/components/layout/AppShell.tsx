import { useEffect, startTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import { fetchBootstrap } from "../../lib/api";
import { connectLiveUpdates } from "../../lib/websocket";
import { useAlertStore } from "../../stores/alertStore";
import { useDeviceStore } from "../../stores/deviceStore";
import { useIncidentStore } from "../../stores/incidentStore";
import { useSessionStore } from "../../stores/sessionStore";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell() {
  const bootstrapQuery = useQuery({
    queryKey: ["bootstrap"],
    queryFn: fetchBootstrap,
  });

  const setDevices = useDeviceStore((state) => state.setDevices);
  const setTelemetry = useDeviceStore((state) => state.setTelemetry);
  const upsertTelemetrySample = useDeviceStore((state) => state.upsertTelemetrySample);
  const setAlerts = useAlertStore((state) => state.setAlerts);
  const upsertAlert = useAlertStore((state) => state.upsertAlert);
  const setIncidents = useIncidentStore((state) => state.setIncidents);
  const upsertIncident = useIncidentStore((state) => state.upsertIncident);
  const setConnectionMode = useSessionStore((state) => state.setConnectionMode);
  const setLastEventAt = useSessionStore((state) => state.setLastEventAt);
  const connectionMode = useSessionStore((state) => state.connectionMode);

  useEffect(() => {
    if (!bootstrapQuery.data) {
      return;
    }

    startTransition(() => {
      setDevices(bootstrapQuery.data.devices);
      setTelemetry(bootstrapQuery.data.telemetry);
      setAlerts(bootstrapQuery.data.alerts);
      setIncidents(bootstrapQuery.data.incidents);
    });
  }, [bootstrapQuery.data, setAlerts, setDevices, setIncidents, setTelemetry]);

  useEffect(() => {
    const disconnect = connectLiveUpdates({
      onConnectionMode: setConnectionMode,
      onTelemetry: (sample) => {
        upsertTelemetrySample(sample);
        setLastEventAt(sample.timestamp);
      },
      onAlert: (alert) => {
        upsertAlert(alert);
        setLastEventAt(alert.timestamp);
      },
      onIncident: (incident) => {
        upsertIncident(incident);
        setLastEventAt(incident.updatedAt);
      },
    });

    return () => {
      disconnect();
    };
  }, [
    setConnectionMode,
    setLastEventAt,
    upsertIncident,
    upsertAlert,
    upsertTelemetrySample,
  ]);

  return (
    <div className="shell">
      <Sidebar />
      <main className="content">
        <TopBar />
        {connectionMode !== "connected" ? (
          <section className="banner">
            <div>
              <strong>
                {connectionMode === "mock"
                  ? "Mock mode is active while backend live channels come online."
                  : "Live services are still warming up."}
              </strong>
              <span className="muted-text">
                The UI already matches the planned FastAPI routes and WebSocket channels, so
                the mock layer can be replaced by the backend without changing page structure.
              </span>
            </div>
            <span className={`tone-chip tone-chip--${connectionMode === "offline" ? "critical" : "warning"}`}>
              {connectionMode}
            </span>
          </section>
        ) : null}
        {bootstrapQuery.isPending ? (
          <section className="surface-card empty-state">
            Loading NetOps AI dashboard surfaces...
          </section>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}
