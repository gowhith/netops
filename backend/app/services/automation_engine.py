"""Tiny rule-driven automation runner.

Each workflow has a list of `actions`, each `{"type": "...", ...params}`.
Supported action types (all simulated — no real device side effects):

    log              { message }
    create_incident  { title?, severity? }
    restart_device   {}            -> resets status to UNKNOWN
    rollback_config  {}            -> calls config service rollback
    notify           { channel?, message }
    mark_recovered   {}            -> sets status to HEALTHY
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation import AutomationRun, AutomationRunStatus, AutomationWorkflow
from app.models.device import Device, DeviceStatus
from app.models.incident import Incident, IncidentEvent, IncidentSeverity, IncidentStatus
from app.services import notification
from app.services.config_service import rollback_to_baseline

logger = logging.getLogger(__name__)


async def get_workflow(
    db: AsyncSession, workflow_id: int | None = None, workflow_name: str | None = None
) -> AutomationWorkflow | None:
    if workflow_id is not None:
        return (await db.execute(select(AutomationWorkflow).where(AutomationWorkflow.id == workflow_id))).scalar_one_or_none()
    if workflow_name is not None:
        return (await db.execute(select(AutomationWorkflow).where(AutomationWorkflow.name == workflow_name))).scalar_one_or_none()
    return None


async def run_workflow(
    db: AsyncSession,
    workflow: AutomationWorkflow,
    device_id: str | None,
    incident_id: int | None,
    context: dict[str, Any],
) -> AutomationRun:
    run = AutomationRun(
        workflow_id=workflow.id,
        device_id=device_id,
        incident_id=incident_id,
        status=AutomationRunStatus.RUNNING,
        log=[],
    )
    db.add(run)
    await db.flush()

    log: list[dict] = []
    success = True

    try:
        for action in workflow.actions or []:
            atype = action.get("type")
            entry = {"action": atype, "ts": datetime.now(timezone.utc).isoformat()}
            try:
                result = await _execute_action(db, atype, action, device_id, incident_id, context, log)
                entry["status"] = "ok"
                if result is not None:
                    entry["result"] = result
            except Exception as e:
                logger.exception("automation action failed: %s", atype)
                entry["status"] = "error"
                entry["error"] = str(e)
                success = False
            log.append(entry)
            if not success:
                break
    finally:
        run.log = log
        run.status = AutomationRunStatus.SUCCESS if success else AutomationRunStatus.FAILED
        run.finished_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(run)

    return run


async def _execute_action(
    db: AsyncSession,
    atype: str | None,
    action: dict,
    device_id: str | None,
    incident_id: int | None,
    context: dict,
    log: list[dict],
) -> Any:
    if atype == "log":
        return {"message": action.get("message", "")}

    if atype == "create_incident":
        if not device_id:
            raise ValueError("create_incident needs device_id")
        sev_raw = (action.get("severity") or "medium").lower()
        try:
            sev = IncidentSeverity(sev_raw)
        except ValueError:
            sev = IncidentSeverity.MEDIUM
        incident = Incident(
            device_id=device_id,
            title=action.get("title") or f"Automation incident for {device_id}",
            description=action.get("description"),
            severity=sev,
            status=IncidentStatus.OPEN,
        )
        db.add(incident)
        await db.flush()
        db.add(
            IncidentEvent(
                incident_id=incident.id,
                event_type="created",
                message="Created by automation",
                actor="automation_engine",
            )
        )
        context["incident_id"] = incident.id
        await notification.notify_incident("incident.created",
                                          {"id": incident.id, "device_id": device_id,
                                           "title": incident.title, "severity": sev.value,
                                           "status": incident.status.value})
        return {"incident_id": incident.id}

    if atype == "restart_device":
        if not device_id:
            raise ValueError("restart_device needs device_id")
        device = await _get_device(db, device_id)
        device.status = DeviceStatus.UNKNOWN
        await notification.notify_device("device.restarted",
                                         {"device_id": device_id, "status": device.status.value})
        return {"device_id": device_id, "new_status": device.status.value}

    if atype == "rollback_config":
        if not device_id:
            raise ValueError("rollback_config needs device_id")
        differences = await rollback_to_baseline(db, device_id, reason="automation rollback",
                                                  changed_by="automation_engine")
        return {"reverted_fields": list(differences.keys())}

    if atype == "notify":
        msg = action.get("message", "automation notice")
        await notification.notify_alert(
            {"device_id": device_id, "rule": "automation.notify",
             "severity": "info", "status": "active", "message": msg}
        )
        return {"sent": True}

    if atype == "mark_recovered":
        if not device_id:
            raise ValueError("mark_recovered needs device_id")
        device = await _get_device(db, device_id)
        device.status = DeviceStatus.HEALTHY
        device.health_score = 100.0
        if incident_id is not None:
            incident = (await db.execute(select(Incident).where(Incident.id == incident_id))).scalar_one_or_none()
            if incident is not None:
                incident.status = IncidentStatus.RESOLVED
                incident.resolved_at = datetime.now(timezone.utc)
                incident.root_cause = incident.root_cause or "auto-recovered"
                db.add(IncidentEvent(incident_id=incident.id, event_type="resolved",
                                     message="Marked recovered by automation",
                                     actor="automation_engine"))
        await notification.notify_device("device.recovered",
                                         {"device_id": device_id, "status": device.status.value})
        return {"device_id": device_id, "status": device.status.value}

    raise ValueError(f"unknown action type: {atype}")


async def _get_device(db: AsyncSession, device_id: str) -> Device:
    result = await db.execute(select(Device).where(Device.device_id == device_id))
    device = result.scalar_one_or_none()
    if device is None:
        raise ValueError(f"unknown device: {device_id}")
    return device


DEFAULT_WORKFLOWS = [
    {
        "name": "auto_recovery_offline",
        "description": "Auto-recovery for offline devices",
        "trigger": "device.offline",
        "actions": [
            {"type": "create_incident", "title": "Device offline", "severity": "high"},
            {"type": "restart_device"},
            {"type": "notify", "message": "Attempted restart on offline device"},
            {"type": "mark_recovered"},
        ],
        "enabled": True,
    },
    {
        "name": "auto_recovery_config_drift",
        "description": "Rollback config when drift is detected",
        "trigger": "config.drift",
        "actions": [
            {"type": "create_incident", "title": "Config drift detected", "severity": "medium"},
            {"type": "rollback_config"},
            {"type": "notify", "message": "Config rolled back to baseline"},
        ],
        "enabled": True,
    },
]


async def seed_default_workflows(db: AsyncSession) -> None:
    existing = (await db.execute(select(AutomationWorkflow.name))).scalars().all()
    existing_set = set(existing)
    for w in DEFAULT_WORKFLOWS:
        if w["name"] in existing_set:
            continue
        db.add(AutomationWorkflow(**w))
    await db.commit()
