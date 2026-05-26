import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { TopologyCanvas } from "../components/topology/TopologyCanvas";
import { buildTopologyFromDevices, getTopology } from "../lib/api";
import { useDeviceStore } from "../stores/deviceStore";

export function TopologyPage() {
  const topologyQuery = useQuery({
    queryKey: ["topology"],
    queryFn: getTopology,
  });
  const devices = useDeviceStore((state) => state.devices);
  const topology = devices.length > 0 ? buildTopologyFromDevices(devices) : topologyQuery.data;

  const degradedCount = devices.filter((device) => device.status === "degraded").length;
  const failedCount = devices.filter(
    (device) => device.status === "critical" || device.status === "offline",
  ).length;

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Topology"
        title="Network topology map"
        description="An enterprise-style network view for routers, switches, access points, and edge nodes. This page follows the plan's topology requirement and is ready to swap to React Flow later if needed."
      />

      <section className="three-column-grid">
        <MetricCard
          label="Core backbone"
          value={`${devices.filter((device) => device.group === "Core Backbone").length}`}
          delta={`${failedCount} critical/offline`}
          detail="nodes under supervision"
          tone={failedCount > 0 ? "critical" : "healthy"}
        />
        <MetricCard
          label="Degraded links"
          value={`${degradedCount}`}
          delta="watch latency pathing"
          detail="warning routes"
          tone={degradedCount > 0 ? "warning" : "healthy"}
        />
        <MetricCard
          label="Edge clusters"
          value={`${devices.filter((device) => device.group === "Regional Edge").length}`}
          delta="automation ready"
          detail="containment candidates"
          tone="degraded"
        />
      </section>

      <SectionCard
        eyebrow="Live graph"
        title="Logical network fabric"
        description="Link color represents path health and latency between the major clusters. The graph now follows the live device state coming from the backend."
      >
        {topology ? (
          <>
            <TopologyCanvas
              nodes={topology.nodes}
              edges={topology.edges}
            />
            <div className="topology__legend">
              <span className="tone-chip tone-chip--healthy">stable link</span>
              <span className="tone-chip tone-chip--warning">degraded link</span>
              <span className="tone-chip tone-chip--critical">failed link</span>
            </div>
          </>
        ) : (
          <div className="empty-state">Rendering topology map...</div>
        )}
      </SectionCard>
    </div>
  );
}
