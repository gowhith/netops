from datetime import datetime, timedelta, timezone
from typing import Annotated

import csv
import io
import json

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.config import DeviceConfig
from app.models.device import Device, DeviceStatus
from app.models.incident import Incident, IncidentStatus
from app.models.telemetry import TelemetryMetric
from app.models.user import User

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/uptime")
async def uptime_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    hours: int = Query(24, ge=1, le=24 * 30),
) -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    devices = (await db.execute(select(Device))).scalars().all()
    items = []
    for d in devices:
        total = (
            await db.execute(
                select(func.count()).where(
                    TelemetryMetric.device_id == d.device_id, TelemetryMetric.time >= cutoff
                )
            )
        ).scalar_one()
        offline = (
            await db.execute(
                select(func.count()).where(
                    TelemetryMetric.device_id == d.device_id,
                    TelemetryMetric.time >= cutoff,
                    TelemetryMetric.health_status == DeviceStatus.OFFLINE.value,
                )
            )
        ).scalar_one()
        uptime_pct = 100.0 if total == 0 else round(100.0 * (total - offline) / total, 2)
        items.append(
            {
                "device_id": d.device_id,
                "name": d.name,
                "samples": total,
                "offline_samples": offline,
                "uptime_pct": uptime_pct,
                "current_status": d.status.value,
            }
        )
    return {"hours": hours, "devices": items}


@router.get("/sla")
async def sla_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    hours: int = Query(24, ge=1, le=24 * 30),
) -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    incidents = (
        await db.execute(select(Incident).where(Incident.created_at >= cutoff))
    ).scalars().all()
    open_count = sum(1 for i in incidents if i.status != IncidentStatus.RESOLVED)
    durations = []
    for i in incidents:
        if i.resolved_at:
            durations.append((i.resolved_at - i.created_at).total_seconds())
    mttr_seconds = sum(durations) / len(durations) if durations else 0
    return {
        "hours": hours,
        "total_incidents": len(incidents),
        "open_incidents": open_count,
        "resolved_incidents": len(incidents) - open_count,
        "mttr_seconds": round(mttr_seconds, 1),
    }


@router.get("/config-compliance")
async def config_compliance_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> dict:
    configs = (await db.execute(select(DeviceConfig))).scalars().all()
    total = len(configs)
    drifted = sum(1 for c in configs if c.drift_detected)
    return {
        "total_devices_with_config": total,
        "drift_detected": drifted,
        "compliant": total - drifted,
        "compliance_pct": round(100.0 * (total - drifted) / total, 2) if total else 100.0,
        "drifted_devices": [c.device_id for c in configs if c.drift_detected],
    }


@router.get("/export/pdf")
async def export_pdf_stub(
    _: Annotated[User, Depends(get_current_user)],
) -> Response:
    """Stub — full PDF rendering deferred (ReportLab/WeasyPrint integration)."""
    body = b"%PDF-1.4\n% NetOps AI report stub. Replace with ReportLab output.\n"
    return Response(
        content=body,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="netops-report.pdf"'},
    )


@router.get("/export/csv")
async def export_csv_stub(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> Response:
    devices = (await db.execute(select(Device).order_by(Device.device_id.asc()))).scalars().all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["device_id", "name", "status", "health_score", "location"])
    for device in devices:
        writer.writerow(
            [
                device.device_id,
                device.name,
                device.status.value,
                round(device.health_score, 2),
                device.location or "",
            ]
        )
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="netops-report.csv"'},
    )


@router.get("/export/json")
async def export_json_stub(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> Response:
    devices = (await db.execute(select(Device).order_by(Device.device_id.asc()))).scalars().all()
    payload = {
        "devices": [
            {
                "device_id": device.device_id,
                "name": device.name,
                "status": device.status.value,
                "health_score": round(device.health_score, 2),
                "location": device.location,
            }
            for device in devices
        ]
    }
    return Response(
        content=json.dumps(payload),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="netops-report.json"'},
    )
