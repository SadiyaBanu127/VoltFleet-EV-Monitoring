# VoltFleet — EV Fleet Monitoring Platform

VoltFleet is a portfolio-grade, simulator-powered fleet operations application. It models 50 electric vehicles and demonstrates the collection, storage, visualization, and analysis of GPS and battery telemetry. It does **not** connect to physical vehicles or Intellicar systems.

## Features

- Fleet overview with live vehicle counts, alert summaries, and battery/status charts.
- Live map with OpenStreetMap tiles, searchable vehicle positions, and selected-vehicle details.
- Fixed 50-vehicle simulated fleet, status filtering, per-vehicle readings, and a rule-based health score.
- Battery charge, temperature, voltage, and historical trends.
- Threshold-based battery, temperature, overspeed, abnormal-voltage, and offline alerts; duplicate active conditions are suppressed, and alerts can be acknowledged.
- Operational analytics, fleet CSV and PDF reports, and per-vehicle PDF export.
- Dark/light theme and runtime alert-threshold settings.
- FastAPI REST API, Swagger documentation, WebSocket streaming, SQLAlchemy ORM, Alembic migration, SQLite local mode, and PostgreSQL Docker mode.

The health score is a transparent demonstration heuristic: it starts at 100, deducts 30 below the configured battery threshold, deducts up to 25 as temperature approaches/exceeds its configured alert threshold, and deducts 20 for voltage outside the simulator range. It is not a battery state-of-health estimate or predictive AI. Configured alert thresholds are simulation defaults, not real-world safety specifications.

## Technology

| Area | Technologies |
|---|---|
| Frontend | React, Vite, React Router, Axios, Recharts, Leaflet/OpenStreetMap, jsPDF |
| Backend | Python 3.12+, FastAPI, Pydantic Settings, SQLAlchemy, Alembic, WebSockets |
| Database | SQLite locally; PostgreSQL with Docker Compose |
| Testing | pytest, FastAPI TestClient |

## Architecture

```text
Python simulator ──writes telemetry──> SQLAlchemy ──> SQLite / PostgreSQL
        │                                     │
        └──> alert rules                       ├── REST APIs ──> React pages/charts/map
                                              └── WebSocket ──> Live fleet updates
```

The API starts a four-second simulator loop by default and reconciles the database to exactly `EV-001` through `EV-050` on startup (excess non-canonical rows are removed). Vehicle creation is rejected at the 50-vehicle limit, and deletion is blocked when the fleet is at capacity. An independent offline monitor marks vehicles whose last telemetry exceeds `OFFLINE_AFTER_SECONDS`. SQLite is the simple local default; set `DATABASE_URL` to a PostgreSQL SQLAlchemy URL for production. The API also supports telemetry ingestion at `POST /api/telemetry`.

## Project structure

```text
.
├── backend/
│   ├── app/
│   │   ├── api/                 # REST route modules
│   │   ├── core/                # Environment-backed settings
│   │   ├── database/            # SQLAlchemy engine and session
│   │   ├── models/              # Vehicle, telemetry, and alert tables
│   │   ├── schemas/             # Pydantic request/response validation
│   │   ├── services/            # Simulator, rules, analytics support
│   │   ├── websocket/           # WebSocket connection manager
│   │   └── main.py              # FastAPI app and lifecycle
│   ├── migrations/              # Alembic migration environment
│   ├── simulator/               # Optional standalone simulator entry point
│   ├── tests/                   # API and WebSocket manager tests
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # Shared UI components
│   │   ├── context/             # Fleet data and theme state
│   │   ├── layouts/             # Navigation and app shell
│   │   ├── pages/               # Dashboard and operational pages
│   │   ├── services/            # Axios API client
│   │   └── styles.css
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

## Run locally (Windows PowerShell)

Prerequisites: Python 3.12 or later and Node.js 20 or later.

### Backend

```powershell
Set-Location .\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item ..\.env.example .env
uvicorn app.main:app --reload
```

If PowerShell blocks activation, run commands with the virtual environment interpreter directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

The API seeds 50 vehicles and begins generating telemetry every four seconds by default. Local SQLite data is stored in `backend\ev_fleet.db`. Use `http://localhost:8000/docs` for Swagger UI and `http://localhost:8000/api/health` to check the database connection.

Optional schema migration:

```powershell
Set-Location .\backend
alembic upgrade head
```

The API creates missing tables on startup for convenient local setup. Alembic is included for explicit schema versioning as the project evolves.

