import asyncio
import json
from typing import Dict, Set
from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)

class FormGenerationWebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, reservation_id: str):
        await websocket.accept()
        if reservation_id not in self.active_connections:
            self.active_connections[reservation_id] = set()
        self.active_connections[reservation_id].add(websocket)
        logger.info(f"WebSocket connected for reservation {reservation_id}")
    
    def disconnect(self, websocket: WebSocket, reservation_id: str):
        if reservation_id in self.active_connections:
            self.active_connections[reservation_id].discard(websocket)
            if not self.active_connections[reservation_id]:
                del self.active_connections[reservation_id]
        logger.info(f"WebSocket disconnected for reservation {reservation_id}")
    
    async def send_form_generated(self, reservation_id: str, form_id: str, form_data: dict):
        if reservation_id in self.active_connections:
            message = {
                "type": "form_generated",
                "formId": form_id,
                "formData": form_data
            }
            disconnected = set()
            for websocket in self.active_connections[reservation_id]:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.warning(f"Failed to send message to WebSocket: {e}")
                    disconnected.add(websocket)
            
            # Remove disconnected websockets
            for websocket in disconnected:
                self.active_connections[reservation_id].discard(websocket)
    
    async def send_form_error(self, reservation_id: str, form_id: str, error: str):
        if reservation_id in self.active_connections:
            message = {
                "type": "form_generation_error",
                "formId": form_id,
                "error": error
            }
            disconnected = set()
            for websocket in self.active_connections[reservation_id]:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.warning(f"Failed to send error message to WebSocket: {e}")
                    disconnected.add(websocket)
            
            # Remove disconnected websockets
            for websocket in disconnected:
                self.active_connections[reservation_id].discard(websocket)

# Global instance
form_ws_manager = FormGenerationWebSocketManager()
