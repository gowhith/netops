from datetime import datetime

from pydantic import BaseModel


class SettingsUserOut(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


class AlertThresholdsOut(BaseModel):
    cpu_warning: float
    cpu_critical: float
    latency_warning_ms: float
    latency_critical_ms: float
    packet_loss_warning: float
    packet_loss_critical: float


class NotificationChannelOut(BaseModel):
    id: str
    type: str
    target: str
    enabled: bool


class SettingsOut(BaseModel):
    users: list[SettingsUserOut]
    alert_thresholds: AlertThresholdsOut
    notification_channels: list[NotificationChannelOut]
    device_groups: list[str]