### Frontend

Open another PowerShell terminal:

```powershell
Set-Location .\frontend
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173`. The frontend defaults to the API at `http://localhost:8000`. Override it by setting `VITE_API_URL` in the frontend build environment.

### Standalone simulator

The backend runs the simulator by default. To run it as a separate process, disable the backend's built-in loop and launch the simulator module from `backend`:

```powershell
$env:SIMULATOR_ENABLED = "false"
python -m uvicorn app.main:app --reload
```

In another backend terminal, configure the same `DATABASE_URL` and run:

```powershell
python -m simulator.run
```

Do not run both simulator modes at once. The sample project uses simulated coordinates around Bengaluru; map imagery is provided by OpenStreetMap.

## API reference

Interactive docs: `GET /docs` (Swagger UI) and `/redoc`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET, POST | `/api/vehicles` | List/search/filter fleet; create is capacity-limited to 50 |
| GET, PUT, DELETE | `/api/vehicles/{vehicle_id}` | Read/update a vehicle; deletion is blocked at the fixed 50-vehicle capacity |
| GET, POST | `/api/telemetry` | Query recent telemetry or ingest a reading |
| GET | `/api/telemetry/{vehicle_id}` | Vehicle telemetry history |
| GET | `/api/alerts` | Filter alerts by status and severity |
| POST | `/api/alerts/{alert_id}/acknowledge` | Acknowledge an alert |
| GET | `/api/analytics/summary` | Fleet status, battery, speed, and alert summary |
| GET | `/api/analytics/battery?days=7` | Daily battery, temperature, and speed trends |
| GET, PUT | `/api/settings`, `/api/settings/thresholds` | Read or adjust in-memory alert thresholds |
| GET | `/api/reports/fleet.csv`, `/api/reports/fleet.pdf` | Download fleet report files |
| GET | `/api/health` | API and database health |
| WebSocket | `/ws/telemetry` | Live telemetry events |

Telemetry readings are validated by Pydantic (including geographic ranges and plausible numeric bounds). Vehicle IDs must exist before telemetry or alerts are associated with them. The simulator broadcasts events in batches; clients reconnect after a WebSocket disconnect.

## Environment configuration

Copy `.env.example` to `.env` and adjust values as needed. Do not commit `.env` or production credentials.

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./ev_fleet.db` | SQLAlchemy database connection |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated browser origins |
| `SIMULATOR_ENABLED` | `true` | Run simulator inside the API process |
| `SIMULATOR_INTERVAL_SECONDS` | `4` | Telemetry interval, bounded to at least 3 seconds |
| `LOW_BATTERY_THRESHOLD` | `20` | Low-charge alert percentage |
| `HIGH_TEMPERATURE_THRESHOLD` | `50` | High temperature alert in °C |
| `OVERSPEED_THRESHOLD` | `80` | Overspeed alert in km/h |
| `OFFLINE_AFTER_SECONDS` | `30` | Age at which missing telemetry is considered offline |

Threshold changes made from Settings are held in backend memory and reset on process restart; set environment variables for persistent deployment defaults.

## Testing

From `backend` with dependencies installed:

```powershell
python -m pytest -q
```

Tests cover vehicle CRUD and validation, telemetry ingestion, alert deduplication and acknowledgement, database operations, health, settings validation, and WebSocket manager broadcast behavior.

Frontend production build:

```powershell
Set-Location .\frontend
npm.cmd run build
```

## Docker Compose

From the project root:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

The compose stack runs PostgreSQL, the FastAPI backend, and the frontend. Visit `http://localhost:5173` and `http://localhost:8000/docs`. Set a strong `POSTGRES_PASSWORD` in `.env` before sharing or deploying; the compose fallback is for local development only. Persistent PostgreSQL data is stored in the `postgres_data` named volume.

## Deployment notes

- Deploy the API and frontend behind HTTPS and configure exact `CORS_ORIGINS`.
- Use managed PostgreSQL and set `DATABASE_URL` from the hosting provider's secret store.
- Use a strong database password and never commit real environment files.
- Set `VITE_API_URL` to the public API origin at frontend build time.
- Disable the in-process simulator in production if a separately supervised simulator worker is used.
- For multi-worker API deployment, move WebSocket fan-out to a shared broker (for example Redis); the included connection manager is process-local.
- Configure retention/partitioning for high-volume telemetry before production-scale operation.

## Screenshots

Screenshots can be added here after running the application locally.
