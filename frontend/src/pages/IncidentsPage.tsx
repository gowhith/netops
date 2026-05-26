import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "../components/DataTable";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { updateIncidentStatus } from "../lib/api";
import { formatTimestamp } from "../lib/utils";
import { useDeviceStore } from "../stores/deviceStore";
import { useIncidentStore } from "../stores/incidentStore";

export function IncidentsPage() {
  const incidents = useIncidentStore((state) => state.incidents);
  const upsertIncident = useIncidentStore((state) => state.upsertIncident);
  const devices = useDeviceStore((state) => state.devices);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [rootCauseDraft, setRootCauseDraft] = useState("");
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!selectedIncidentId && incidents[0]) {
      setSelectedIncidentId(incidents[0].id);
    }
  }, [incidents, selectedIncidentId]);

  const selectedIncident =
    incidents.find((incident) => incident.id === selectedIncidentId) ?? incidents[0];

  useEffect(() => {
    if (!selectedIncident) {
      return;
    }
    setRootCauseDraft(
      selectedIncident.rootCause === "Awaiting root cause analysis"
        ? ""
        : selectedIncident.rootCause,
    );
  }, [selectedIncident]);

  const incidentMutation = useMutation({
    mutationFn: ({
      incidentId,
      status,
      rootCause,
    }: {
      incidentId: string;
      status: "open" | "investigating" | "mitigated" | "resolved";
      rootCause?: string;
    }) =>
      updateIncidentStatus({
        incidentId,
        status,
        rootCause,
      }),
    onSuccess: (incident) => {
      upsertIncident(incident);
      setRootCauseDraft(
        incident.rootCause === "Awaiting root cause analysis" ? "" : incident.rootCause,
      );
      setMessage(`Incident ${incident.id} moved to ${incident.status}.`);
      void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: () => {
      setMessage("Backend incident update failed. Check API availability and permissions.");
    },
  });

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Incidents"
        title="Incident management"
        description="Track open, investigating, mitigated, and resolved incidents with timeline context, root cause, and automation steps."
      />

      <section className="three-column-grid">
        <MetricCard
          label="Open"
          value={`${incidents.filter((incident) => incident.status === "open").length}`}
          delta="awaiting deep triage"
          detail="current queue"
          tone="warning"
        />
        <MetricCard
          label="Investigating"
          value={`${incidents.filter((incident) => incident.status === "investigating").length}`}
          delta="root cause in progress"
          detail="active diagnosis"
          tone="critical"
        />
        <MetricCard
          label="Mitigated"
          value={`${incidents.filter((incident) => incident.status === "mitigated").length}`}
          delta="stabilization phase"
          detail="service returning"
          tone="degraded"
        />
      </section>

      <section className="split-grid">
        <SectionCard
          eyebrow="Queue"
          title="Incident backlog"
          description="Select an incident to inspect the timeline and recovery context."
        >
          <DataTable
            rows={incidents}
            getRowKey={(incident) => incident.id}
            onRowClick={(incident) => setSelectedIncidentId(incident.id)}
            columns={[
              {
                key: "title",
                header: "Incident",
                render: (incident) => (
                  <div>
                    <strong>{incident.title}</strong>
                    <div className="small-text muted-text">{incident.rootCause}</div>
                  </div>
                ),
              },
              {
                key: "severity",
                header: "Severity",
                render: (incident) => <StatusBadge label={incident.severity} tone={incident.severity} />,
              },
              {
                key: "status",
                header: "Status",
                render: (incident) => <StatusBadge label={incident.status} tone="warning" />,
              },
              {
                key: "devices",
                header: "Affected devices",
                render: (incident) => `${incident.deviceIds.length}`,
              },
              {
                key: "updated",
                header: "Updated",
                render: (incident) => formatTimestamp(incident.updatedAt),
              },
            ]}
          />
        </SectionCard>

        {selectedIncident ? (
          <SectionCard
            eyebrow="Timeline"
            title={selectedIncident.title}
            description={selectedIncident.summary}
          >
            <div className="stack">
              {message ? <div className="tone-chip tone-chip--healthy">{message}</div> : null}
              <StatusBadge label={selectedIncident.status} tone="warning" />
              <div className="stack">
                <strong>Backend status controls</strong>
                <div className="inline-actions">
                  {(["investigating", "mitigated", "resolved"] as const).map((status) => (
                    <button
                      key={status}
                      className={status === "resolved" ? "button button--teal" : "button button--ghost"}
                      disabled={
                        incidentMutation.isPending || selectedIncident.status === status
                      }
                      onClick={() =>
                        incidentMutation.mutate({
                          incidentId: selectedIncident.id,
                          status,
                          rootCause: rootCauseDraft.trim() || undefined,
                        })
                      }
                      type="button"
                    >
                      Mark {status}
                    </button>
                  ))}
                </div>
                <input
                  className="select-field"
                  placeholder="Add root cause or timeline note for the backend update"
                  value={rootCauseDraft}
                  onChange={(event) => setRootCauseDraft(event.target.value)}
                />
              </div>
              <div className="muted-text">{selectedIncident.rootCause}</div>
              <div className="stack">
                <strong>Affected devices</strong>
                <div className="pill-row">
                  {selectedIncident.deviceIds.map((deviceId) => {
                    const device = devices.find((item) => item.id === deviceId);
                    return (
                      <span className="pill" key={deviceId}>
                        {device?.name ?? deviceId}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="stack">
                <strong>Affected services</strong>
                <div className="pill-row">
                  {selectedIncident.affectedServices.map((service) => (
                    <span className="pill" key={service}>
                      {service}
                    </span>
                  ))}
                </div>
              </div>
              <div className="timeline">
                {selectedIncident.timeline.map((event) => (
                  <div className="timeline__item" key={event.id}>
                    <div className="timeline__time">{formatTimestamp(event.timestamp)}</div>
                    <strong>{event.title}</strong>
                    <div className="muted-text">{event.detail}</div>
                  </div>
                ))}
              </div>
              <div className="stack">
                <strong>Automation steps</strong>
                <ul className="mini-list">
                  {selectedIncident.automationActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            </div>
          </SectionCard>
        ) : null}
      </section>
    </div>
  );
}
