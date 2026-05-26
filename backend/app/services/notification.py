"""Thin wrapper over ws.manager.publish_event. Extension point for email/webhook."""

from __future__ import annotations

import logging

from app.ws.manager import publish_event

logger = logging.getLogger(__name__)


async def notify_device(event_type: str, device: dict) -> None:
    await publish_event("devices", event_type, device)
    await publish_event("topology", event_type, device)


async def notify_alert(alert: dict) -> None:
    await publish_event("alerts", "alert.created", alert)


async def notify_alert_update(alert: dict) -> None:
    await publish_event("alerts", "alert.updated", alert)


async def notify_incident(event_type: str, incident: dict) -> None:
    await publish_event("incidents", event_type, incident)


async def notify_telemetry(telemetry: dict) -> None:
    await publish_event("telemetry", "telemetry.ingested", telemetry)
