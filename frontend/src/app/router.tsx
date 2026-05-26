import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { AlertsPage } from "../pages/AlertsPage";
import { AutomationPage } from "../pages/AutomationPage";
import { ConfigsPage } from "../pages/ConfigsPage";
import { DashboardPage } from "../pages/DashboardPage";
import { DeviceDetailPage } from "../pages/DeviceDetailPage";
import { DevicesPage } from "../pages/DevicesPage";
import { IncidentsPage } from "../pages/IncidentsPage";
import { ReportsPage } from "../pages/ReportsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { TopologyPage } from "../pages/TopologyPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "topology",
        element: <TopologyPage />,
      },
      {
        path: "devices",
        element: <DevicesPage />,
      },
      {
        path: "devices/:deviceId",
        element: <DeviceDetailPage />,
      },
      {
        path: "alerts",
        element: <AlertsPage />,
      },
      {
        path: "incidents",
        element: <IncidentsPage />,
      },
      {
        path: "configs",
        element: <ConfigsPage />,
      },
      {
        path: "automation",
        element: <AutomationPage />,
      },
      {
        path: "reports",
        element: <ReportsPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
]);
