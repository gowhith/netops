from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ConfigSet(BaseModel):
    config: dict
    set_as_baseline: bool = False
    reason: Optional[str] = None


class ConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    device_id: str
    baseline_config: dict
    current_config: dict
    drift_detected: bool
    last_checked_at: Optional[datetime]
    updated_at: datetime


class ConfigVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: str
    version: int
    config: dict
    changed_by: Optional[str]
    reason: Optional[str]
    created_at: datetime


class DriftReport(BaseModel):
    device_id: str
    drift_detected: bool
    differences: dict
    baseline_version: Optional[int] = None
    checked_at: datetime
