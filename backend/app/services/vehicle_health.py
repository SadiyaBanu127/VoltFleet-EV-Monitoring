from app.models import Telemetry
from app.core.config import settings


def calculate_health_score(sample: Telemetry | None) -> int | None:
    if sample is None:
        return None
    score = 100.0
    if sample.battery_percentage < settings.low_battery_threshold:
        score -= 30
    temperature_warning_point = settings.high_temperature_threshold - 15
    if sample.battery_temperature > temperature_warning_point:
        score -= min(25, (sample.battery_temperature - temperature_warning_point) * (25 / 15))
    if not 250 <= sample.voltage <= 600:
        score -= 20
    return max(0, round(score))
