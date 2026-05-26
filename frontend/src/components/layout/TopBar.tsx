import { useState } from "react";
import { HelpModal } from "../HelpModal";
import { useAlertStore } from "../../stores/alertStore";
import { useDeviceStore } from "../../stores/deviceStore";
import { useSessionStore } from "../../stores/sessionStore";
import { minutesAgo } from "../../lib/utils";

export function TopBar() {
  const unreadCount = useAlertStore((state) => state.unreadCount);
  const markAllRead = useAlertStore((state) => state.markAllRead);
  const devices = useDeviceStore((state) => state.devices);
  const searchQuery = useSessionStore((state) => state.searchQuery);
  const setSearchQuery = useSessionStore((state) => state.setSearchQuery);
  const connectionMode = useSessionStore((state) => state.connectionMode);
  const lastEventAt = useSessionStore((state) => state.lastEventAt);
  const [helpOpen, setHelpOpen] = useState(false);

  const onlineCount = devices.filter((device) => device.status !== "offline").length;

  return (
    <header className="topbar">
      <input
        aria-label="Global search"
        className="search-field"
        placeholder="Search device, site, incident, or workflow"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
      />

      <div className="topbar__utilities">
        <div className="topbar__status">
          <span className="pulse-dot" />
          <span>
            {connectionMode === "connected"
              ? `${onlineCount}/${devices.length} devices streaming`
              : `Connection: ${connectionMode}`}
          </span>
        </div>
        <button
          className="topbar__button topbar__button--ghost"
          onClick={() => setHelpOpen(true)}
          type="button"
          title="How NetOps AI works"
        >
          <span aria-hidden="true">?</span> Guide
        </button>
        <button className="topbar__button" onClick={markAllRead} type="button">
          Alerts {unreadCount > 0 ? `(${unreadCount})` : ""}
        </button>
      </div>

      <div className="topbar__profile">
        <div>
          <strong>NOC Admin</strong>
          <div className="small-text muted-text">
            {lastEventAt ? `Last event ${minutesAgo(lastEventAt)}` : "Waiting for live telemetry"}
          </div>
        </div>
        <div className="topbar__avatar">GK</div>
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </header>
  );
}
