# NetOps AI

A real-time **network monitoring, automation, and reliability platform** that turns raw device telemetry into health scores, alerts, incidents, and self-healing automation runs — all visible on a live React dashboard.

NetOps AI ingests metrics from network devices (routers, switches, servers, etc.) at sub-second cadence, scores their health, detects configuration drift, fires alerts on threshold breaches, opens incidents, and runs remediation workflows — without an operator having to babysit a NOC screen.

---

## Project description

NetOps AI is a full-stack modular monolith built around a **streaming telemetry pipeline**:

```
Devices / Simulator
        │
        ▼
POST /api/telemetry  ──►  Redis Stream (telemetry:events)
                                  │
                                  ▼
                      Telemetry consumer worker
                                  │
                ┌─────────────────┼─────────────────┐
                ▼                 ▼                 ▼
          Rules engine     Health scorer     Drift detector
                │                 │                 │
                └────────► PostgreSQL / TimescaleDB ◄────────┘
                                  │
                                  ▼
                       WebSocket pub/sub (Redis)
                                  │
                                  ▼
                       React + Vite dashboard
```

- **Backend** — FastAPI (async), SQLAlchemy 2.0, Postgres + TimescaleDB, Redis Streams, JWT auth with 3-role RBAC, WebSockets for live fan-out.
- **Frontend** — React 18 + Vite + TypeScript, TanStack Query, Zustand, React Router.
- **Simulator** — hybrid `psutil` + synthetic device generator that registers 20+ devices and pushes telemetry every few seconds, so the whole platform is demoable without real hardware.
- **Worker** — consumes the Redis stream, applies rules, persists samples to Timescale, fans out WebSocket events.

---

## Features

### Monitoring
- Live telemetry ingestion (CPU, memory, latency, packet loss, interface counters) from any number of devices
- TimescaleDB-backed time series with historical retention
- Per-device health score, online/offline detection via heartbeat sweeper
- Aggregated dashboard summary (counts by status, severity, type)

### Alerting & incidents
- Configurable thresholds (CPU/memory/latency/packet loss — warning + critical)
- Rules engine fires alerts on threshold breach and auto-clears on recovery
- Incident lifecycle: open → acknowledge → resolve, with full timeline
- WebSocket push so the UI updates without polling

### Configuration management
- Versioned device configurations
- Drift detection against a "desired state" baseline
- Validate / rollback / view history endpoints

### Automation
- Workflow engine with seeded default playbooks (restart interface, clear ARP, etc.)
- Manual or alert-triggered runs
- Full run history with status + output

### Reporting
- Uptime reports
- SLA compliance
- Config-compliance summaries
- PDF export endpoint (stub — full rendering deferred)

### Platform
- JWT auth, 3 roles (admin / operator / viewer), default `admin/admin` user seeded on boot
- Live WebSocket channels: `devices`, `alerts`, `incidents`, `telemetry`, `topology`
- OpenAPI docs at `/docs`
- Docker Compose stack: api + worker + simulator + Postgres/Timescale + Redis

---

## Use cases

- **NOC dashboards** — a single pane of glass for device health, alerts, and incidents across a network.
- **Self-healing networks** — wire automation workflows to specific alerts so common faults remediate themselves (interface flap → auto-restart, route flap → clear table, etc.).
- **Configuration compliance** — detect drift from a golden baseline across hundreds of devices and roll back unauthorised changes.
- **SLA reporting** — uptime + incident MTTR + compliance reports for internal or customer-facing SLAs.
- **Demo / training environment** — the included simulator means the whole platform runs end-to-end on a laptop with no real hardware, which makes it useful for onboarding, demos, or as a base for a network-ops course.
- **Foundation for AI ops** — the streaming pipeline + Timescale store is the right substrate for plugging in anomaly detection (Isolation Forest, LSTM) on top.

---

## Tech stack

| Layer       | Technology                                                      |
| ----------- | --------------------------------------------------------------- |
| Backend     | FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, Alembic           |
| Database    | PostgreSQL 16 with TimescaleDB extension                        |
| Streaming   | Redis Streams (ingestion) + Redis Pub/Sub (WebSocket fan-out)   |
| Auth        | JWT (python-jose) + bcrypt, 3-role RBAC                         |
| Frontend    | React 18, Vite 5, TypeScript, TanStack Query, Zustand           |
| Container   | Docker + Docker Compose                                         |
| Simulator   | Python + `psutil` + httpx                                       |

---

## Installation

### Prerequisites
- Docker + Docker Compose (recommended path)
- OR Python 3.11+ and Node.js 18+ (local-dev path)
- Git

### 1. Clone the repo

```bash
git clone https://github.com/gowhith/netops.git
cd netops
```

### 2. Recommended path — Docker Compose

Brings up Postgres + Redis + API + worker + simulator in one command.

```bash
cd backend
cp .env.example .env
docker compose up -d --build
```

Then in another terminal, start the frontend:

```bash
cd ../frontend
cp .env.example .env
npm install
npm run dev
```

Open **http://127.0.0.1:5173** — the dashboard auto-logs in as `admin/admin`, streams telemetry from the simulator, fires alerts, and opens incidents in real time.

