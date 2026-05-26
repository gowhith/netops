from datetime import datetime, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.user import User
from app.schemas.alert import AlertOut, AlertStatusUpdate
from app.services import notification

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=List[AlertOut])
async def list_alerts(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    severity: Optional[AlertSeverity] = None,
    status: Optional[AlertStatus] = None,
    device_id: Optional[str] = None,
    limit: int = Query(200, ge=1, le=2000),
) -> List[AlertOut]:
    stmt = select(Alert).order_by(desc(Alert.created_at)).limit(limit)
    if severity:
        stmt = stmt.where(Alert.severity == severity)
    if status:
        stmt = stmt.where(Alert.status == status)
    if device_id:
        stmt = stmt.where(Alert.device_id == device_id)
    rows = (await db.execute(stmt)).scalars().all()
    return [AlertOut.model_validate(r) for r in rows]


@router.patch("/{alert_id}", response_model=AlertOut)
async def update_alert_status(
    alert_id: int,
    payload: AlertStatusUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> AlertOut:
    alert = (await db.execute(select(Alert).where(Alert.id == alert_id))).scalar_one_or_none()
    if alert is None:
        raise HTTPException(status_code=404, detail="alert not found")
    alert.status = payload.status
    if payload.status == AlertStatus.RESOLVED and alert.resolved_at is None:
        alert.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(alert)
    out = AlertOut.model_validate(alert)
    await notification.notify_alert_update(out.model_dump(mode="json"))
    return out
