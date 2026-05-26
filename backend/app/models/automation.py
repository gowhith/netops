import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AutomationRunStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


class AutomationWorkflow(Base):
    __tablename__ = "automation_workflows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    trigger: Mapped[str] = mapped_column(String(64), nullable=False)
    actions: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AutomationRun(Base):
    __tablename__ = "automation_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workflow_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("automation_workflows.id"), index=True, nullable=False
    )
    device_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("devices.device_id"), index=True
    )
    incident_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("incidents.id"))
    status: Mapped[AutomationRunStatus] = mapped_column(
        Enum(AutomationRunStatus, name="automation_run_status"),
        default=AutomationRunStatus.PENDING,
        nullable=False,
    )
    log: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
