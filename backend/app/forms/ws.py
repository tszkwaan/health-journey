from fastapi import WebSocket, WebSocketDisconnect
from .ws_manager import form_ws_manager
import logging

logger = logging.getLogger(__name__)

async def websocket_endpoint(websocket: WebSocket, reservation_id: str):
    await form_ws_manager.connect(websocket, reservation_id)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        form_ws_manager.disconnect(websocket, reservation_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        form_ws_manager.disconnect(websocket, reservation_id)
