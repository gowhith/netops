from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from app.models.automation import AutomationRunStatus


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trigger: str
    actions: List[dict]
    enabled: bool = True


class WorkflowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str]
    trigger: str
    actions: List[dict]
    enabled: bool
    created_at: datetime


class RunWorkflowIn(BaseModel):
    workflow_id: Optional[int] = None
    workflow_name: Optional[str] = None
    device_id: str
    incident_id: Optional[int] = None
    context: dict = {}


class AutomationRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workflow_id: int
    device_id: Optional[str]
    incident_id: Optional[int]
    status: AutomationRunStatus
    log: List[dict]
    started_at: datetime
    finished_at: Optional[datetime]
