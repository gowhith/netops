from datetime import datetime, timedelta, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.device import Device, DeviceStatus, DeviceType
from app.models.telemetry import TelemetryMetric
from app.models.user import User, UserRole
from app.schemas.device import DeviceCreate, DeviceOut, DeviceUpdate
from app.schemas.telemetry import TelemetryOut

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.get("", response_model=List[DeviceOut])
async def list_devices(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    device_type: Optional[DeviceType] = None,
    status_filter: Optional[DeviceStatus] = Query(None, alias="status"),
    location: Optional[str] = None,
    group_name: Optional[str] = None,
    limit: int = Query(200, ge=1, le=1000),
) -> List[DeviceOut]:
    stmt = select(Device).order_by(Device.device_id)
    if device_type:
        stmt = stmt.where(Device.device_type == device_type)
    if status_filter:
        stmt = stmt.where(Device.status == status_filter)
    if location:
        stmt = stmt.where(Device.location == location)
    if group_name:
        stmt = stmt.where(Device.group_name == group_name)
    stmt = stmt.limit(limit)
    devices = (await db.execute(stmt)).scalars().all()
    return [DeviceOut.model_validate(d) for d in devices]


@router.get("/summary")
async def devices_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> dict:
    rows = (
        await db.execute(select(Device.status, func.count()).group_by(Device.status))
    ).all()
    total = (await db.execute(select(func.count(Device.id)))).scalar_one()
    return {
        "total": total,
        "by_status": {status.value: count for status, count in rows},
    }


@router.get("/{device_id}", response_model=DeviceOut)
async def get_device(
    device_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> DeviceOut:
    device = await _require_device(db, device_id)
    return DeviceOut.model_validate(device)


@router.post("", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
async def create_device(
    payload: DeviceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.ADMIN, UserRole.ENGINEER))],
) -> DeviceOut:
    existing = await db.execute(select(Device).where(Device.device_id == payload.device_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="device_id already exists")
    device = Device(**payload.model_dump())
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return DeviceOut.model_validate(device)


@router.patch("/{device_id}", response_model=DeviceOut)
async def update_device(
    device_id: str,
    payload: DeviceUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.ADMIN, UserRole.ENGINEER))],
) -> DeviceOut:
    device = await _require_device(db, device_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(device, field, value)
    await db.commit()
    await db.refresh(device)
    return DeviceOut.model_validate(device)


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.ADMIN))],
) -> None:
    device = await _require_device(db, device_id)
    await db.delete(device)
    await db.commit()


@router.get("/{device_id}/metrics", response_model=List[TelemetryOut])
async def device_metrics(
    device_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    minutes: int = Query(60, ge=1, le=24 * 60),
    limit: int = Query(500, ge=1, le=5000),
) -> List[TelemetryOut]:
    await _require_device(db, device_id)
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


async def _require_device(db: AsyncSession, device_id: str) -> Device:
    result = await db.execute(select(Device).where(Device.device_id == device_id))
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=404, detail="device not found")
    return device
