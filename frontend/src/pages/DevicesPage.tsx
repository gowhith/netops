import { useDeferredValue, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { formatDeviceType, formatLatency, formatTimestamp } from "../lib/utils";
import { useDeviceStore } from "../stores/deviceStore";
import { useSessionStore } from "../stores/sessionStore";
import type { DeviceStatus } from "../types/device";

const filters: Array<DeviceStatus | "all"> = [
  "all",
  "healthy",
  "warning",
  "degraded",
  "critical",
  "offline",
];

export function DevicesPage() {
  const navigate = useNavigate();
  const devices = useDeviceStore((state) => state.devices);
  const searchQuery = useSessionStore((state) => state.searchQuery);
  const deferredSearch = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | "all">("all");

  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      `${device.name} ${device.location} ${device.group} ${device.ipAddress}`
        .toLowerCase()
        .includes(deferredSearch.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ? true : device.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Inventory"
        title="Device inventory"
        description="All devices in the simulated network with health, status, location, and direct navigation into diagnostics and config review."
      />

      <SectionCard
        eyebrow="Filters"
        title="Inventory controls"
        description="Search is shared from the global top bar, and the status chips help narrow real-time triage."
      >
        <div className="filter-row">
          {filters.map((filter) => (
            <button
              key={filter}
              className={`filter-chip ${statusFilter === filter ? "active" : ""}`}
              onClick={() => setStatusFilter(filter)}
              type="button"
            >
              {filter}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Table"
        title={`${filteredDevices.length} devices in scope`}
        description="The actions now cover the planned view details, diagnostics, config checks, and recovery workflow entry points."
      >
        <DataTable
          rows={filteredDevices}
          getRowKey={(device) => device.id}
          onRowClick={(device) => navigate(`/devices/${device.id}`)}
          columns={[
            {
              key: "device",
              header: "Device",
              render: (device) => (
                <div>
                  <strong>{device.name}</strong>
                  <div className="small-text muted-text">{formatDeviceType(device.type)}</div>
                </div>
              ),
            },
            {
              key: "ip",
              header: "IP address",
              render: (device) => device.ipAddress,
            },
            {
              key: "location",
              header: "Location",
              render: (device) => (
                <div>
                  <div>{device.location}</div>
                  <div className="small-text muted-text">{device.group}</div>
                </div>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (device) => <StatusBadge label={device.status} />,
            },
            {
              key: "health",
              header: "Health",
              render: (device) => `${device.healthScore}`,
            },
            {
              key: "latency",
              header: "Latency",
              render: (device) => formatLatency(device.latencyMs),
            },
            {
              key: "heartbeat",
              header: "Last heartbeat",
              render: (device) => formatTimestamp(device.lastHeartbeat),
            },
              {
                key: "actions",
                header: "Actions",
                render: (device) => (
                  <div className="inline-actions">
                    <Link className="button button--ghost" to={`/devices/${device.id}`}>
                      Details
                    </Link>
                    <Link
                      className="button button--ghost"
                      to={`/devices/${device.id}#telemetry`}
                    >
                      Diagnostics
                    </Link>
                    <Link
                      className="button button--ghost"
                      to={`/configs?deviceId=${device.id}`}
                    >
                      Config
                    </Link>
                    <Link
                      className="button button--ghost"
                      to={`/automation?deviceId=${device.id}&workflow=auto_recovery_offline`}
                    >
                      Recovery
                    </Link>
                  </div>
                ),
              },
          ]}
        />
      </SectionCard>
    </div>
  );
}
