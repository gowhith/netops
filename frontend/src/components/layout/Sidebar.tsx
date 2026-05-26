import { NavLink } from "react-router-dom";
import { useAlertStore } from "../../stores/alertStore";
import { useDeviceStore } from "../../stores/deviceStore";
import { useIncidentStore } from "../../stores/incidentStore";
import { cn } from "../../lib/utils";

interface SidebarNavItem {
  to: string;
  label: string;
  caption: string;
  countKey:
    | "devices"
    | "topology"
    | "alerts"
    | "incidents"
    | "configs"
    | "runs"
    | "reports"
    | "settings";
}

const navItems: SidebarNavItem[] = [
  {
    to: "/",
    label: "Overview",
    caption: "Live NOC posture",
    countKey: "devices",
  },
  {
    to: "/topology",
    label: "Topology",
    caption: "Link health",
    countKey: "topology",
  },
  {
    to: "/devices",
    label: "Devices",
    caption: "Inventory + detail",
    countKey: "devices",
  },
  {
    to: "/alerts",
    label: "Alerts",
    caption: "Threshold + drift",
    countKey: "alerts",
  },
  {
    to: "/incidents",
    label: "Incidents",
    caption: "Lifecycle tracking",
    countKey: "incidents",
  },
  {
    to: "/configs",
    label: "Configs",
    caption: "Baseline + rollback",
    countKey: "configs",
  },
  {
    to: "/automation",
    label: "Automation",
    caption: "Workflow control",
    countKey: "runs",
  },
  {
    to: "/reports",
    label: "Reports",
    caption: "SLA + exports",
    countKey: "reports",
  },
  {
    to: "/settings",
    label: "Settings",
    caption: "Users + thresholds",
    countKey: "settings",
  },
];

export function Sidebar() {
  const devices = useDeviceStore((state) => state.devices);
  const alerts = useAlertStore((state) => state.alerts);
  const incidents = useIncidentStore((state) => state.incidents);

  const counts = {
    devices: devices.length,
    topology: devices.filter((device) => device.status !== "healthy").length,
    alerts: alerts.filter((alert) => alert.status === "open").length,
    incidents: incidents.filter((incident) => incident.status !== "resolved").length,
    configs: devices.filter((device) => device.configDrift).length,
    runs: 4,
    reports: 4,
    settings: 3,
  } as const;

  const criticalCount = devices.filter(
    (device) => device.status === "critical" || device.status === "offline",
  ).length;

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">NA</div>
        <div>
          <div className="sidebar__eyebrow">Command Center</div>
          <h2 className="sidebar__title">NetOps AI</h2>
          <p className="sidebar__subtitle">Real-time network operations cockpit</p>
        </div>
      </div>

      <section className="sidebar__group">
        <h3 className="sidebar__group-title">Operations</h3>
        <nav className="nav-list">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => cn("nav-item", isActive && "active")}
            >
              <div className="nav-item__label">
                <strong>{item.label}</strong>
                <span className="nav-item__caption">{item.caption}</span>
              </div>
              <span className="nav-item__badge">{counts[item.countKey]}</span>
            </NavLink>
          ))}
        </nav>
      </section>

      <section className="sidebar__footer">
        <div className="sidebar__eyebrow">Risk Watch</div>
        <h4>{criticalCount} nodes need attention</h4>
        <p>
          Critical device health, missing heartbeat, and config drift are surfaced here first so
          NOC triage stays focused.
        </p>
      </section>
    </aside>
  );
}
