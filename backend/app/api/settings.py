from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.config import settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


class ThresholdUpdate(BaseModel):
    low_battery_threshold: float = Field(ge=1, le=50)
    high_temperature_threshold: float = Field(ge=30, le=90)
    overspeed_threshold: float = Field(ge=30, le=160)


@router.get("")
def get_settings():
    return {
        "simulator_enabled": settings.simulator_enabled,
        "simulator_interval_seconds": settings.simulator_interval_seconds,
        "offline_after_seconds": settings.offline_after_seconds,
        "thresholds": {
            "low_battery_threshold": settings.low_battery_threshold,
            "high_temperature_threshold": settings.high_temperature_threshold,
            "overspeed_threshold": settings.overspeed_threshold,
        },
    }


@router.put("/thresholds")
def update_thresholds(payload: ThresholdUpdate):
    settings.low_battery_threshold = payload.low_battery_threshold
    settings.high_temperature_threshold = payload.high_temperature_threshold
    settings.overspeed_threshold = payload.overspeed_threshold
    return get_settings()
