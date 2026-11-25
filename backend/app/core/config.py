from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "EV Fleet Monitoring"
    database_url: str = "sqlite:///./ev_fleet.db"
    cors_origins: str = "http://localhost:5173"
    simulator_enabled: bool = True
    simulator_interval_seconds: int = 4
    low_battery_threshold: float = 20
    high_temperature_threshold: float = 50
    overspeed_threshold: float = 80
    offline_after_seconds: int = 30

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
