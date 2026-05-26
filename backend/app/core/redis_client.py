from __future__ import annotations

import redis.asyncio as redis

from app.core.config import settings

_pool: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _pool
    if _pool is None:
        _pool = redis.from_url(settings.redis_url, decode_responses=True)
    return _pool


async def close_redis() -> None:
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None


async def ensure_consumer_group() -> None:
    r = get_redis()
    try:
        await r.xgroup_create(
            name=settings.telemetry_stream,
            groupname=settings.telemetry_consumer_group,
            id="0",
            mkstream=True,
        )
    except redis.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise
