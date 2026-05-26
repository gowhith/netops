import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import AsyncSessionLocal, init_db
from app.core.redis_client import close_redis, ensure_consumer_group
from app.routers import (
    alerts,
    auth,
    automation,
    configs,
    devices,
    incidents,
    reports,
    settings as settings_router,
    telemetry,
    websocket,
)
from app.routers.auth import ensure_admin_seed
from app.services.automation_engine import seed_default_workflows
from app.services.heartbeat import heartbeat_loop

logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("netops")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("starting %s in %s mode", settings.app_name, settings.environment)
    await init_db()
    await ensure_consumer_group()
    async with AsyncSessionLocal() as db:
        await ensure_admin_seed(db)
        await seed_default_workflows(db)

    sweeper = asyncio.create_task(heartbeat_loop())
    try:
        yield
    finally:
        sweeper.cancel()
        try:
            await sweeper
        except asyncio.CancelledError:
            pass
        await close_redis()
        logger.info("shutdown complete")


app = FastAPI(
    title=settings.app_name,
    description="Real-time network monitoring, automation & reliability backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(devices.router)
app.include_router(telemetry.router)
app.include_router(configs.router)
app.include_router(alerts.router)
app.include_router(incidents.router)
app.include_router(automation.router)
app.include_router(reports.router)
app.include_router(settings_router.router)
app.include_router(websocket.router)


@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok", "service": settings.app_name}


@app.get("/", tags=["meta"])
async def root() -> dict:
    return {
        "service": settings.app_name,
        "docs": "/docs",
        "health": "/health",
    }
