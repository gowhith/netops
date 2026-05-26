import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { listRuns, listWorkflows, runAutomation } from "../lib/api";
import { formatTimestamp } from "../lib/utils";
import { useDeviceStore } from "../stores/deviceStore";
import type { AutomationRun } from "../types/automation";

export function AutomationPage() {
  const workflowsQuery = useQuery({
    queryKey: ["workflows"],
    queryFn: listWorkflows,
  });
  const runsQuery = useQuery({
    queryKey: ["automation-runs"],
    queryFn: listRuns,
  });
  const devices = useDeviceStore((state) => state.devices);
  const [searchParams, setSearchParams] = useSearchParams();
  const [queuedRuns, setQueuedRuns] = useState<AutomationRun[]>([]);
  const [message, setMessage] = useState("");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  useEffect(() => {
    const deviceIdFromQuery = searchParams.get("deviceId");
    if (
      !selectedDeviceId &&
      deviceIdFromQuery &&
      devices.some((device) => device.id === deviceIdFromQuery)
    ) {
      setSelectedDeviceId(deviceIdFromQuery);
      return;
    }

    if (!selectedDeviceId && devices[0]) {
      setSelectedDeviceId(
        devices.find((device) => device.status !== "healthy")?.id ?? devices[0].id,
      );
    }
  }, [devices, searchParams, selectedDeviceId]);

  const mutation = useMutation({
    mutationFn: (workflowId: string) =>
      runAutomation({
        workflowId,
        deviceId: selectedDeviceId,
      }),
    onSuccess: (result) => {
      setQueuedRuns((current) => [result, ...current]);
      setMessage(`Queued ${result.workflowName} for ${result.deviceName}.`);
    },
  });

  const preferredWorkflow = searchParams.get("workflow");
  const workflows = preferredWorkflow
    ? [...(workflowsQuery.data ?? [])].sort((left, right) => {
        const leftMatch =
          left.id === preferredWorkflow ||
          left.name === preferredWorkflow ||
          left.triggers.includes(preferredWorkflow);
        const rightMatch =
          right.id === preferredWorkflow ||
          right.name === preferredWorkflow ||
          right.triggers.includes(preferredWorkflow);
        return Number(rightMatch) - Number(leftMatch);
      })
    : (workflowsQuery.data ?? []);
  const runs = [...queuedRuns, ...(runsQuery.data ?? [])];

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Automation"
        title="Workflow automation"
        description="Available workflows, recent runs, success and failure logs, and recovery actions. The interactions match the backend plan for POST /automation/run and run history."
      />

      <section className="three-column-grid">
        <MetricCard
          label="Recommended"
          value={`${workflows.filter((workflow) => workflow.recommended).length}`}
          delta="core workflows"
          detail="high-value playbooks"
          tone="healthy"
        />
        <MetricCard
          label="Running"
          value={`${runs.filter((run) => run.status === "running").length}`}
          delta="active jobs"
          detail="automation pressure"
          tone="warning"
        />
        <MetricCard
          label="Failed"
          value={`${runs.filter((run) => run.status === "failed").length}`}
          delta="manual review needed"
          detail="escalation queue"
          tone="critical"
        />
      </section>

      <SectionCard
        eyebrow="Target"
        title="Execution target"
        description="Choose the device that a workflow should run against before triggering recovery or validation."
      >
        <select
          className="select-field"
          value={selectedDeviceId}
          onChange={(event) => {
            const nextDeviceId = event.target.value;
            const workflow = searchParams.get("workflow");
            setSelectedDeviceId(nextDeviceId);
            if (workflow) {
              setSearchParams({ deviceId: nextDeviceId, workflow });
            } else {
              setSearchParams({ deviceId: nextDeviceId });
            }
          }}
        >
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name}
            </option>
          ))}
        </select>
      </SectionCard>

      {message ? <div className="tone-chip tone-chip--healthy">{message}</div> : null}

      <SectionCard
        eyebrow="Playbooks"
        title="Available workflows"
        description="These are the recovery actions highlighted in the project plan."
      >
        <div className="cluster-grid">
          {workflows.map((workflow) => (
            <article className="surface-card" key={workflow.id}>
              <div className="stack">
                <div className="status-row">
                  <StatusBadge
                    label={workflow.lastRunStatus}
                    tone={
                      workflow.lastRunStatus === "failed"
                        ? "critical"
                        : workflow.lastRunStatus === "running"
                          ? "warning"
                          : workflow.lastRunStatus === "queued"
                            ? "info"
                            : "healthy"
                    }
                  />
                  {workflow.recommended ? (
                    <span className="tone-chip tone-chip--healthy">recommended</span>
                  ) : null}
                  {preferredWorkflow &&
                  (workflow.id === preferredWorkflow ||
                    workflow.name === preferredWorkflow ||
                    workflow.triggers.includes(preferredWorkflow)) ? (
                    <span className="tone-chip tone-chip--info">preferred</span>
                  ) : null}
                </div>
                <div>
                  <strong>{workflow.name}</strong>
                  <div className="small-text muted-text">{workflow.category}</div>
                </div>
                <div className="muted-text">{workflow.description}</div>
                <div className="pill-row">
                  {workflow.triggers.map((trigger) => (
                    <span className="pill" key={trigger}>
                      {trigger}
                    </span>
                  ))}
                </div>
                  <button
                    className="button button--teal"
                    disabled={mutation.isPending || devices.length === 0 || !selectedDeviceId}
                    onClick={() => mutation.mutate(workflow.id)}
                    type="button"
                  >
                    Run on selected device
                  </button>
                </div>
              </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Execution"
        title="Recent automation runs"
        description="Success and failure traces that feed the incident and dashboard views."
      >
        <DataTable
          rows={runs}
          getRowKey={(run) => run.id}
          columns={[
            {
              key: "workflow",
              header: "Workflow",
              render: (run) => (
                <div>
                  <strong>{run.workflowName}</strong>
                  <div className="small-text muted-text">{run.deviceName}</div>
                </div>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (run) => (
                <StatusBadge
                  label={run.status}
                  tone={
                    run.status === "failed"
                      ? "critical"
                      : run.status === "running"
                        ? "warning"
                        : run.status === "queued"
                          ? "info"
                          : "healthy"
                  }
                />
              ),
            },
            {
              key: "duration",
              header: "Duration",
              render: (run) => `${run.durationMinutes} min`,
            },
            {
              key: "result",
              header: "Result",
              render: (run) => run.result,
            },
            {
              key: "started",
              header: "Started",
              render: (run) => formatTimestamp(run.startedAt),
            },
          ]}
        />
      </SectionCard>
    </div>
  );
}
