import asyncio
import random
import time
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.config import settings
from app.database.session import SessionLocal
from app.models import Alert, Telemetry, Vehicle
from app.services.alert_engine import evaluate_telemetry
from app.services.offline_monitor import detect_offline_vehicles
from app.services.vehicle_health import calculate_health_score
from app.websocket.manager import manager

MODELS = ("VoltRunner E2", "CityCharge S", "Urban EV Pro")
FLEET_SIZE = 50
_offline_until: dict[int, float] = {}


def seed_fleet(db) -> None:
    expected_numbers = {f"EV-{number:03d}" for number in range(1, FLEET_SIZE + 1)}
    existing = list(db.scalars(select(Vehicle).order_by(Vehicle.id)))
    existing.sort(key=lambda vehicle: (vehicle.vehicle_number not in expected_numbers, vehicle.id))

    for extra in existing[FLEET_SIZE:]:
        db.delete(extra)

    retained = existing[:FLEET_SIZE]
    existing_numbers = {vehicle.vehicle_number for vehicle in retained}
    for vehicle in retained:
        if vehicle.status not in {"active", "idle", "offline"}:
            vehicle.status = "idle"
    missing_count = FLEET_SIZE - len(retained)
    for number in range(1, FLEET_SIZE + 1):
        vehicle_number = f"EV-{number:03d}"
        if missing_count == 0:
            break
        if vehicle_number not in existing_numbers:
            db.add(Vehicle(
                vehicle_number=vehicle_number,
                model=MODELS[(number - 1) % len(MODELS)],
                status="idle",
            ))
            missing_count -= 1
    db.commit()


def create_simulated_sample(vehicle: Vehicle, previous: Telemetry | None = None) -> Telemetry:
    if previous:
        latitude = min(13.12, max(12.82, previous.latitude + random.uniform(-0.002, 0.002)))
        longitude = min(77.76, max(77.48, previous.longitude + random.uniform(-0.002, 0.002)))
        battery = max(5, previous.battery_percentage - random.uniform(0, 0.025))
    else:
        latitude = random.uniform(12.90, 13.04)
        longitude = random.uniform(77.53, 77.68)
        battery = random.uniform(18, 100)
    is_active = random.random() > 0.16
    speed = random.uniform(8, 72) if is_active else 0
    if is_active and random.random() < 0.001:
        speed = random.uniform(81, 92)
    temperature = random.uniform(22, 47)
    if random.random() < 0.0005:
        temperature = random.uniform(51, 56)
    voltage = round(300 + battery * 1.15 + random.uniform(-3, 3), 2)
    if random.random() < 0.0003:
        voltage = round(random.choice((random.uniform(220, 245), random.uniform(610, 640))), 2)
    return Telemetry(
        vehicle_id=vehicle.id,
        latitude=latitude,
        longitude=longitude,
        speed=speed,
        battery_percentage=battery,
        battery_temperature=temperature,
        voltage=voltage,
        timestamp=datetime.now(timezone.utc),
    )


async def simulation_loop() -> None:
    with SessionLocal() as db:
        seed_fleet(db)
    while True:
        with SessionLocal() as db:
            vehicles = list(db.scalars(select(Vehicle).order_by(Vehicle.id)))
            updates = []
            created_alerts: list[Alert] = []
            for vehicle in vehicles:
                now = time.time()
                if vehicle.id not in _offline_until and random.random() < 0.0008:
                    _offline_until[vehicle.id] = now + settings.offline_after_seconds + random.uniform(2, 10)
                if now < _offline_until.get(vehicle.id, 0):
                    vehicle.status = "offline"
                    continue
                _offline_until.pop(vehicle.id, None)
                previous = db.scalar(select(Telemetry).where(Telemetry.vehicle_id == vehicle.id).order_by(Telemetry.timestamp.desc()).limit(1))
                sample = create_simulated_sample(vehicle, previous)
                vehicle.status = "active" if sample.speed > 0 else "idle"
                db.add(sample)
                created_alerts.extend(evaluate_telemetry(db, vehicle, sample))
                updates.append(sample)
            db.commit()
            vehicle_numbers = {vehicle.id: vehicle.vehicle_number for vehicle in vehicles}
            payload = [
                {
                    "id": item.id,
                    "vehicle_id": item.vehicle_id,
                    "latitude": item.latitude,
                    "longitude": item.longitude,
                    "speed": item.speed,
                    "battery_percentage": item.battery_percentage,
                    "battery_temperature": item.battery_temperature,
                    "voltage": item.voltage,
                    "timestamp": item.timestamp.isoformat(),
                    "health_score": calculate_health_score(item),
                    "status": next(vehicle.status for vehicle in vehicles if vehicle.id == item.vehicle_id),
                }
                for item in updates
            ]
            alert_payload = [
                {
                    "id": alert.id,
                    "vehicle_id": alert.vehicle_id,
                    "vehicle_number": vehicle_numbers[alert.vehicle_id],
                    "alert_type": alert.alert_type,
                    "severity": alert.severity,
                    "message": alert.message,
                    "status": alert.status,
                    "created_at": alert.created_at.isoformat(),
                }
                for alert in created_alerts
            ]
        await manager.broadcast({"type": "telemetry", "data": payload})
        if alert_payload:
            await manager.broadcast({"type": "alerts", "data": alert_payload})
        await asyncio.sleep(max(3, settings.simulator_interval_seconds))


async def offline_detection_loop() -> None:
    while True:
        with SessionLocal() as db:
            newly_offline, created_alerts = detect_offline_vehicles(db)
            db.commit()
            status_payload = [{"vehicle_id": vehicle.id, "status": vehicle.status} for vehicle in newly_offline]
            alert_payload = [
                {
                    "id": alert.id,
                    "vehicle_id": alert.vehicle_id,
                    "vehicle_number": alert.vehicle.vehicle_number,
                    "alert_type": alert.alert_type,
                    "severity": alert.severity,
                    "message": alert.message,
                    "status": alert.status,
                    "created_at": alert.created_at.isoformat(),
                }
                for alert in created_alerts
            ]
        if status_payload:
            await manager.broadcast({"type": "vehicle_status", "data": status_payload})
        if alert_payload:
            await manager.broadcast({"type": "alerts", "data": alert_payload})
        await asyncio.sleep(5)
