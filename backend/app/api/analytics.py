from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.models import Alert, Telemetry, Vehicle

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    vehicles = list(db.scalars(select(Vehicle)))
    latest_rows = (
        select(
            Telemetry.id.label("telemetry_id"),
            func.row_number().over(
                partition_by=Telemetry.vehicle_id,
                order_by=(Telemetry.timestamp.desc(), Telemetry.id.desc()),
            ).label("position"),
        )
        .subquery()
    )
    latest = list(db.scalars(
        select(Telemetry)
        .join(latest_rows, Telemetry.id == latest_rows.c.telemetry_id)
        .where(latest_rows.c.position == 1)
    ))
    active_alerts = db.scalar(select(func.count(Alert.id)).where(Alert.status == "active")) or 0
    batteries = [sample.battery_percentage for sample in latest]
    speeds = [sample.speed for sample in latest]
    return {
        "total_vehicles": len(vehicles),
        "active_vehicles": sum(vehicle.status == "active" for vehicle in vehicles),
        "idle_vehicles": sum(vehicle.status == "idle" for vehicle in vehicles),
        "offline_vehicles": sum(vehicle.status == "offline" for vehicle in vehicles),
        "low_battery_vehicles": sum(value < settings.low_battery_threshold for value in batteries),
        "active_alerts": active_alerts,
        "average_battery": round(sum(batteries) / len(batteries), 1) if batteries else 0,
        "average_speed": round(sum(speeds) / len(speeds), 1) if speeds else 0,
        "status_distribution": [
            {"name": status.title(), "value": sum(vehicle.status == status for vehicle in vehicles)}
            for status in ("active", "idle", "offline")
        ],
    }


@router.get("/battery")
def battery_analytics(
    days: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    day = func.date(Telemetry.timestamp)
    rows = db.execute(
        select(day, func.avg(Telemetry.battery_percentage), func.min(Telemetry.battery_percentage),
               func.avg(Telemetry.battery_temperature), func.avg(Telemetry.speed))
        .where(Telemetry.timestamp >= since).group_by(day).order_by(day)
    )
    return [
        {"date": str(date), "average_battery": round(avg_battery or 0, 1),
         "minimum_battery": round(min_battery or 0, 1), "average_temperature": round(avg_temp or 0, 1),
         "average_speed": round(avg_speed or 0, 1)}
        for date, avg_battery, min_battery, avg_temp, avg_speed in rows
    ]
