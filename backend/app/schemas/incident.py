from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from app.models.incident import IncidentSeverity, IncidentStatus


class IncidentCreate(BaseModel):
    device_id: str
    title: str
    description: Optional[str] = None
    severity: IncidentSeverity = IncidentSeverity.MEDIUM


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: str
    title: str
    description: Optional[str]
    severity: IncidentSeverity
    status: IncidentStatus
    root_cause: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]


class IncidentEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: int
    event_type: str
    message: str
    actor: Optional[str]
    created_at: datetime


class IncidentTimeline(BaseModel):
    incident: IncidentOut
    events: List[IncidentEventOut]


class IncidentResolve(BaseModel):
    root_cause: Optional[str] = None
    status: IncidentStatus = IncidentStatus.RESOLVED
