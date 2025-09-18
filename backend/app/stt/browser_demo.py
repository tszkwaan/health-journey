import time
from typing import AsyncIterator
from fastapi import WebSocket
from .base import STTEvent, STTAdapter


class BrowserDemoSTT(STTAdapter):
    async def stream(self, websocket: WebSocket) -> AsyncIterator[STTEvent]:
        # In demo mode, the client sends interim/final text chunks as JSON
        # {type: 'partial'|'final', text: string}
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            text = data.get("text", "")
            now = time.time()
            if msg_type == "partial":
                yield {"type": "partial_transcript", "text": text, "ts": now}
            elif msg_type == "final":
                yield {"type": "final_transcript", "text": text, "ts": now}



