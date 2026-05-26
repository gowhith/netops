from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TelemetryMetric(Base):
    """Time-series row. Promoted to a Timescale hypertable when extension exists.

    Composite PK (time, device_id) lets Timescale partition by `time` while
    keeping per-device queries fast. We deliberately omit a serial `id` because
    every unique index on a hypertable must include the partitioning column.
    """

    __tablename__ = "telemetry_metrics"

    time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, server_default=func.now()
    )
    device_id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)

    cpu_percent: Mapped[Optional[float]] = mapped_column(Float)
    memory_percent: Mapped[Optional[float]] = mapped_column(Float)
    latency_ms: Mapped[Optional[float]] = mapped_column(Float)
    packet_loss_percent: Mapped[Optional[float]] = mapped_column(Float)
    bandwidth_mbps: Mapped[Optional[float]] = mapped_column(Float)
    health_score: Mapped[Optional[float]] = mapped_column(Float)
    interface_status: Mapped[Optional[str]] = mapped_column(String(16))
    health_status: Mapped[Optional[str]] = mapped_column(String(16), index=True)
