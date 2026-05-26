"""WebSocket fan-out backed by Redis pub/sub.

Each ConnectionManager holds the local sockets for one channel and re-publishes
events to Redis so that other API replicas can fan them out too.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import Any

from fastapi import WebSocket
from starlette.websockets import WebSocketState

from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)


def _json_default(obj: Any) -> Any:
    if isinstance(obj, datetime):
        return obj.isoformat()
    if hasattr(obj, "value"):
        return obj.value
    raise TypeError(f"Not serializable: {type(obj)}")


class ConnectionManager:
    def __init__(self, channel: str) -> None:
        self.channel = channel
        self.redis_channel = f"ws:{channel}"
        self.connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self._listener_task: asyncio.Task | None = None

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self.connections.add(ws)
            if self._listener_task is None or self._listener_task.done():
                self._listener_task = asyncio.create_task(self._listen_redis())

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self.connections.discard(ws)

    async def broadcast_local(self, payload: dict) -> None:
        message = json.dumps(payload, default=_json_default)
        dead: list[WebSocket] = []
        for ws in list(self.connections):
            try:
                if ws.application_state == WebSocketState.CONNECTED:
                    await ws.send_text(message)
                else:
                    dead.append(ws)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self.connections.discard(ws)

    async def publish(self, payload: dict) -> None:
        """Fan out via Redis so all replicas (and the worker) reach every client."""
        message = json.dumps(payload, default=_json_default)
        try:
            await get_redis().publish(self.redis_channel, message)
        except Exception:
            logger.exception("Redis publish failed; falling back to local broadcast")
            await self.broadcast_local(payload)

    async def _listen_redis(self) -> None:
        pubsub = get_redis().pubsub()
        await pubsub.subscribe(self.redis_channel)
        try:
            async for msg in pubsub.listen():
                if msg.get("type") != "message":
                    continue
                try:
                    data = json.loads(msg["data"])
                except (TypeError, json.JSONDecodeError):
                    continue
                await self.broadcast_local(data)
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("WS redis listener crashed")
        finally:
            try:
                await pubsub.unsubscribe(self.redis_channel)
                await pubsub.aclose()
            except Exception:
                pass


# Channel registry — one manager per WS endpoint.
devices_ws = ConnectionManager("devices")
alerts_ws = ConnectionManager("alerts")
incidents_ws = ConnectionManager("incidents")
topology_ws = ConnectionManager("topology")
telemetry_ws = ConnectionManager("telemetry")

ALL_CHANNELS = {
    "devices": devices_ws,
    "alerts": alerts_ws,
    "incidents": incidents_ws,
    "topology": topology_ws,
    "telemetry": telemetry_ws,
}


async def publish_event(channel: str, event_type: str, data: dict) -> None:
    mgr = ALL_CHANNELS.get(channel)
    if mgr is None:
        return
    await mgr.publish({"type": event_type, "data": data, "ts": datetime.utcnow().isoformat()})
