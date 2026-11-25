from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Alert, Telemetry, Vehicle


def evaluate_telemetry(db: Session, vehicle: Vehicle, sample: Telemetry) -> list[Alert]:
    conditions = []
    if sample.battery_percentage < settings.low_battery_threshold:
        conditions.append(("low_battery", "high", f"Battery is critically low ({sample.battery_percentage:.0f}%)."))
    if sample.battery_temperature > settings.high_temperature_threshold:
        conditions.append(("high_temperature", "high", f"Battery temperature is elevated ({sample.battery_temperature:.1f}°C)."))
    if sample.speed > settings.overspeed_threshold:
        conditions.append(("overspeed", "medium", f"Speed exceeds the configured threshold ({sample.speed:.0f} km/h)."))
    if not (250 <= sample.voltage <= 600):
        conditions.append(("abnormal_telemetry", "medium", f"Voltage is outside the expected simulator range ({sample.voltage:.1f} V)."))

    created = []
    for alert_type, severity, message in conditions:
        existing = db.scalar(
            select(Alert).where(
                Alert.vehicle_id == vehicle.id,
                Alert.alert_type == alert_type,
                Alert.status == "active",
            )
        )
        if existing is None:
            alert = Alert(vehicle_id=vehicle.id, alert_type=alert_type, severity=severity, message=message)
            db.add(alert)
            created.append(alert)
    return created
