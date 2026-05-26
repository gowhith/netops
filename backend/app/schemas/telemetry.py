from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class TelemetryIn(BaseModel):
    """Incoming telemetry event from a simulated/real device."""

    device_id: str = Field(min_length=1, max_length=64)
    timestamp: Optional[datetime] = None
    cpu_percent: Optional[float] = Field(default=None, ge=0, le=100)
    memory_percent: Optional[float] = Field(default=None, ge=0, le=100)
    latency_ms: Optional[float] = Field(default=None, ge=0)
    packet_loss_percent: Optional[float] = Field(default=None, ge=0, le=100)
    bandwidth_mbps: Optional[float] = Field(default=None, ge=0)
    interface_status: Optional[str] = None
    health_status: Optional[str] = None


class TelemetryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    time: datetime
    device_id: str
    cpu_percent: Optional[float]
    memory_percent: Optional[float]
    latency_ms: Optional[float]
    packet_loss_percent: Optional[float]
    bandwidth_mbps: Optional[float]
    health_score: Optional[float]
    interface_status: Optional[str]
    health_status: Optional[str]
