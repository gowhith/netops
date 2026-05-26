"""Shared telemetry pipeline:

    raw event -> health/status -> persist metric -> update device ->
    evaluate rules -> persist alerts -> auto-create incident on critical ->
    push WebSocket notifications.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis_client import get_redis
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.device import Device, DeviceStatus, DeviceType
from app.models.incident import Incident, IncidentEvent, IncidentSeverity, IncidentStatus
from app.models.telemetry import TelemetryMetric
from app.services import notification, rules_engine
from app.services.device_health import classify_status, compute_health_score

logger = logging.getLogger(__name__)


async def enqueue_telemetry(event: dict) -> None:
    """Push a telemetry event into the Redis stream for the worker to consume."""
    r = get_redis()
    payload = {"payload": json.dumps(event, default=str)}
    await r.xadd(settings.telemetry_stream, payload, maxlen=100_000, approximate=True)


async def process_event(db: AsyncSession, event: dict) -> dict:
    """Process a single telemetry event end-to-end. Returns a summary dict."""
    device_id = event.get("device_id")
    if not device_id:
        raise ValueError("telemetry event missing device_id")

    ts = _parse_ts(event.get("timestamp"))
    cpu = _f(event.get("cpu_percent"))
    mem = _f(event.get("memory_percent"))
    lat = _f(event.get("latency_ms"))
    loss = _f(event.get("packet_loss_percent"))
    bw = _f(event.get("bandwidth_mbps"))

    health = compute_health_score(cpu, mem, lat, loss)
    status = classify_status(cpu, mem, lat, loss)

    # 1. Auto-register unknown devices so simulator / external agents work.
    device = await _get_or_create_device(db, device_id, event)

    device.health_score = health
    device.status = status
    device.last_seen = ts

    # 2. Persist time-series row.
    db.add(
        TelemetryMetric(
            time=ts,
            device_id=device_id,
            cpu_percent=cpu,
            memory_percent=mem,
            latency_ms=lat,
            packet_loss_percent=loss,
            bandwidth_mbps=bw,
            health_score=health,
            interface_status=event.get("interface_status"),
            health_status=status.value,
        )
    )

    # 3. Cache live state in Redis for the dashboard hot-path.
    try:
        await get_redis().hset(
            f"device:live:{device_id}",
            mapping={
                "status": status.value,
                "health_score": str(health),
                "cpu": str(cpu) if cpu is not None else "",
                "memory": str(mem) if mem is not None else "",
                "latency": str(lat) if lat is not None else "",
                "packet_loss": str(loss) if loss is not None else "",
                "last_seen": ts.isoformat(),
            },
        )
        await get_redis().expire(f"device:live:{device_id}", 300)
    except Exception:
        logger.exception("Redis live cache write failed")

    # 4. Threshold rules.
    candidates = rules_engine.evaluate(event)
    created_alerts: list[dict] = []
    for c in candidates:
        alert = Alert(
            device_id=device_id,
            rule=c.rule,
            severity=c.severity,
            status=AlertStatus.ACTIVE,
            message=c.message,
            metric_value=c.metric_value,
            threshold=c.threshold,
        )
        db.add(alert)
        await db.flush()
        created_alerts.append(_alert_to_dict(alert))

    # 5. Auto-create an incident if any critical alert fired.
    incident_payload: dict | None = None
    if any(c.severity == AlertSeverity.CRITICAL for c in candidates):
        existing = await db.execute(
            select(Incident).where(
                Incident.device_id == device_id, Incident.status != IncidentStatus.RESOLVED
            )
        )
        incident = existing.scalars().first()
        if incident is None:
            incident = Incident(
                device_id=device_id,
                title=f"Auto: critical condition on {device_id}",
                description="; ".join(c.message for c in candidates if c.severity == AlertSeverity.CRITICAL),
                severity=IncidentSeverity.HIGH,
                status=IncidentStatus.OPEN,
            )
            db.add(incident)
            await db.flush()
            db.add(
                IncidentEvent(
                    incident_id=incident.id,
                    event_type="created",
                    message="Auto-created from critical telemetry",
                    actor="rules_engine",
                )
            )
        incident_payload = _incident_to_dict(incident)

    await db.commit()

    # 6. WebSocket notifications.
    await notification.notify_device("device.telemetry", _device_to_dict(device))
    for a in created_alerts:
        await notification.notify_alert(a)
    if incident_payload:
        await notification.notify_incident("incident.created", incident_payload)
    await notification.notify_telemetry(
        {
            "device_id": device_id,
            "timestamp": ts.isoformat(),
            "cpu_percent": cpu,
            "memory_percent": mem,
            "latency_ms": lat,
            "packet_loss_percent": loss,
            "bandwidth_mbps": bw,
            "health_score": health,
            "status": status.value,
        }
    )

    return {
        "device_id": device_id,
        "status": status.value,
        "health_score": health,
        "alerts_created": len(created_alerts),
        "incident_id": incident_payload["id"] if incident_payload else None,
    }


async def _get_or_create_device(db: AsyncSession, device_id: str, event: dict) -> Device:
    result = await db.execute(select(Device).where(Device.device_id == device_id))
    device = result.scalar_one_or_none()
    if device is not None:
        return device

    device_type_raw = (event.get("device_type") or "router").lower()
    try:
        dtype = DeviceType(device_type_raw)
    except ValueError:
        dtype = DeviceType.ROUTER

    device = Device(
        device_id=device_id,
        name=event.get("name") or device_id,
        device_type=dtype,
        location=event.get("location"),
        ip_address=event.get("ip_address"),
        firmware=event.get("firmware"),
        vendor=event.get("vendor"),
        group_name=event.get("group_name"),
        status=DeviceStatus.UNKNOWN,
        health_score=100.0,
    )
    db.add(device)
    await db.flush()
    return device


def _f(v: Any) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _parse_ts(v: Any) -> datetime:
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if isinstance(v, str):
        try:
            return datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def _device_to_dict(d: Device) -> dict:
    return {
        "device_id": d.device_id,
        "name": d.name,
        "device_type": d.device_type.value,
        "status": d.status.value,
        "health_score": d.health_score,
        "last_seen": d.last_seen.isoformat() if d.last_seen else None,
        "location": d.location,
    }


def _alert_to_dict(a: Alert) -> dict:
    return {
        "id": a.id,
        "device_id": a.device_id,
        "rule": a.rule,
        "severity": a.severity.value,
        "status": a.status.value,
        "message": a.message,
        "metric_value": a.metric_value,
        "threshold": a.threshold,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def _incident_to_dict(i: Incident) -> dict:
    return {
        "id": i.id,
        "device_id": i.device_id,
        "title": i.title,
        "severity": i.severity.value,
        "status": i.status.value,
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }
