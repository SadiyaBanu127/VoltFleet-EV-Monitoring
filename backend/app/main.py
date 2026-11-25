import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api import alerts, analytics, health, reports, settings as settings_api, telemetry, vehicles
from app.core.config import settings
from app.database.session import Base, SessionLocal, engine
from app.models import Alert, Telemetry, Vehicle  # noqa: F401
from app.services.simulator import offline_detection_loop, seed_fleet, simulation_loop
from app.websocket.manager import manager


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_fleet(db)
    tasks = [asyncio.create_task(offline_detection_loop())]
    if settings.simulator_enabled:
        tasks.append(asyncio.create_task(simulation_loop()))
    yield
    for task in tasks:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title=settings.app_name, version="1.0.0", description="A simulator-powered EV fleet telematics dashboard.", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(vehicles.router)
app.include_router(telemetry.router)
app.include_router(alerts.router)
app.include_router(analytics.router)
app.include_router(reports.router)
app.include_router(health.router)
app.include_router(settings_api.router)


@app.websocket("/ws/telemetry")
async def telemetry_socket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
