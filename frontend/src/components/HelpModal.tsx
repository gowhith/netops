import { useEffect } from "react";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

interface Section {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
}

const SECTIONS: Section[] = [
  {
    eyebrow: "What is NetOps AI?",
    title: "A live cockpit for network reliability.",
    body: "NetOps AI continuously monitors every device in your network, learns its safe operating baseline, and surfaces anything that drifts — before users feel it. The dashboard is built so you can move from posture → pressure → response without leaving the page.",
    bullets: [
      "Real-time telemetry: CPU, latency, packet loss, uptime, heartbeats.",
      "Auto-detected alerts and correlated incidents with severity scoring.",
      "Config drift detection so production never silently diverges from baseline.",
      "Automation workflows that can roll back, restart, or escalate safely.",
    ],
  },
  {
    eyebrow: "How to read the Overview page",
    title: "Three lanes — posture, pressure, response.",
    body: "The dashboard always answers three questions in order, so you never have to guess where to look first.",
    bullets: [
      "Posture: KPI strip + donut tell you whether the estate is healthy, warming, or in trouble.",
      "Pressure: priority queue, alert bars, and telemetry sparklines show where risk is concentrating.",
      "Response: cohort stability, detection feed, and incident milestones drive the next action.",
    ],
  },
  {
    eyebrow: "Navigating the rest of the app",
    title: "Each tab is one slice of the lifecycle.",
    body: "Use the left sidebar to drill into a specific surface — each one matches a real FastAPI route on the backend.",
    bullets: [
      "Topology — link map of the live estate with health-tinted nodes.",
      "Devices — inventory plus per-device deep dive (history, configs, alerts).",
      "Alerts & Incidents — triage queues with severity, status, and timeline.",
      "Configs — current vs baseline diff with one-click rollback.",
      "Automation — workflow runs and approval gates.",
      "Reports & Settings — SLA exports, thresholds, and user controls.",
    ],
  },
  {
    eyebrow: "Live indicators",
    title: "What the badges and pulses mean.",
    body: "Color and motion are used consistently across the app to keep cognitive load low.",
    bullets: [
      "Green pulse in the top bar = live WebSocket stream is connected.",
      "Amber banner = mock data fallback while live channels finish warming up.",
      "Severity chips: green healthy, amber warning, teal degraded, deep-orange critical.",
      "Sidebar badges are live counters — they re-render every time new data arrives.",
    ],
  },
];

export function HelpModal({ open, onClose }: HelpModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="help-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
      onClick={onClose}
    >
      <div className="help-modal" onClick={(event) => event.stopPropagation()}>
        <header className="help-modal__header">
          <div>
            <span className="help-modal__eyebrow">Operator handbook</span>
            <h2 id="help-modal-title" className="help-modal__title">
              How NetOps AI works
            </h2>
            <p className="help-modal__lede">
              A two-minute orientation to every panel, badge, and workflow you will see.
            </p>
          </div>
          <button
            type="button"
            className="help-modal__close"
            onClick={onClose}
            aria-label="Close help"
          >
            ✕
          </button>
        </header>

        <div className="help-modal__grid">
          {SECTIONS.map((section) => (
            <article className="help-modal__card" key={section.title}>
              <span className="help-modal__card-eyebrow">{section.eyebrow}</span>
              <h3 className="help-modal__card-title">{section.title}</h3>
              <p className="help-modal__card-body">{section.body}</p>
              <ul className="help-modal__list">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <footer className="help-modal__footer">
          <span className="muted-text small-text">
            Tip: press Esc to close. You can reopen this guide anytime from the top bar.
          </span>
          <button type="button" className="button button--teal" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
