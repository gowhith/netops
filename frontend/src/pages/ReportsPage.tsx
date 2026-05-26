import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { exportReport, listReports } from "../lib/api";
import { formatTimestamp } from "../lib/utils";
import { useDeviceStore } from "../stores/deviceStore";

export function ReportsPage() {
  const reportsQuery = useQuery({
    queryKey: ["reports"],
    queryFn: listReports,
  });
  const devices = useDeviceStore((state) => state.devices);
  const [message, setMessage] = useState("");

  const exportMutation = useMutation({
    mutationFn: ({
      reportId,
      format,
    }: {
      reportId: string;
      format: "pdf" | "csv" | "json";
    }) => exportReport(reportId, format),
    onSuccess: (result) => {
      setMessage(`${result.title} export queued as ${result.format.toUpperCase()}.`);
    },
  });

  const reports = reportsQuery.data ?? [];

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Reports"
        title="Reports and exports"
        description="Uptime, SLA, incidents, config compliance, and reliability reporting surfaces aligned to the reporting service in the backend plan."
      />

      <section className="three-column-grid">
        <MetricCard
          label="Report templates"
          value={`${reports.length}`}
          delta="export formats ready"
          detail="pdf / csv / json"
          tone="healthy"
        />
        <MetricCard
          label="Fleet uptime"
          value={`${(devices.reduce((sum, device) => sum + device.uptimePercent, 0) / Math.max(devices.length, 1)).toFixed(2)}%`}
          delta="rolling 30-day estimate"
          detail="SLA coverage"
          tone="degraded"
        />
        <MetricCard
          label="Drifted devices"
          value={`${devices.filter((device) => device.configDrift).length}`}
          delta="compliance review"
          detail="report scope"
          tone="warning"
        />
      </section>

      {message ? <div className="tone-chip tone-chip--healthy">{message}</div> : null}

      <SectionCard
        eyebrow="Templates"
        title="Report catalog"
        description="Each card is ready to connect to the planned backend export routes."
      >
        <div className="cluster-grid">
          {reports.map((report) => (
            <article className="surface-card" key={report.id}>
              <div className="stack">
                <span className="tone-chip tone-chip--info">{report.primaryFormat}</span>
                <div>
                  <strong>{report.title}</strong>
                  <div className="small-text muted-text">
                    Last generated {formatTimestamp(report.lastGenerated)}
                  </div>
                </div>
                <div className="muted-text">{report.description}</div>
                <div className="inline-actions">
                  {(["pdf", "csv", "json"] as const).map((format) => (
                    <button
                      key={format}
                      className="button button--ghost"
                      disabled={exportMutation.isPending}
                      onClick={() =>
                        exportMutation.mutate({ reportId: report.id, format })
                      }
                      type="button"
                    >
                      {format.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
