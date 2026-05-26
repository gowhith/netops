from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.device import DeviceStatus, DeviceType


class DeviceBase(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    device_type: DeviceType = DeviceType.ROUTER
    location: Optional[str] = None
    ip_address: Optional[str] = None
    firmware: Optional[str] = None
    vendor: Optional[str] = None
    group_name: Optional[str] = None


class DeviceCreate(DeviceBase):
    device_id: str = Field(min_length=1, max_length=64)


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    device_type: Optional[DeviceType] = None
    location: Optional[str] = None
    ip_address: Optional[str] = None
    firmware: Optional[str] = None
    vendor: Optional[str] = None
    group_name: Optional[str] = None


class DeviceOut(DeviceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: str
    status: DeviceStatus
    health_score: float
    last_seen: Optional[datetime]
    created_at: datetime
    updated_at: datetime
