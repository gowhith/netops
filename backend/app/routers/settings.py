from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.device import Device
from app.models.user import User
from app.schemas.settings import (
    AlertThresholdsOut,
    NotificationChannelOut,
    SettingsOut,
    SettingsUserOut,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
async def get_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> SettingsOut:
    users = (
        await db.execute(select(User).order_by(User.created_at.asc()))
    ).scalars().all()
    groups = (
        await db.execute(
            select(Device.group_name)
            .where(Device.group_name.is_not(None))
            .distinct()
            .order_by(Device.group_name.asc())
        )
    ).scalars().all()

    return SettingsOut(
        users=[
            SettingsUserOut(
                id=user.id,
                username=user.username,
                email=user.email,
                role=user.role.value,
                is_active=user.is_active,
                created_at=user.created_at,
            )
            for user in users
        ],
        alert_thresholds=AlertThresholdsOut(
            cpu_warning=settings.rule_cpu_warning,
            cpu_critical=settings.rule_cpu_critical,
            latency_warning_ms=settings.rule_latency_warning_ms,
            latency_critical_ms=settings.rule_latency_critical_ms,
            packet_loss_warning=settings.rule_packet_loss_warning,
            packet_loss_critical=settings.rule_packet_loss_critical,
        ),
        notification_channels=[
            NotificationChannelOut(
                id="email-primary",
                type="email",
                target="noc-alerts@netops.local",
                enabled=True,
            ),
            NotificationChannelOut(
                id="webhook-primary",
                type="webhook",
                target="https://hooks.netops.local/incidents",
                enabled=True,
            ),
            NotificationChannelOut(
                id="slack-primary",
                type="slack",
                target="#netops-ai",
                enabled=False,
            ),
        ],
        device_groups=[group for group in groups if group],
    )
