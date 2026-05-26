"""Standalone Redis Streams consumer.

Reads from `settings.telemetry_stream` as part of the consumer group and feeds
each event into `telemetry_processor.process_event`. Run with:

    python -m app.workers.telemetry_consumer
"""

from __future__ import annotations

import asyncio
import json
import logging
import signal
import sys

from app.core.config import settings
from app.core.database import AsyncSessionLocal, init_db
from app.core.redis_client import close_redis, ensure_consumer_group, get_redis
from app.services import telemetry_processor
from app.services.heartbeat import heartbeat_loop

logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("telemetry-consumer")


async def _process_one(message_id: str, fields: dict) -> None:
    raw = fields.get("payload")
    if not raw:
        return
    try:
        event = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("dropping non-JSON event %s", message_id)
        return

    async with AsyncSessionLocal() as db:
        try:
            await telemetry_processor.process_event(db, event)
        except Exception:
            logger.exception("failed to process telemetry event %s", message_id)
            raise


async def run() -> None:
    await init_db()
    await ensure_consumer_group()
    r = get_redis()
    stop_event = asyncio.Event()

    def _shutdown(*_: object) -> None:
        logger.info("stopping consumer")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _shutdown)
        except NotImplementedError:
            signal.signal(sig, _shutdown)

    asyncio.create_task(heartbeat_loop())

    logger.info(
        "consumer %s listening on stream=%s group=%s",
        settings.telemetry_consumer_name,
        settings.telemetry_stream,
        settings.telemetry_consumer_group,
    )

    while not stop_event.is_set():
        try:
            response = await r.xreadgroup(
                groupname=settings.telemetry_consumer_group,
                consumername=settings.telemetry_consumer_name,
                streams={settings.telemetry_stream: ">"},
                count=64,
                block=2000,
            )
        except Exception:
            logger.exception("xreadgroup failed; retrying in 2s")
            await asyncio.sleep(2)
            continue

        if not response:
            continue

        for _stream, messages in response:
            for message_id, fields in messages:
                try:
                    await _process_one(message_id, fields)
                    await r.xack(
                        settings.telemetry_stream,
                        settings.telemetry_consumer_group,
                        message_id,
                    )
                except Exception:
                    # leave message un-acked for retry by pending-entries-list reclaim
                    pass

    await close_redis()


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        sys.exit(0)