| Service    | Host port | Purpose                                  |
| ---------- | --------- | ---------------------------------------- |
| postgres   | 5433      | Timescale + Postgres                     |
| redis      | 6380      | Streams + pub/sub                        |
| api        | 8020      | FastAPI (http://localhost:8020/docs)     |
| worker     | —         | Telemetry consumer + heartbeat sweeper   |
| simulator  | —         | Pushes telemetry from 20 fake devices    |
| frontend   | 5173      | React dashboard                          |

> Host ports are offset (5433 / 6380 / 8020) so this stack can run alongside other local services without colliding.

### 3. Alternative path — local Python + Node

For active backend development (faster reload than rebuilding containers).

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Only bring up infra in Docker
docker compose up -d postgres redis

# Run each in its own terminal
uvicorn app.main:app --reload --port 8020
python -m app.workers.telemetry_consumer
python -m simulator.device_simulator
```

```bash
# Frontend
cd frontend
cp .env.example .env
npm install
npm run dev
```

Keep these in `backend/.env` for the local path:

```
DATABASE_URL=postgresql+asyncpg://netops:netops@localhost:5433/netops
REDIS_URL=redis://localhost:6380/0
```

### 4. Verify it's working

```bash
# Health check
curl http://localhost:8020/health

# Login → grab token
TOKEN=$(curl -s -X POST http://localhost:8020/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# List devices (registered by simulator)
curl -s http://localhost:8020/api/devices -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Alerts produced by the rules engine
curl -s http://localhost:8020/api/alerts -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

You should see ~20 devices registered, with alerts firing as the simulator pushes high-CPU/latency samples.

---

## REST API surface

| Group       | Endpoints |
| ----------- | --------- |
| Auth        | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Devices     | `GET/POST /api/devices`, `GET/PATCH/DELETE /api/devices/{id}`, `GET /api/devices/{id}/metrics`, `GET /api/devices/summary` |
| Telemetry   | `POST /api/telemetry`, `POST /api/telemetry/batch`, `GET /api/telemetry/{id}`, `GET /api/telemetry/{id}/history` |
| Configs     | `GET/POST /api/configs/{id}`, `GET /api/configs/{id}/drift`, `POST /api/configs/{id}/validate`, `POST /api/configs/{id}/rollback`, `GET /api/configs/{id}/versions` |
| Alerts      | `GET /api/alerts`, `PATCH /api/alerts/{id}` |
| Incidents   | `GET/POST /api/incidents`, `GET /api/incidents/{id}/timeline`, `PATCH /api/incidents/{id}/resolve` |
| Automation  | `GET/POST /api/automation/workflows`, `POST /api/automation/run`, `GET /api/automation/runs` |
| Reports     | `GET /api/reports/uptime`, `/sla`, `/config-compliance`, `/export/pdf` |
| WebSockets  | `ws://localhost:8020/ws/{devices|alerts|incidents|telemetry|topology}` |

Full interactive docs at **http://localhost:8020/docs**.

---

## Repository layout

```
netops/
├── backend/
│   ├── app/
│   │   ├── core/         # settings, async DB, Redis client, JWT, deps
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # rules engine, drift detector, automation,
│   │   │                 # health scorer, heartbeat sweeper, notifications
│   │   ├── routers/      # auth / devices / telemetry / configs / alerts /
│   │   │                 # incidents / automation / reports / settings / ws
│   │   ├── ws/           # WebSocket manager (Redis pub/sub fan-out)
│   │   ├── workers/      # telemetry_consumer — Redis Streams worker
│   │   └── main.py       # FastAPI app + lifespan + heartbeat task
│   ├── simulator/        # 20-device synthetic telemetry generator
│   ├── db/init.sql       # bootstraps Timescale extension on first boot
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── app/          # routing, providers
    │   ├── components/   # shared UI
    │   ├── pages/        # dashboard, alerts, incidents, devices, etc.
    │   ├── stores/       # zustand stores
    │   ├── lib/          # API client, WS client
    │   ├── data/         # static fixtures
    │   └── types/        # shared TS types
    ├── package.json
    └── vite.config.ts
```

---

## Configuration reference

Key environment variables (`backend/.env`):

| Variable                   | Default                                 | Purpose                                 |
| -------------------------- | --------------------------------------- | --------------------------------------- |
| `DATABASE_URL`             | `postgresql+asyncpg://…@localhost:5433` | Async Postgres DSN                      |
| `REDIS_URL`                | `redis://localhost:6380/0`              | Redis connection                        |
| `JWT_SECRET`               | `change-me-in-production-please`        | **Change before deploying**             |
| `JWT_EXPIRE_MINUTES`       | `1440`                                  | Token lifetime                          |
| `RULE_CPU_WARNING/CRITICAL`| `75 / 90`                               | CPU alert thresholds (%)                |
| `RULE_MEM_WARNING/CRITICAL`| `80 / 92`                               | Memory alert thresholds (%)             |
| `RULE_LATENCY_*_MS`        | `120 / 200`                             | Latency thresholds (ms)                 |
| `RULE_PACKET_LOSS_*`       | `2.0 / 5.0`                             | Packet-loss thresholds (%)              |
| `HEARTBEAT_OFFLINE_SECONDS`| `30`                                    | How long before a silent device = down  |
| `SIM_DEVICE_COUNT`         | `20`                                    | Simulated devices                       |
| `SIM_INTERVAL_SECONDS`     | `3`                                     | Telemetry push interval                 |
| `CORS_ORIGINS`             | comma-separated list                    | Frontend origins allowed to hit the API |

---

## Roadmap (what's deferred)

These are planned but not yet implemented:

- AI anomaly detection (Isolation Forest, LSTM) on the streaming pipeline
- Full PDF generation for reports (ReportLab / WeasyPrint)
- Prometheus + Grafana + OpenTelemetry exporters
- Celery (current Redis Streams worker covers MVP needs)
- OAuth / SSO (JWT + 3-role RBAC is in place)
- Real device integrations (SNMP, NETCONF, gNMI)

---

## License

This project is currently unlicensed — treat as "all rights reserved" until a license is added.
