import { useEffect, useState } from "react";

const DISMISS_KEY = "netops.welcome.dismissed.v1";

interface StepDef {
  number: string;
  title: string;
  body: string;
  accent: "amber" | "teal" | "indigo" | "rose";
}

const STEPS: StepDef[] = [
  {
    number: "01",
    title: "Devices stream telemetry",
    body: "21 simulated routers, switches, firewalls, and access points push CPU, latency, packet-loss, and heartbeat samples every few seconds.",
    accent: "amber",
  },
  {
    number: "02",
    title: "Rules engine detects pressure",
    body: "Thresholds, drift checks, and heartbeat sweeps raise alerts the moment a device starts behaving outside its safe baseline.",
    accent: "teal",
  },
  {
    number: "03",
    title: "Incidents are opened automatically",
    body: "Correlated alerts roll up into incidents with severity, timeline, and ownership so the NOC always sees one source of truth.",
    accent: "indigo",
  },
  {
    number: "04",
    title: "Automation closes the loop",
    body: "Approved workflows can roll back config drift, restart services, or escalate to a human — visible end-to-end on this dashboard.",
    accent: "rose",
  },
];

export function WelcomePanel() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  });

  useEffect(() => {
    if (dismissed && typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
  }, [dismissed]);

  if (dismissed) {
    return null;
  }

  return (
    <section className="welcome-panel stagger-in" aria-label="Getting started with NetOps AI">
      <div className="welcome-panel__intro">
        <span className="welcome-panel__eyebrow">Welcome to NetOps AI</span>
        <h2 className="welcome-panel__title">
          Your live network — detected, explained, and ready to recover.
        </h2>
        <p className="welcome-panel__lede">
          NetOps AI watches every device on your estate in real time, turns raw telemetry into
          posture, pressure, and response signals, and shows you exactly what to do next. Skim the
          four steps below to understand what every panel on this page represents.
        </p>
        <div className="welcome-panel__actions">
          <button
            type="button"
            className="button button--teal"
            onClick={() => setDismissed(true)}
          >
            Got it — start exploring
          </button>
          <a className="button button--ghost" href="#dashboard-guide">
            Learn how to read this view
          </a>
        </div>
      </div>

      <ol className="welcome-panel__steps">
        {STEPS.map((step) => (
          <li className={`welcome-step welcome-step--${step.accent}`} key={step.number}>
            <span className="welcome-step__number">{step.number}</span>
            <strong className="welcome-step__title">{step.title}</strong>
            <p className="welcome-step__body">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
