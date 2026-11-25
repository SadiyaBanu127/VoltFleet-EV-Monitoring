import pytest
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import alerts, analytics, health, reports, settings as settings_api, telemetry, vehicles
from app.database.session import Base, get_db
from app.models import Alert, Telemetry, Vehicle  # noqa: F401
from app.services.simulator import seed_fleet
from app.websocket.manager import manager


@pytest.fixture
def test_app():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)
    with TestingSession() as db:
        seed_fleet(db)
    app = FastAPI()

    def override_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    app.include_router(vehicles.router)
    app.include_router(telemetry.router)
    app.include_router(alerts.router)
    app.include_router(analytics.router)
    app.include_router(reports.router)
    app.include_router(health.router)
    app.include_router(settings_api.router)

    @app.websocket("/ws/telemetry")
    async def websocket_endpoint(websocket: WebSocket):
        await manager.connect(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            await manager.disconnect(websocket)

    with TestClient(app) as client:
        yield client, TestingSession
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
