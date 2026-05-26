from datetime import datetime, timedelta, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.telemetry import TelemetryMetric
from app.models.user import User
from app.schemas.telemetry import TelemetryIn, TelemetryOut
from app.services import telemetry_processor

router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])


@router.post("", status_code=202)
async def ingest_telemetry(payload: TelemetryIn) -> dict:
    """Ingest a single telemetry event.

    Pushed to Redis Streams so the worker processes it. Public (no auth) so
    simulators / agents can post without holding a JWT — restrict in production.
    """
    event = payload.model_dump(mode="json", exclude_none=False)
    await telemetry_processor.enqueue_telemetry(event)
    return {"status": "queued", "device_id": payload.device_id}


@router.post("/batch", status_code=202)
async def ingest_telemetry_batch(events: list[TelemetryIn]) -> dict:
    for ev in events:
        await telemetry_processor.enqueue_telemetry(ev.model_dump(mode="json"))
    return {"status": "queued", "count": len(events)}


@router.get("/{device_id}", response_model=Optional[TelemetryOut])
async def latest_telemetry(
    device_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> Optional[TelemetryOut]:
    row = (
        await db.execute(
            select(TelemetryMetric)
            .where(TelemetryMetric.device_id == device_id)
            .order_by(desc(TelemetryMetric.time))
            .limit(1)
        )
    ).scalar_one_or_none()
    return TelemetryOut.model_validate(row) if row else None


@router.get("/{device_id}/history", response_model=List[TelemetryOut])
async def telemetry_history(
    device_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    minutes: int = Query(60, ge=1, le=24 * 60),
    limit: int = Query(500, ge=1, le=5000),
) -> List[TelemetryOut]:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    rows = (
        await db.execute(
            select(TelemetryMetric)
            .where(TelemetryMetric.device_id == device_id, TelemetryMetric.time >= cutoff)
            .order_by(desc(TelemetryMetric.time))
            .limit(limit)
        )
    ).scalars().all()
    return [TelemetryOut.model_validate(r) for r in rows]
