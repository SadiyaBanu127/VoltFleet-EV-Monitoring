from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models import Telemetry, Vehicle
from app.schemas.api import TelemetryCreate, TelemetryOut
from app.services.alert_engine import evaluate_telemetry
from app.services.vehicle_health import calculate_health_score
from app.websocket.manager import manager

router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])


@router.get("", response_model=list[TelemetryOut])
def list_telemetry(
    vehicle_id: int | None = Query(default=None, gt=0),
    since_hours: int = Query(default=24, ge=1, le=720),
    limit: int = Query(default=500, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    query = select(Telemetry).where(Telemetry.timestamp >= datetime.now(timezone.utc) - timedelta(hours=since_hours))
    if vehicle_id is not None:
        query = query.where(Telemetry.vehicle_id == vehicle_id)
    return list(db.scalars(query.order_by(Telemetry.timestamp.desc()).limit(limit)))


@router.get("/{vehicle_id}", response_model=list[TelemetryOut])
def vehicle_telemetry(vehicle_id: int, limit: int = Query(default=100, ge=1, le=5000), db: Session = Depends(get_db)):
    if db.get(Vehicle, vehicle_id) is None:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    return list(db.scalars(select(Telemetry).where(Telemetry.vehicle_id == vehicle_id).order_by(Telemetry.timestamp.desc()).limit(limit)))


@router.post("", response_model=TelemetryOut, status_code=201)
async def ingest_telemetry(payload: TelemetryCreate, db: Session = Depends(get_db)):
    vehicle = db.get(Vehicle, payload.vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    values = payload.model_dump(exclude={"timestamp"})
    sample = Telemetry(**values, timestamp=payload.timestamp or datetime.now(timezone.utc))
    vehicle.status = "active" if sample.speed > 0 else "idle"
    db.add(sample)
    created_alerts = evaluate_telemetry(db, vehicle, sample)
    db.commit()
    db.refresh(sample)
    await manager.broadcast({"type": "telemetry", "data": [{
        "id": sample.id, "vehicle_id": sample.vehicle_id, "latitude": sample.latitude, "longitude": sample.longitude,
        "speed": sample.speed, "battery_percentage": sample.battery_percentage, "battery_temperature": sample.battery_temperature,
        "voltage": sample.voltage, "timestamp": sample.timestamp.isoformat(), "status": vehicle.status,
        "health_score": calculate_health_score(sample),
    }]})
    if created_alerts:
        await manager.broadcast({"type": "alerts", "data": [{
            "id": alert.id,
            "vehicle_id": alert.vehicle_id,
            "vehicle_number": vehicle.vehicle_number,
            "alert_type": alert.alert_type,
            "severity": alert.severity,
            "message": alert.message,
            "status": alert.status,
            "created_at": alert.created_at.isoformat(),
        } for alert in created_alerts]})
    return sample
