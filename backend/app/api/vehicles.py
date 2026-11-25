from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models import Telemetry, Vehicle
from app.schemas.api import VehicleCreate, VehicleOut, VehicleUpdate
from app.services.vehicle_health import calculate_health_score
from app.services.simulator import FLEET_SIZE

router = APIRouter(prefix="/api/vehicles", tags=["vehicles"])


def _with_latest(db: Session, vehicle: Vehicle) -> dict:
    latest = db.scalar(
        select(Telemetry).where(Telemetry.vehicle_id == vehicle.id).order_by(Telemetry.timestamp.desc()).limit(1)
    )
    return {"id": vehicle.id, "vehicle_number": vehicle.vehicle_number, "model": vehicle.model,
            "status": vehicle.status, "created_at": vehicle.created_at, "health_score": calculate_health_score(latest),
            "latest_telemetry": latest}


@router.get("", response_model=list[VehicleOut])
def list_vehicles(
    status: str | None = Query(default=None, pattern="^(active|idle|offline)$"),
    search: str | None = Query(default=None, max_length=32),
    db: Session = Depends(get_db),
):
    query = select(Vehicle).order_by(Vehicle.vehicle_number)
    if status:
        query = query.where(Vehicle.status == status)
    if search:
        query = query.where(Vehicle.vehicle_number.ilike(f"%{search}%"))
    return [_with_latest(db, vehicle) for vehicle in db.scalars(query)]


@router.post("", response_model=VehicleOut, status_code=201)
def create_vehicle(payload: VehicleCreate, db: Session = Depends(get_db)):
    vehicle_count = db.scalar(select(func.count(Vehicle.id))) or 0
    if vehicle_count >= FLEET_SIZE:
        raise HTTPException(status_code=409, detail=f"The simulated fleet is fixed at {FLEET_SIZE} vehicles.")
    if db.scalar(select(Vehicle.id).where(Vehicle.vehicle_number == payload.vehicle_number)) is not None:
        raise HTTPException(status_code=409, detail="A vehicle with this number already exists.")
    vehicle = Vehicle(**payload.model_dump())
    db.add(vehicle)
    try:
        db.commit()
        db.refresh(vehicle)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A vehicle with this number already exists.") from exc
    return _with_latest(db, vehicle)


@router.get("/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    return _with_latest(db, vehicle)


@router.put("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(vehicle_id: int, payload: VehicleUpdate, db: Session = Depends(get_db)):
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(vehicle, key, value)
    try:
        db.commit()
        db.refresh(vehicle)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A vehicle with this number already exists.") from exc
    return _with_latest(db, vehicle)


@router.delete("/{vehicle_id}", status_code=204)
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    vehicle_count = db.scalar(select(func.count(Vehicle.id))) or 0
    if vehicle_count <= FLEET_SIZE:
        raise HTTPException(status_code=409, detail=f"Vehicles cannot be removed from the fixed {FLEET_SIZE}-vehicle simulated fleet.")
    db.delete(vehicle)
    db.commit()
    return Response(status_code=204)
