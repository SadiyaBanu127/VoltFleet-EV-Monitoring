from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Alert, Telemetry, Vehicle


def detect_offline_vehicles(db: Session, now: datetime | None = None) -> tuple[list[Vehicle], list[Alert]]:
    current_time = now or datetime.now(timezone.utc)
    newly_offline = []
    created_alerts = []
    for vehicle in db.scalars(select(Vehicle)):
        latest = db.scalar(
            select(Telemetry).where(Telemetry.vehicle_id == vehicle.id).order_by(Telemetry.timestamp.desc()).limit(1)
        )
        if latest is None:
            continue
        timestamp = latest.timestamp
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        if (current_time - timestamp).total_seconds() <= settings.offline_after_seconds:
            continue
        if vehicle.status != "offline":
            newly_offline.append(vehicle)
        vehicle.status = "offline"
        active_alert = db.scalar(
            select(Alert).where(
                Alert.vehicle_id == vehicle.id,
                Alert.alert_type == "offline",
                Alert.status == "active",
            )
        )
        if active_alert is None:
            alert = Alert(
                vehicle_id=vehicle.id,
                alert_type="offline",
                severity="high",
                message=f"No telemetry received for more than {settings.offline_after_seconds} seconds.",
            )
            db.add(alert)
            created_alerts.append(alert)
    return newly_offline, created_alerts
