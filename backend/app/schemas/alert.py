from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.alert import AlertSeverity, AlertStatus


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: str
    rule: str
    severity: AlertSeverity
    status: AlertStatus
    message: str
    metric_value: Optional[float]
    threshold: Optional[float]
    created_at: datetime
    resolved_at: Optional[datetime]


class AlertStatusUpdate(BaseModel):
    status: AlertStatus
