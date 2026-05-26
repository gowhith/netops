"""Background sweeper: mark devices OFFLINE when heartbeat is stale."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.device import Device, DeviceStatus
from app.models.incident import Incident, IncidentEvent, IncidentSeverity, IncidentStatus
from app.services import notification

logger = logging.getLogger(__name__)


async def sweep_once() -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=settings.heartbeat_offline_seconds)
    marked = 0
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Device).where(
                Device.last_seen.isnot(None),
                Device.last_seen < cutoff,
                Device.status != DeviceStatus.OFFLINE,
            )
        )
        for device in result.scalars().all():
            device.status = DeviceStatus.OFFLINE
            marked += 1

            # auto open an incident if none active
            existing = await db.execute(
                select(Incident).where(
                    Incident.device_id == device.device_id,
                    Incident.status != IncidentStatus.RESOLVED,
                )
            )
            if existing.scalars().first() is None:
                incident = Incident(
                    device_id=device.device_id,
                    title=f"Device {device.device_id} offline",
                    description=f"No heartbeat for >{settings.heartbeat_offline_seconds}s",
                    severity=IncidentSeverity.HIGH,
                    status=IncidentStatus.OPEN,
                )
                db.add(incident)
                await db.flush()
                db.add(
                    IncidentEvent(
                        incident_id=incident.id,
                        event_type="created",
                        message="Heartbeat sweeper detected offline device",
                        actor="heartbeat_sweeper",
                    )
                )
                await notification.notify_incident(
                    "incident.created",
                    {
                        "id": incident.id,
                        "device_id": device.device_id,
                        "title": incident.title,
                        "severity": incident.severity.value,
                        "status": incident.status.value,
                    },
                )

            await notification.notify_device(
                "device.offline",
                {
                    "device_id": device.device_id,
                    "name": device.name,
                    "status": device.status.value,
                    "last_seen": device.last_seen.isoformat() if device.last_seen else None,
                },
            )

        await db.commit()
    return marked


async def heartbeat_loop(interval: float = 5.0) -> None:
    logger.info("heartbeat sweeper started (interval=%ss)", interval)
    while True:
        try:
            n = await sweep_once()
            if n:
                logger.info("heartbeat sweep marked %d devices offline", n)
        except Exception:
            logger.exception("heartbeat sweep failed")
        await asyncio.sleep(interval)
