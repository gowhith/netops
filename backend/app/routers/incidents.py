from datetime import datetime, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.incident import Incident, IncidentEvent, IncidentStatus
from app.models.user import User
from app.schemas.incident import (
    IncidentCreate,
    IncidentEventOut,
    IncidentOut,
    IncidentResolve,
    IncidentTimeline,
)
from app.services import notification

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.get("", response_model=List[IncidentOut])
async def list_incidents(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    status: Optional[IncidentStatus] = None,
    device_id: Optional[str] = None,
    limit: int = Query(200, ge=1, le=2000),
) -> List[IncidentOut]:
    stmt = select(Incident).order_by(desc(Incident.created_at)).limit(limit)
    if status:
        stmt = stmt.where(Incident.status == status)
    if device_id:
        stmt = stmt.where(Incident.device_id == device_id)
    rows = (await db.execute(stmt)).scalars().all()
    return [IncidentOut.model_validate(r) for r in rows]


@router.post("", response_model=IncidentOut, status_code=201)
async def create_incident(
    payload: IncidentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> IncidentOut:
    incident = Incident(**payload.model_dump(), status=IncidentStatus.OPEN)
    db.add(incident)
    await db.flush()
    db.add(
        IncidentEvent(
            incident_id=incident.id,
            event_type="created",
            message="Incident created via API",
            actor=user.username,
        )
    )
    await db.commit()
    await db.refresh(incident)
    out = IncidentOut.model_validate(incident)
    await notification.notify_incident("incident.created", out.model_dump(mode="json"))
    return out


@router.get("/{incident_id}/timeline", response_model=IncidentTimeline)
async def incident_timeline(
    incident_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> IncidentTimeline:
    incident = (await db.execute(select(Incident).where(Incident.id == incident_id))).scalar_one_or_none()
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")
    events = (
        await db.execute(
            select(IncidentEvent).where(IncidentEvent.incident_id == incident_id).order_by(IncidentEvent.created_at)
        )
    ).scalars().all()
    return IncidentTimeline(
        incident=IncidentOut.model_validate(incident),
        events=[IncidentEventOut.model_validate(e) for e in events],
    )


@router.patch("/{incident_id}/resolve", response_model=IncidentOut)
async def resolve_incident(
    incident_id: int,
    payload: IncidentResolve,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> IncidentOut:
    incident = (await db.execute(select(Incident).where(Incident.id == incident_id))).scalar_one_or_none()
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")
    incident.status = payload.status
    if payload.root_cause:
        incident.root_cause = payload.root_cause
    if payload.status == IncidentStatus.RESOLVED and incident.resolved_at is None:
        incident.resolved_at = datetime.now(timezone.utc)

    db.add(
        IncidentEvent(
            incident_id=incident.id,
            event_type=payload.status.value,
            message=payload.root_cause or f"Status changed to {payload.status.value}",
            actor=user.username,
        )
    )
    await db.commit()
    await db.refresh(incident)
    out = IncidentOut.model_validate(incident)
    await notification.notify_incident("incident.updated", out.model_dump(mode="json"))
    return out
