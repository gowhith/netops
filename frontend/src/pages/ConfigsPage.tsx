import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { getConfig, rollbackConfig, validateConfig } from "../lib/api";
import { diffConfigLines, formatTimestamp } from "../lib/utils";
import { useDeviceStore } from "../stores/deviceStore";

export function ConfigsPage() {
  const devices = useDeviceStore((state) => state.devices);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [message, setMessage] = useState("");

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
      const drifted = devices.find((device) => device.configDrift);
      setSelectedDeviceId(drifted?.id ?? devices[0].id);
    }
  }, [devices, searchParams, selectedDeviceId]);

  const configQuery = useQuery({
    queryKey: ["config", selectedDeviceId],
    queryFn: () => getConfig(selectedDeviceId),
    enabled: Boolean(selectedDeviceId),
  });

  const rollbackMutation = useMutation({
    mutationFn: () => rollbackConfig(selectedDeviceId),
    onSuccess: async (result) => {
      setMessage(`Rollback completed through the backend for ${result.deviceId}.`);
      await configQuery.refetch();
    },
  });

  const validateMutation = useMutation({
    mutationFn: () => validateConfig(selectedDeviceId),
    onSuccess: async (result) => {
      setMessage(
        result.driftDetected
          ? `Validation found ${result.differenceCount} drifted fields at ${formatTimestamp(result.checkedAt)}.`
          : `Validation confirmed compliance at ${formatTimestamp(result.checkedAt)}.`,
      );
      await configQuery.refetch();
    },
  });

  const config = configQuery.data;
  const diff = config ? diffConfigLines(config.baselineConfig, config.currentConfig) : [];

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Configs"
        title="Configuration management"
        description="Baseline config, current state, drift, version history, and rollback control. This is a direct frontend implementation of the plan's config drift page."
      />

      <SectionCard
        eyebrow="Select device"
        title="Drift review"
        description="Focus on the current highest-risk device first, then compare baseline against the live config from the backend."
        actions={
          <div className="inline-actions">
            <button
              className="button button--ghost"
              disabled={!selectedDeviceId || validateMutation.isPending}
              onClick={() => validateMutation.mutate()}
              type="button"
            >
              {validateMutation.isPending ? "Validating..." : "Validate drift"}
            </button>
            <button
              className="button button--warning"
              disabled={!selectedDeviceId || rollbackMutation.isPending}
              onClick={() => rollbackMutation.mutate()}
              type="button"
            >
              {rollbackMutation.isPending ? "Rolling back..." : "Rollback to baseline"}
            </button>
          </div>
        }
      >
        <div className="stack">
          <select
            className="select-field"
            value={selectedDeviceId}
            onChange={(event) => {
              const nextDeviceId = event.target.value;
              setSelectedDeviceId(nextDeviceId);
              setSearchParams({ deviceId: nextDeviceId });
            }}
          >
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
          {message ? <div className="tone-chip tone-chip--healthy">{message}</div> : null}
        </div>
      </SectionCard>

      {config ? (
        <>
          <section className="three-column-grid">
            <SectionCard
              eyebrow="Compliance"
              title={`${config.complianceScore}% match`}
              description={`Backend rollback target: ${config.rollbackTarget}`}
            >
              <StatusBadge label={config.driftStatus} tone={config.driftStatus === "drift-detected" ? "critical" : "healthy"} />
            </SectionCard>
            <SectionCard
              eyebrow="Versions"
              title={`${config.versions.length} saved revisions`}
              description="Approved baselines and prior change windows."
            >
              <div className="muted-text">{config.versions[0]?.summary}</div>
            </SectionCard>
            <SectionCard
              eyebrow="Review"
              title="Change surface"
              description="Line-by-line diff highlights what changed from baseline."
            >
              <div className="muted-text">
                {diff.filter((line) => line.changed).length} lines differ.
              </div>
            </SectionCard>
          </section>

          <SectionCard
            eyebrow="Diff"
            title="Baseline vs current config"
            description="Changed lines are highlighted to support rollback decisions."
          >
            <div className="config-grid">
              <div className="config-block">
                {diff.map((line, index) => (
                  <span
                    key={`left-${index}`}
                    className={`code-line ${line.changed ? "code-line--changed" : ""}`}
                  >
                    {line.left || " "}
                  </span>
                ))}
              </div>
              <div className="config-block">
                {diff.map((line, index) => (
                  <span
                    key={`right-${index}`}
                    className={`code-line ${line.changed ? "code-line--changed" : ""}`}
                  >
                    {line.right || " "}
                  </span>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="History"
            title="Version history"
            description="Recent snapshots and approved baselines."
          >
            <div className="timeline">
              {config.versions.map((version) => (
                <div key={version.id} className="timeline__item">
                  <div className="timeline__time">{formatTimestamp(version.createdAt)}</div>
                  <strong>{version.versionLabel}</strong>
                  <div className="muted-text">
                    {version.summary} by {version.author}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      ) : (
        <div className="surface-card empty-state">Loading config snapshot...</div>
      )}
    </div>
  );
}
