from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models import Alert, Vehicle
from app.schemas.api import AlertOut
from app.websocket.manager import manager

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(
    status: str | None = Query(default=None, pattern="^(active|acknowledged)$"),
    severity: str | None = Query(default=None, pattern="^(low|medium|high|critical)$"),
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    query = select(Alert, Vehicle.vehicle_number).join(Vehicle).order_by(Alert.created_at.desc()).limit(limit)
    if status:
        query = query.where(Alert.status == status)
    if severity:
        query = query.where(Alert.severity == severity)
    return [
        {"id": alert.id, "vehicle_id": alert.vehicle_id, "vehicle_number": number, "alert_type": alert.alert_type,
         "severity": alert.severity, "message": alert.message, "status": alert.status, "created_at": alert.created_at}
        for alert, number in db.execute(query)
    ]


@router.post("/{alert_id}/acknowledge", response_model=AlertOut)
async def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found.")
    changed = alert.status == "active"
    if changed:
        alert.status = "acknowledged"
        db.commit()
        db.refresh(alert)
    response = {
        "id": alert.id, "vehicle_id": alert.vehicle_id, "vehicle_number": alert.vehicle.vehicle_number,
        "alert_type": alert.alert_type, "severity": alert.severity, "message": alert.message,
        "status": alert.status, "created_at": alert.created_at,
    }
    if changed:
        await manager.broadcast({"type": "alerts", "data": [response]})
    return response
