import time
from typing import AsyncIterator
from fastapi import WebSocket
from .base import STTEvent, STTAdapter

# Placeholder: integrate Deepgram/Google SDK here. Keep adapter-agnostic.


class ProviderSTT(STTAdapter):
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def stream(self, websocket: WebSocket) -> AsyncIterator[STTEvent]:
        # For now, echo demo like browser, ready for provider integration
        while True:
            data = await websocket.receive_json()
            text = data.get("text", "")
            now = time.time()
            yield {"type": "partial_transcript", "text": text, "ts": now}



