from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VehicleCreate(BaseModel):
    vehicle_number: str = Field(min_length=2, max_length=32, pattern=r"^[A-Za-z0-9-]+$")
    model: str = Field(default="VoltRunner E2", min_length=2, max_length=80)
    status: str = Field(default="idle", pattern="^(active|idle|offline)$")


class VehicleUpdate(BaseModel):
    vehicle_number: str | None = Field(default=None, min_length=2, max_length=32, pattern=r"^[A-Za-z0-9-]+$")
    model: str | None = Field(default=None, min_length=2, max_length=80)
    status: str | None = Field(default=None, pattern="^(active|idle|offline)$")


class VehicleOut(BaseModel):
    id: int
    vehicle_number: str
    model: str
    status: str
    created_at: datetime
    health_score: int | None = None
    latest_telemetry: "TelemetryOut | None" = None

    model_config = ConfigDict(from_attributes=True)


class TelemetryCreate(BaseModel):
    vehicle_id: int = Field(gt=0)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    speed: float = Field(ge=0, le=250)
    battery_percentage: float = Field(ge=0, le=100)
    battery_temperature: float = Field(ge=-40, le=120)
    voltage: float = Field(ge=0, le=1000)
    timestamp: datetime | None = None


class TelemetryOut(BaseModel):
    id: int
    vehicle_id: int
    latitude: float
    longitude: float
    speed: float
    battery_percentage: float
    battery_temperature: float
    voltage: float
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertOut(BaseModel):
    id: int
    vehicle_id: int
    alert_type: str
    severity: str
    message: str
    status: str
    created_at: datetime
    vehicle_number: str | None = None


VehicleOut.model_rebuild()
