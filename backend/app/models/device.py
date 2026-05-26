import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DeviceType(str, enum.Enum):
    ROUTER = "router"
    SWITCH = "switch"
    AP = "ap"
    EDGE = "edge"
    SERVER = "server"


class DeviceStatus(str, enum.Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    DEGRADED = "degraded"
    OFFLINE = "offline"
    UNKNOWN = "unknown"


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    device_type: Mapped[DeviceType] = mapped_column(
        Enum(DeviceType, name="device_type"), default=DeviceType.ROUTER, nullable=False
    )
    location: Mapped[Optional[str]] = mapped_column(String(128))
    ip_address: Mapped[Optional[str]] = mapped_column(String(64))
    firmware: Mapped[Optional[str]] = mapped_column(String(64))
    vendor: Mapped[Optional[str]] = mapped_column(String(64))
    group_name: Mapped[Optional[str]] = mapped_column(String(64), index=True)

    status: Mapped[DeviceStatus] = mapped_column(
        Enum(DeviceStatus, name="device_status"),
        default=DeviceStatus.UNKNOWN,
        nullable=False,
        index=True,
    )
    health_score: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    last_seen: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
