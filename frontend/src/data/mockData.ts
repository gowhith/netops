import type { Alert } from "../types/alert";
import type {
  AutomationRun,
  AutomationWorkflow,
} from "../types/automation";
import type { DeviceConfigSnapshot } from "../types/config";
import type { DashboardBootstrap } from "../types/dashboard";
import type { Device, DeviceStatus, DeviceType } from "../types/device";
import type { Incident } from "../types/incident";
import type { ReportTemplate } from "../types/report";
import type { AppSettings } from "../types/settings";
import type { TelemetrySample } from "../types/telemetry";
import type { TopologyEdge, TopologyNode } from "../types/topology";
import {
  calculateHealthScore,
  clamp,
  inferDeviceStatus,
} from "../lib/utils";

interface DeviceSeed {
  id: string;
  name: string;
  type: DeviceType;
  ipAddress: string;
  location: string;
  group: string;
  model: string;
  firmwareVersion: string;
  uptimePercent: number;
  baseCpu: number;
  baseMemory: number;
  baseLatency: number;
  basePacketLoss: number;
  baseBandwidth: number;
  configDrift: boolean;
  statusBias?: DeviceStatus;
}

const deviceSeeds: DeviceSeed[] = [
  {
    id: "router-01",
    name: "San Jose Core Router",
    type: "router",
    ipAddress: "10.20.1.1",
    location: "San Jose DC-1",
    group: "Core Backbone",
    model: "Catalyst 8500",
    firmwareVersion: "17.12.2",
    uptimePercent: 99.96,
    baseCpu: 42,
    baseMemory: 58,
    baseLatency: 34,
    basePacketLoss: 0.3,
    baseBandwidth: 820,
    configDrift: false,
  },
  {
    id: "switch-07",
    name: "Bay Campus Switch",
    type: "switch",
    ipAddress: "10.20.4.21",
    location: "San Francisco Campus",
    group: "Campus Access",
    model: "Catalyst 9300",
    firmwareVersion: "17.9.5",
    uptimePercent: 99.72,
    baseCpu: 56,
    baseMemory: 61,
    baseLatency: 68,
    basePacketLoss: 0.8,
    baseBandwidth: 630,
    configDrift: true,
    statusBias: "degraded",
  },
  {
    id: "ap-12",
    name: "Austin West AP",
    type: "access-point",
    ipAddress: "10.31.8.14",
    location: "Austin HQ",
    group: "Wireless Edge",
    model: "Catalyst 9130",
    firmwareVersion: "17.9.3",
    uptimePercent: 98.8,
    baseCpu: 74,
    baseMemory: 76,
    baseLatency: 128,
    basePacketLoss: 2.4,
    baseBandwidth: 410,
    configDrift: false,
    statusBias: "warning",
  },
  {
    id: "edge-03",
    name: "Phoenix Edge Node",
    type: "edge-node",
    ipAddress: "10.44.2.7",
    location: "Phoenix POP",
    group: "Regional Edge",
    model: "ISR 4461",
    firmwareVersion: "17.10.1",
    uptimePercent: 97.4,
    baseCpu: 86,
    baseMemory: 82,
    baseLatency: 214,
    basePacketLoss: 5.6,
    baseBandwidth: 270,
    configDrift: true,
    statusBias: "critical",
  },
  {
    id: "router-09",
    name: "Seattle Backbone Router",
    type: "router",
    ipAddress: "10.55.1.2",
    location: "Seattle Backbone",
    group: "Core Backbone",
    model: "ASR 1001-X",
    firmwareVersion: "17.11.1",
    uptimePercent: 99.92,
    baseCpu: 48,
    baseMemory: 54,
    baseLatency: 46,
    basePacketLoss: 0.5,
    baseBandwidth: 920,
    configDrift: false,
  },
  {
    id: "switch-15",
    name: "Denver Branch Switch",
    type: "switch",
    ipAddress: "10.62.12.5",
    location: "Denver Branch",
    group: "Branch Access",
    model: "Catalyst 9200",
    firmwareVersion: "17.9.4",
    uptimePercent: 96.1,
    baseCpu: 18,
    baseMemory: 29,
    baseLatency: 320,
    basePacketLoss: 9.1,
    baseBandwidth: 55,
    configDrift: true,
    statusBias: "offline",
  },
  {
    id: "ap-22",
    name: "Irvine Lab AP",
    type: "access-point",
    ipAddress: "10.91.3.18",
    location: "Irvine Test Lab",
    group: "Wireless Lab",
    model: "Meraki MR46",
    firmwareVersion: "29.6.1",
    uptimePercent: 99.31,
    baseCpu: 51,
    baseMemory: 52,
    baseLatency: 58,
    basePacketLoss: 0.9,
    baseBandwidth: 388,
    configDrift: false,
  },
  {
    id: "edge-11",
    name: "Dallas POP Edge",
    type: "edge-node",
    ipAddress: "10.73.9.3",
    location: "Dallas POP",
    group: "Regional Edge",
    model: "ISR 4431",
    firmwareVersion: "17.10.2",
    uptimePercent: 98.6,
    baseCpu: 63,
    baseMemory: 66,
    baseLatency: 112,
    basePacketLoss: 1.8,
    baseBandwidth: 510,
    configDrift: false,
    statusBias: "warning",
  },
];

