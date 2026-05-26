# NetOps AI — Backend

Real-time network monitoring, automation, and reliability platform. Modular monolith built with FastAPI + Postgres/TimescaleDB + Redis Streams + WebSockets, matching the architecture in `../backend _ plan .pdf`.

The companion React/Vite/TypeScript dashboard lives in [../frontend/](../frontend/) and talks to this backend via `http://localhost:8020/api` and `ws://localhost:8020/ws`.

## Full-stack run (this is what you want)

```bash
# 1. Backend + Postgres + Redis + worker + simulator
cd backend
cp -n .env.example .env
docker compose up -d --build

# 2. Frontend (React + Vite)
cd ../frontend
cp -n .env.example .env       # already points at localhost:8020
npm install                    # only first time
npm run dev                    # serves http://127.0.0.1:5173
```

Open **http://127.0.0.1:5173** → the dashboard auto-logs in as `admin/admin`,
streams live telemetry from 21 simulated devices, fires alerts, opens
incidents, and exercises the automation workflows in real time.

## What's in here

```
backend/
├── app/
│   ├── core/         # settings, async DB engine, redis client, JWT, deps
│   ├── models/       # SQLAlchemy 2.0 models
│   ├── schemas/      # Pydantic v2 schemas
│   ├── services/     # rules engine, drift detector, automation engine,
│   │                 # telemetry pipeline, heartbeat sweeper, notifications
│   ├── routers/      # auth, devices, telemetry, configs, alerts,
│   │                 # incidents, automation, reports, websocket
│   ├── ws/           # WebSocket manager with Redis pub/sub fan-out
│   ├── workers/      # telemetry_consumer — Redis Streams consumer
│   └── main.py       # FastAPI app with lifespan + heartbeat task
├── simulator/        # hybrid psutil + synthetic device simulator
├── db/init.sql       # creates Timescale extension on first DB boot
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

## Quick start (Docker — recommended)

```bash
cd backend
cp .env.example .env
docker compose up --build
```

This starts five containers. **Host ports are offset** to avoid clashing with the Altrion stack (which already owns 5432, 6379, 8001/8002/8004/8005, 5500):

| Service     | Host port | Container port | Role                                    |
| ----------- | --------- | -------------- | --------------------------------------- |
| postgres    | 5433      | 5432           | Postgres + TimescaleDB extension        |
| redis       | 6380      | 6379           | Streams + cache + pub/sub               |
| api         | 8020      | 8000           | FastAPI                                 |
| worker      | —         | —              | telemetry stream consumer + heartbeat   |
| simulator   | —         | —              | pushes telemetry every `SIM_INTERVAL_SECONDS` |

(Inside the Docker network, services still talk to each other on the standard
container ports — `postgres:5432`, `redis:6379`, `api:8000`. Only the host
side is remapped.)

Open:

- API docs: http://localhost:8020/docs
- Health: http://localhost:8020/health

Default admin user (created on first boot):

```
username: admin
password: admin
```

## Quick start (local Python)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# bring up only the infra in Docker (these now expose 5433 / 6380 on the host)
docker compose up -d postgres redis

# then run each process in its own terminal
uvicorn app.main:app --reload --port 8020
python -m app.workers.telemetry_consumer
python -m simulator.device_simulator
```

Make sure `.env` keeps `DATABASE_URL=...@localhost:5433/...` and
`REDIS_URL=redis://localhost:6380/0` for the local-Python path — those are the
remapped host ports.

## Login + try an API

```bash
# 1) Login (uses default admin/admin)
TOKEN=$(curl -s -X POST http://localhost:8020/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# 2) List devices (the simulator auto-registers them on first telemetry)
curl -s http://localhost:8020/api/devices -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 3) Inspect alerts produced by the rules engine
curl -s http://localhost:8020/api/alerts -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 4) Dashboard summary
curl -s http://localhost:8020/api/devices/summary -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

## WebSocket channels

Connect to `ws://localhost:8020/ws/{channel}` where channel is one of:

- `devices` — device state changes, telemetry samples
- `alerts` — newly created / updated alerts
- `incidents` — incident lifecycle events
- `topology` — same payload as devices, kept separate for the topology view
- `telemetry` — every ingested telemetry sample

## Architecture (matches the PDF plan)

```
Simulator -> POST /api/telemetry -> Redis Stream `telemetry:events`
                                            |
                                            v
                                Telemetry consumer worker
                                            |
                            Rules engine  +  Health scorer
                                            |
                                 PostgreSQL / TimescaleDB
                                            |
                                       WS pub/sub
                                            |
                                  Frontend dashboard
```

## REST surface

| Group | Endpoints |
| ----- | --------- |
| Auth      | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Devices   | `GET/POST /api/devices`, `GET/PATCH/DELETE /api/devices/{id}`, `GET /api/devices/{id}/metrics`, `GET /api/devices/summary` |
| Telemetry | `POST /api/telemetry`, `POST /api/telemetry/batch`, `GET /api/telemetry/{id}`, `GET /api/telemetry/{id}/history` |
| Configs   | `GET/POST /api/configs/{id}`, `GET /api/configs/{id}/drift`, `POST /api/configs/{id}/validate`, `POST /api/configs/{id}/rollback`, `GET /api/configs/{id}/versions` |
| Alerts    | `GET /api/alerts`, `PATCH /api/alerts/{id}` |
| Incidents | `GET/POST /api/incidents`, `GET /api/incidents/{id}/timeline`, `PATCH /api/incidents/{id}/resolve` |
| Automation| `GET/POST /api/automation/workflows`, `POST /api/automation/run`, `GET /api/automation/runs` |
| Reports   | `GET /api/reports/uptime`, `/sla`, `/config-compliance`, `/export/pdf` |

## What's deferred (per the PDF roadmap)

- AI anomaly detection (Isolation Forest, LSTM)
- Full PDF generation (ReportLab/WeasyPrint)
- Prometheus / Grafana / OpenTelemetry
- Celery (Redis Streams worker covers MVP)
- OAuth/SSO (JWT + 3-role RBAC is in place)
