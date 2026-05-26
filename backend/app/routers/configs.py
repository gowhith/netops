from datetime import datetime, timezone
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.config import ConfigVersion
from app.models.user import User, UserRole
from app.schemas.config import ConfigOut, ConfigSet, ConfigVersionOut, DriftReport
from app.services import config_service

router = APIRouter(prefix="/api/configs", tags=["configs"])


@router.get("/{device_id}", response_model=ConfigOut)
async def get_config(
    device_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> ConfigOut:
    cfg = await config_service.get_or_create(db, device_id)
    await db.commit()
    return ConfigOut.model_validate(cfg)


@router.post("/{device_id}", response_model=ConfigOut)
async def set_config(
    device_id: str,
    payload: ConfigSet,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role(UserRole.ADMIN, UserRole.ENGINEER))],
) -> ConfigOut:
    cfg = await config_service.set_config(
        db,
        device_id=device_id,
        new_config=payload.config,
        set_as_baseline=payload.set_as_baseline,
        changed_by=user.username,
        reason=payload.reason,
    )
    return ConfigOut.model_validate(cfg)


@router.get("/{device_id}/drift", response_model=DriftReport)
async def get_drift(
    device_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> DriftReport:
    cfg, diffs = await config_service.check_drift(db, device_id)
    return DriftReport(
        device_id=device_id,
        drift_detected=bool(diffs),
        differences=diffs,
        checked_at=cfg.last_checked_at or datetime.now(timezone.utc),
    )


@router.post("/{device_id}/validate")
async def validate_config(
    device_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> dict:
    cfg, diffs = await config_service.check_drift(db, device_id)
    return {
        "device_id": device_id,
        "compliant": not diffs,
        "drift_detected": bool(diffs),
        "differences": diffs,
        "checked_at": (cfg.last_checked_at or datetime.now(timezone.utc)).isoformat(),
    }


@router.post("/{device_id}/rollback", response_model=ConfigOut)
async def rollback_config(
    device_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role(UserRole.ADMIN, UserRole.ENGINEER))],
    version: int | None = None,
    reason: str | None = None,
) -> ConfigOut:
    if version is not None:
        try:
            await config_service.rollback_to_version(
                db, device_id, target_version=version, reason=reason, changed_by=user.username
            )
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
    else:
        await config_service.rollback_to_baseline(
            db, device_id, reason=reason, changed_by=user.username
        )
    cfg = await config_service.get_or_create(db, device_id)
    return ConfigOut.model_validate(cfg)


@router.get("/{device_id}/versions", response_model=List[ConfigVersionOut])
async def list_versions(
    device_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> List[ConfigVersionOut]:
    rows = (
        await db.execute(
            select(ConfigVersion)
            .where(ConfigVersion.device_id == device_id)
            .order_by(ConfigVersion.version.desc())
        )
    ).scalars().all()
    return [ConfigVersionOut.model_validate(r) for r in rows]
