"""Config CRUD + drift + rollback helpers used by routers and automation."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.config import ConfigVersion, DeviceConfig
from app.services.drift_detector import diff_configs


async def get_or_create(db: AsyncSession, device_id: str) -> DeviceConfig:
    result = await db.execute(select(DeviceConfig).where(DeviceConfig.device_id == device_id))
    cfg = result.scalar_one_or_none()
    if cfg is None:
        cfg = DeviceConfig(device_id=device_id, baseline_config={}, current_config={})
        db.add(cfg)
        await db.flush()
    return cfg


async def _next_version(db: AsyncSession, device_id: str) -> int:
    result = await db.execute(
        select(ConfigVersion.version)
        .where(ConfigVersion.device_id == device_id)
        .order_by(ConfigVersion.version.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    return (last or 0) + 1


async def set_config(
    db: AsyncSession,
    device_id: str,
    new_config: dict,
    set_as_baseline: bool,
    changed_by: str | None,
    reason: str | None,
) -> DeviceConfig:
    cfg = await get_or_create(db, device_id)
    cfg.current_config = new_config
    if set_as_baseline:
        cfg.baseline_config = new_config

    version = await _next_version(db, device_id)
    db.add(
        ConfigVersion(
            device_id=device_id,
            version=version,
            config=new_config,
            changed_by=changed_by,
            reason=reason,
        )
    )

    diffs = diff_configs(cfg.baseline_config, cfg.current_config)
    cfg.drift_detected = bool(diffs)
    cfg.last_checked_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(cfg)
    return cfg


async def check_drift(db: AsyncSession, device_id: str) -> tuple[DeviceConfig, dict]:
    cfg = await get_or_create(db, device_id)
    diffs = diff_configs(cfg.baseline_config, cfg.current_config)
    cfg.drift_detected = bool(diffs)
    cfg.last_checked_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(cfg)
    return cfg, diffs


async def rollback_to_baseline(
    db: AsyncSession,
    device_id: str,
    reason: str | None = None,
    changed_by: str | None = None,
) -> dict:
    cfg = await get_or_create(db, device_id)
    differences = diff_configs(cfg.baseline_config, cfg.current_config)
    cfg.current_config = cfg.baseline_config
    cfg.drift_detected = False
    cfg.last_checked_at = datetime.now(timezone.utc)

    version = await _next_version(db, device_id)
    db.add(
        ConfigVersion(
            device_id=device_id,
            version=version,
            config=cfg.baseline_config,
            changed_by=changed_by,
            reason=reason or "rollback to baseline",
        )
    )
    await db.commit()
    return differences


async def rollback_to_version(
    db: AsyncSession,
    device_id: str,
    target_version: int,
    reason: str | None = None,
    changed_by: str | None = None,
) -> ConfigVersion:
    result = await db.execute(
        select(ConfigVersion).where(
            ConfigVersion.device_id == device_id, ConfigVersion.version == target_version
        )
    )
    target = result.scalar_one_or_none()
    if target is None:
        raise ValueError(f"version {target_version} not found for {device_id}")

    cfg = await get_or_create(db, device_id)
    cfg.current_config = target.config
    cfg.last_checked_at = datetime.now(timezone.utc)
    cfg.drift_detected = bool(diff_configs(cfg.baseline_config, cfg.current_config))

    new_version = await _next_version(db, device_id)
    db.add(
        ConfigVersion(
            device_id=device_id,
            version=new_version,
            config=target.config,
            changed_by=changed_by,
            reason=reason or f"rollback to v{target_version}",
        )
    )
    await db.commit()
    await db.refresh(cfg)
    return target
