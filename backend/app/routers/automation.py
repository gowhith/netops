from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.automation import AutomationRun, AutomationWorkflow
from app.models.user import User, UserRole
from app.schemas.automation import (
    AutomationRunOut,
    RunWorkflowIn,
    WorkflowCreate,
    WorkflowOut,
)
from app.services import automation_engine

router = APIRouter(prefix="/api/automation", tags=["automation"])


@router.get("/workflows", response_model=List[WorkflowOut])
async def list_workflows(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> List[WorkflowOut]:
    rows = (
        await db.execute(select(AutomationWorkflow).order_by(AutomationWorkflow.id))
    ).scalars().all()
    return [WorkflowOut.model_validate(r) for r in rows]


@router.post("/workflows", response_model=WorkflowOut, status_code=201)
async def create_workflow(
    payload: WorkflowCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.ADMIN, UserRole.ENGINEER))],
) -> WorkflowOut:
    wf = AutomationWorkflow(**payload.model_dump())
    db.add(wf)
    await db.commit()
    await db.refresh(wf)
    return WorkflowOut.model_validate(wf)


@router.post("/run", response_model=AutomationRunOut)
async def run_workflow(
    payload: RunWorkflowIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.ADMIN, UserRole.ENGINEER))],
) -> AutomationRunOut:
    workflow = await automation_engine.get_workflow(
        db, workflow_id=payload.workflow_id, workflow_name=payload.workflow_name
    )
    if workflow is None:
        raise HTTPException(status_code=404, detail="workflow not found")
    run = await automation_engine.run_workflow(
        db,
        workflow=workflow,
        device_id=payload.device_id,
        incident_id=payload.incident_id,
        context=payload.context or {},
    )
    return AutomationRunOut.model_validate(run)


@router.get("/runs", response_model=List[AutomationRunOut])
async def list_runs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    limit: int = 100,
) -> List[AutomationRunOut]:
    rows = (
        await db.execute(select(AutomationRun).order_by(desc(AutomationRun.started_at)).limit(limit))
    ).scalars().all()
    return [AutomationRunOut.model_validate(r) for r in rows]
