from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.ws.manager import ALL_CHANNELS

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/{channel}")
async def channel_socket(ws: WebSocket, channel: str) -> None:
    mgr = ALL_CHANNELS.get(channel)
    if mgr is None:
        await ws.close(code=4404)
        return

    await mgr.connect(ws)
    try:
        while True:
            # Keep-alive: clients may send pings, we just echo.
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        await mgr.disconnect(ws)
