from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = "NetOps AI"
    environment: str = "development"
    log_level: str = "INFO"

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    # Stored raw to avoid pydantic-settings' JSON decode of list types.
    # Read via the `cors_origins` property below.
    cors_origins_raw: str = Field(default="*", alias="CORS_ORIGINS")

    database_url: str = "postgresql+asyncpg://netops:netops@localhost:5432/netops"

    redis_url: str = "redis://localhost:6379/0"
    telemetry_stream: str = "telemetry:events"
    telemetry_consumer_group: str = "telemetry-workers"
    telemetry_consumer_name: str = "worker-1"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440

    rule_cpu_warning: float = 75
    rule_cpu_critical: float = 90
    rule_mem_warning: float = 80
    rule_mem_critical: float = 92
    rule_latency_warning_ms: float = 120
    rule_latency_critical_ms: float = 200
    rule_packet_loss_warning: float = 2.0
    rule_packet_loss_critical: float = 5.0
    heartbeat_offline_seconds: int = 30

    sim_device_count: int = 20
    sim_interval_seconds: int = 3
    sim_api_url: str = "http://localhost:8000"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.cors_origins_raw.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