function makeTimestamp(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function buildHistory(seed: DeviceSeed, seedOffset: number) {
  return Array.from({ length: 24 }, (_, index) => {
    const oscillation = Math.sin((index + seedOffset) / 3) * 8;
    const cpuBurst = seed.statusBias === "critical" && index > 18 ? 12 : 0;
    const latencyBurst =
      seed.statusBias === "warning" && index > 17
        ? 28
        : seed.statusBias === "critical" && index > 18
          ? 56
          : seed.statusBias === "offline" && index > 17
            ? 130
            : 0;
    const packetBurst =
      seed.statusBias === "critical" && index > 17
        ? 2.6
        : seed.statusBias === "offline" && index > 18
          ? 3.8
          : 0;
    const cpu = clamp(seed.baseCpu + oscillation + cpuBurst, 8, 99);
    const memory = clamp(seed.baseMemory + oscillation * 0.6 + cpuBurst * 0.7, 18, 98);
    const latencyMs = clamp(seed.baseLatency + oscillation * 3.4 + latencyBurst, 18, 420);
    const packetLossPercent = clamp(
      seed.basePacketLoss + Math.max(oscillation / 9, 0) + packetBurst,
      0,
      15,
    );
    const bandwidthMbps = clamp(
      seed.baseBandwidth + Math.cos((index + seedOffset) / 2.8) * 52 - packetBurst * 20,
      24,
      1200,
    );

    let status = inferDeviceStatus({
      cpu,
      latencyMs,
      packetLossPercent,
    });

    if (seed.statusBias === "offline" && index > 19) {
      status = "offline";
    } else if (seed.statusBias === "degraded" && status === "healthy") {
      status = "degraded";
    }

    return {
      deviceId: seed.id,
      timestamp: makeTimestamp((23 - index) * 5),
      cpu,
      memory,
      latencyMs,
      packetLossPercent,
      bandwidthMbps,
      interfaceStatus: status === "offline" ? "down" : status === "degraded" ? "degraded" : "up",
      status,
    } satisfies TelemetrySample;
  });
}

export const telemetryHistory: Record<string, TelemetrySample[]> = Object.fromEntries(
  deviceSeeds.map((seed, index) => [seed.id, buildHistory(seed, index + 1)]),
);

export const devices: Device[] = deviceSeeds.map((seed) => {
  const latest = telemetryHistory[seed.id][telemetryHistory[seed.id].length - 1];
  const healthScore =
    latest.status === "offline" ? 18 : calculateHealthScore(latest);
  const reliabilityScore = clamp(
    Math.round(seed.uptimePercent - latest.packetLossPercent * 2 + healthScore * 0.12),
    15,
    100,
  );

  return {
    id: seed.id,
    name: seed.name,
    type: seed.type,
    ipAddress: seed.ipAddress,
    location: seed.location,
    group: seed.group,
    model: seed.model,
    firmwareVersion: seed.firmwareVersion,
    status: latest.status,
    healthScore,
    reliabilityScore,
    uptimePercent: seed.uptimePercent,
    cpu: latest.cpu,
    memory: latest.memory,
    latencyMs: latest.latencyMs,
    packetLossPercent: latest.packetLossPercent,
    bandwidthMbps: latest.bandwidthMbps,
    configDrift: seed.configDrift,
    lastHeartbeat:
      latest.status === "offline" ? makeTimestamp(48) : latest.timestamp,
  };
});

export const alerts: Alert[] = [
  {
    id: "alert-401",
    severity: "critical",
    status: "open",
    deviceId: "edge-03",
    deviceName: "Phoenix Edge Node",
    reason: "Packet loss sustained above 5% for 12 minutes",
    suggestedAction: "Run rollback-config and isolate degraded uplink",
    source: "rules-engine",
    timestamp: makeTimestamp(4),
  },
  {
    id: "alert-402",
    severity: "critical",
    status: "acknowledged",
    deviceId: "switch-15",
    deviceName: "Denver Branch Switch",
    reason: "Heartbeat missing for 30 seconds",
    suggestedAction: "Trigger restart-device-agent workflow",
    source: "heartbeat-monitor",
    timestamp: makeTimestamp(8),
  },
  {
    id: "alert-403",
    severity: "warning",
    status: "open",
    deviceId: "ap-12",
    deviceName: "Austin West AP",
    reason: "CPU above warning threshold at 83%",
    suggestedAction: "Inspect rogue client load and radio retries",
    source: "telemetry-threshold",
    timestamp: makeTimestamp(17),
  },
  {
    id: "alert-404",
    severity: "warning",
    status: "open",
    deviceId: "switch-07",
    deviceName: "Bay Campus Switch",
    reason: "Config drift detected against approved baseline",
    suggestedAction: "Review staged ACL updates before committing",
    source: "config-drift",
    timestamp: makeTimestamp(28),
  },
  {
    id: "alert-405",
    severity: "info",
    status: "resolved",
    deviceId: "router-09",
    deviceName: "Seattle Backbone Router",
    reason: "Telemetry stream resumed after transient collector lag",
    suggestedAction: "No action required",
    source: "websocket-feed",
    timestamp: makeTimestamp(45),
  },
];

export const incidents: Incident[] = [
  {
    id: "inc-1201",
    title: "Phoenix POP packet loss event",
    severity: "critical",
    status: "investigating",
    deviceIds: ["edge-03"],
    affectedServices: ["regional-edge-routing", "vpn-aggregation"],
    rootCause: "Suspected stale QoS policy after emergency ACL push",
    summary:
      "Automation opened the incident after packet loss exceeded the critical threshold and a rollback candidate was detected.",
    openedAt: makeTimestamp(18),
    updatedAt: makeTimestamp(3),
    automationActions: [
      "Created incident record",
      "Validated current config against baseline",
      "Queued rollback-config workflow",
    ],
    timeline: [
      {
        id: "evt-1",
        timestamp: makeTimestamp(18),
        title: "Critical threshold breached",
        detail: "Packet loss crossed 5.2% while latency rose above 240 ms.",
      },
      {
        id: "evt-2",
        timestamp: makeTimestamp(13),
        title: "Config drift confirmed",
        detail: "Routing policy differs from approved branch baseline.",
      },
      {
        id: "evt-3",
        timestamp: makeTimestamp(6),
        title: "Rollback staged",
        detail: "Workflow pending engineer approval for interface policy revert.",
      },
    ],
  },
  {
    id: "inc-1202",
    title: "Denver branch switch heartbeat loss",
    severity: "critical",
    status: "mitigated",
    deviceIds: ["switch-15"],
    affectedServices: ["branch-lan"],
    rootCause: "Simulated device agent process stopped after interface flap",
    summary:
      "Restart workflow restored heartbeat, but branch access remains under watch until traffic normalizes.",
    openedAt: makeTimestamp(42),
    updatedAt: makeTimestamp(11),
    automationActions: [
      "Restarted device simulator agent",
      "Re-registered telemetry consumer state",
      "Opened follow-up diagnostics task",
    ],
    timeline: [
      {
        id: "evt-4",
        timestamp: makeTimestamp(42),
        title: "Device marked offline",
        detail: "Heartbeat monitor marked the switch offline after 30 seconds.",
      },
      {
        id: "evt-5",
        timestamp: makeTimestamp(31),
        title: "Automation triggered",
        detail: "Restart-device-agent succeeded on first retry.",
      },
      {
        id: "evt-6",
        timestamp: makeTimestamp(11),
        title: "Service partially restored",
        detail: "Heartbeat resumed; packet loss still above branch baseline.",
      },
    ],
  },
  {
    id: "inc-1203",
    title: "Austin wireless congestion",
    severity: "warning",
    status: "open",
    deviceIds: ["ap-12"],
    affectedServices: ["guest-wireless"],
    rootCause: "High-density client spike during staging window",
    summary:
      "Wireless utilization is elevated, but no rollback is recommended yet because the device remains reachable.",
    openedAt: makeTimestamp(63),
    updatedAt: makeTimestamp(16),
    automationActions: ["Raised advisory alert", "Pinned device to watchlist"],
    timeline: [
      {
        id: "evt-7",
        timestamp: makeTimestamp(63),
        title: "Congestion detected",
        detail: "CPU and retry rates increased on the 5 GHz radio set.",
      },
      {
        id: "evt-8",
        timestamp: makeTimestamp(16),
        title: "Watchlist refreshed",
        detail: "Device remains in warning while traffic tapers.",
      },
    ],
  },
];

export const configs: Record<string, DeviceConfigSnapshot> = {
  "router-01": {
    deviceId: "router-01",
    driftStatus: "compliant",
    complianceScore: 98,
    rollbackTarget: "v2026.05.15-core",
    baselineConfig: `hostname sj-core-01
interface Gig0/0
 description WAN-UPLINK
 qos-profile gold
 router ospf 200
  network 10.20.0.0/16 area 0`,
    currentConfig: `hostname sj-core-01
interface Gig0/0
 description WAN-UPLINK
 qos-profile gold
 router ospf 200
  network 10.20.0.0/16 area 0`,
    versions: [
      {
        id: "cfg-r1-1",
        versionLabel: "v2026.05.15-core",
        author: "NetOps AI",
        createdAt: makeTimestamp(530),
        summary: "Quarterly QoS validation",
      },
      {
        id: "cfg-r1-2",
        versionLabel: "v2026.05.05-core",
        author: "NOC Admin",
        createdAt: makeTimestamp(1440),
        summary: "BGP neighbor timer tune",
      },
    ],
  },
  "switch-07": {
    deviceId: "switch-07",
    driftStatus: "drift-detected",
    complianceScore: 71,
    rollbackTarget: "v2026.05.12-campus",
    baselineConfig: `hostname sf-campus-07
spanning-tree mode rapid-pvst
vlan 20
 name corp-users
ip access-list extended CAMPUS-USER-ACL
 permit tcp any 10.20.0.0 0.0.255.255 eq 443`,
    currentConfig: `hostname sf-campus-07
spanning-tree mode rapid-pvst
vlan 30
 name contractors
ip access-list extended CAMPUS-USER-ACL
 deny tcp any 10.20.0.0 0.0.255.255 eq 443`,
    versions: [
      {
        id: "cfg-s7-1",
        versionLabel: "v2026.05.12-campus",
        author: "Policy Engine",
        createdAt: makeTimestamp(700),
        summary: "Approved ACL baseline",
      },
      {
        id: "cfg-s7-2",
        versionLabel: "v2026.05.02-campus",
        author: "NetOps AI",
        createdAt: makeTimestamp(2200),
        summary: "VLAN naming clean-up",
      },
    ],
  },
  "ap-12": {
    deviceId: "ap-12",
    driftStatus: "compliant",
    complianceScore: 89,
    rollbackTarget: "v2026.05.10-wireless",
    baselineConfig: `hostname austin-west-ap12
ssid CorpSecure
 channel-width 40
 rogue-detection enabled`,
    currentConfig: `hostname austin-west-ap12
ssid CorpSecure
 channel-width 40
 rogue-detection enabled`,
    versions: [
      {
        id: "cfg-ap12-1",
        versionLabel: "v2026.05.10-wireless",
        author: "Wireless Team",
        createdAt: makeTimestamp(880),
        summary: "Radio profile tune",
      },
    ],
  },
  "edge-03": {
    deviceId: "edge-03",
    driftStatus: "drift-detected",
    complianceScore: 56,
    rollbackTarget: "v2026.05.16-edge",
    baselineConfig: `hostname phx-edge-03
policy-map WAN-EDGE-QOS
 class realtime
  priority percent 20
ip route 0.0.0.0 0.0.0.0 10.44.2.1`,
    currentConfig: `hostname phx-edge-03
policy-map WAN-EDGE-QOS
 class realtime
  priority percent 5
ip route 0.0.0.0 0.0.0.0 10.44.2.254`,
    versions: [
      {
        id: "cfg-e3-1",
        versionLabel: "v2026.05.16-edge",
        author: "Automation Engine",
        createdAt: makeTimestamp(260),
        summary: "Primary edge baseline",
      },
      {
        id: "cfg-e3-2",
        versionLabel: "v2026.05.09-edge",
        author: "Network Engineer",
        createdAt: makeTimestamp(1800),
        summary: "Backup route preference tune",
      },
    ],
  },
  "router-09": {
    deviceId: "router-09",
    driftStatus: "compliant",
    complianceScore: 97,
    rollbackTarget: "v2026.05.13-core",
    baselineConfig: `hostname sea-core-09
router bgp 65100
 neighbor 10.55.1.254 remote-as 65200`,
    currentConfig: `hostname sea-core-09
router bgp 65100
 neighbor 10.55.1.254 remote-as 65200`,
    versions: [
      {
        id: "cfg-r9-1",
        versionLabel: "v2026.05.13-core",
        author: "NOC Admin",
        createdAt: makeTimestamp(620),
        summary: "Transit peer validation",
      },
    ],
  },
  "switch-15": {
    deviceId: "switch-15",
    driftStatus: "drift-detected",
    complianceScore: 48,
    rollbackTarget: "v2026.05.03-branch",
    baselineConfig: `hostname den-branch-15
spanning-tree mode mst
interface Vlan10
 ip address 10.62.12.5 255.255.255.0`,
    currentConfig: `hostname den-branch-15
spanning-tree mode pvst
interface Vlan30
 ip address 10.62.99.5 255.255.255.0`,
    versions: [
      {
        id: "cfg-s15-1",
        versionLabel: "v2026.05.03-branch",
        author: "Branch Ops",
        createdAt: makeTimestamp(3200),
        summary: "Known good branch baseline",
      },
    ],
  },
  "ap-22": {
    deviceId: "ap-22",
    driftStatus: "compliant",
    complianceScore: 94,
    rollbackTarget: "v2026.05.11-lab",
    baselineConfig: `hostname irvine-lab-ap22
ssid ValidationLab
 channel-width 20`,
    currentConfig: `hostname irvine-lab-ap22
ssid ValidationLab
 channel-width 20`,
    versions: [
      {
        id: "cfg-ap22-1",
        versionLabel: "v2026.05.11-lab",
        author: "Lab Team",
        createdAt: makeTimestamp(900),
        summary: "Baseline lab SSID policy",
      },
    ],
  },
  "edge-11": {
    deviceId: "edge-11",
    driftStatus: "compliant",
    complianceScore: 86,
    rollbackTarget: "v2026.05.14-edge",
    baselineConfig: `hostname dal-edge-11
policy-map BRANCH-QOS
 class business-critical
  bandwidth percent 25`,
    currentConfig: `hostname dal-edge-11
policy-map BRANCH-QOS
 class business-critical
  bandwidth percent 25`,
    versions: [
      {
        id: "cfg-e11-1",
        versionLabel: "v2026.05.14-edge",
        author: "Automation Engine",
        createdAt: makeTimestamp(510),
        summary: "Edge refresh baseline",
      },
    ],
  },
};

export const workflows: AutomationWorkflow[] = [
  {
    id: "restart-device-agent",
    name: "Restart Device Agent",
    category: "Recovery",
    description: "Restarts the simulator or telemetry agent and re-validates heartbeat.",
    triggers: ["heartbeat missing", "device offline"],
    recommended: true,
    successRate: 91,
    averageDurationMinutes: 3,
    lastRunStatus: "success",
  },
  {
    id: "rollback-config",
    name: "Rollback Config",
    category: "Configuration",
    description: "Restores the last approved baseline when drift is confirmed.",
    triggers: ["config drift", "latency spike after change"],
    recommended: true,
    successRate: 82,
    averageDurationMinutes: 6,
    lastRunStatus: "running",
  },
  {
    id: "isolate-node",
    name: "Isolate Degraded Node",
    category: "Containment",
    description: "Moves a failing device out of the active topology until metrics stabilize.",
    triggers: ["sustained packet loss", "link instability"],
    recommended: false,
    successRate: 77,
    averageDurationMinutes: 4,
    lastRunStatus: "queued",
  },
  {
    id: "open-incident",
    name: "Create Incident + Notify",
    category: "Escalation",
    description: "Creates an incident record, posts to alert channels, and updates the dashboard feed.",
    triggers: ["critical telemetry", "automation failure"],
    recommended: true,
    successRate: 97,
    averageDurationMinutes: 2,
    lastRunStatus: "success",
  },
  {
    id: "validate-config",
    name: "Validate Config",
    category: "Compliance",
    description: "Runs a baseline comparison before or after a network change.",
    triggers: ["change window", "pre-deploy check"],
    recommended: false,
    successRate: 94,
    averageDurationMinutes: 5,
    lastRunStatus: "success",
  },
];

export const runs: AutomationRun[] = [
  {
    id: "run-100",
    workflowId: "rollback-config",
    workflowName: "Rollback Config",
    deviceName: "Phoenix Edge Node",
    status: "running",
    startedAt: makeTimestamp(5),
    durationMinutes: 6,
    result: "Validating diff against approved edge baseline",
  },
  {
    id: "run-101",
    workflowId: "restart-device-agent",
    workflowName: "Restart Device Agent",
    deviceName: "Denver Branch Switch",
    status: "success",
    startedAt: makeTimestamp(23),
    durationMinutes: 3,
    result: "Heartbeat restored and telemetry resumed",
  },
  {
    id: "run-102",
    workflowId: "open-incident",
    workflowName: "Create Incident + Notify",
    deviceName: "Austin West AP",
    status: "success",
    startedAt: makeTimestamp(74),
    durationMinutes: 2,
    result: "Incident posted to NOC feed",
  },
  {
    id: "run-103",
    workflowId: "validate-config",
    workflowName: "Validate Config",
    deviceName: "Bay Campus Switch",
    status: "failed",
    startedAt: makeTimestamp(132),
    durationMinutes: 5,
    result: "ACL mismatch requires manual approval",
  },
];

export const reports: ReportTemplate[] = [
  {
    id: "uptime",
    title: "Uptime & SLA",
    description: "Tracks uptime, availability by site, and SLA exposure over rolling windows.",
    primaryFormat: "pdf",
    lastGenerated: makeTimestamp(90),
  },
  {
    id: "incidents",
    title: "Incident Review",
    description: "Summarizes MTTR, top failure domains, and incident lifecycle outcomes.",
    primaryFormat: "json",
    lastGenerated: makeTimestamp(180),
  },
  {
    id: "config-compliance",
    title: "Config Compliance",
    description: "Highlights drift, rollback readiness, and baseline coverage across device groups.",
    primaryFormat: "csv",
    lastGenerated: makeTimestamp(245),
  },
  {
    id: "reliability",
    title: "Reliability Summary",
    description: "Rolls up health score trends and automation effectiveness by environment.",
    primaryFormat: "pdf",
    lastGenerated: makeTimestamp(300),
  },
];

export const topologyNodes: TopologyNode[] = [
  {
    id: "router-01",
    label: "San Jose Core",
    role: "Core Router",
    status: "healthy",
    x: 180,
    y: 140,
  },
  {
    id: "router-09",
    label: "Seattle Core",
    role: "Backbone Router",
    status: "healthy",
    x: 500,
    y: 100,
  },
  {
    id: "switch-07",
    label: "Bay Campus",
    role: "Campus Switch",
    status: "degraded",
    x: 320,
    y: 280,
  },
  {
    id: "ap-12",
    label: "Austin West",
    role: "Access Point",
    status: "warning",
    x: 680,
    y: 220,
  },
  {
    id: "edge-03",
    label: "Phoenix POP",
    role: "Edge Node",
    status: "critical",
    x: 480,
    y: 420,
  },
  {
    id: "switch-15",
    label: "Denver Branch",
    role: "Branch Switch",
    status: "offline",
    x: 220,
    y: 480,
  },
  {
    id: "ap-22",
    label: "Irvine Lab",
    role: "Lab AP",
    status: "healthy",
    x: 110,
    y: 350,
  },
  {
    id: "edge-11",
    label: "Dallas POP",
    role: "Edge Node",
    status: "warning",
    x: 760,
    y: 420,
  },
];

export const topologyEdges: TopologyEdge[] = [
  {
    id: "edge-1",
    source: "router-01",
    target: "router-09",
    health: "stable",
    latencyMs: 32,
  },
  {
    id: "edge-2",
    source: "router-01",
    target: "switch-07",
    health: "stable",
    latencyMs: 18,
  },
  {
    id: "edge-3",
    source: "switch-07",
    target: "ap-22",
    health: "stable",
    latencyMs: 14,
  },
  {
    id: "edge-4",
    source: "router-09",
    target: "ap-12",
    health: "degraded",
    latencyMs: 132,
  },
  {
    id: "edge-5",
    source: "switch-07",
    target: "edge-03",
    health: "failed",
    latencyMs: 264,
  },
  {
    id: "edge-6",
    source: "router-01",
    target: "switch-15",
    health: "failed",
    latencyMs: 300,
  },
  {
    id: "edge-7",
    source: "router-09",
    target: "edge-11",
    health: "degraded",
    latencyMs: 140,
  },
];

export const settings: AppSettings = {
  users: [
    {
      id: "usr-1",
      name: "Gowthith K",
      role: "admin",
      email: "gowthith@netops.local",
      timezone: "America/Los_Angeles",
    },
    {
      id: "usr-2",
      name: "NOC Rotation",
      role: "engineer",
      email: "noc@netops.local",
      timezone: "America/Chicago",
    },
    {
      id: "usr-3",
      name: "Ops Viewer",
      role: "viewer",
      email: "viewer@netops.local",
      timezone: "America/New_York",
    },
  ],
  alertThresholds: {
    cpuWarning: 75,
    cpuCritical: 90,
    latencyWarning: 120,
    latencyCritical: 200,
    packetLossWarning: 2,
    packetLossCritical: 5,
  },
  notificationChannels: [
    {
      id: "nc-1",
      type: "email",
      target: "noc-alerts@netops.local",
      enabled: true,
    },
    {
      id: "nc-2",
      type: "webhook",
      target: "https://hooks.internal/netops/incidents",
      enabled: true,
    },
    {
      id: "nc-3",
      type: "slack",
      target: "#noc-ops",
      enabled: false,
    },
  ],
  deviceGroups: [
    "Core Backbone",
    "Campus Access",
    "Regional Edge",
    "Branch Access",
    "Wireless Edge",
    "Wireless Lab",
  ],
};

export const mockBootstrapData: DashboardBootstrap = {
  devices,
  alerts,
  incidents,
  telemetry: telemetryHistory,
  configs,
  workflows,
  runs,
  reports,
  topology: {
    nodes: topologyNodes,
    edges: topologyEdges,
  },
  settings,
};
