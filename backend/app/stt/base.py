from typing import AsyncIterator, Literal, TypedDict
from fastapi import WebSocket
import os

class STTEvent(TypedDict):
    type: Literal["partial_transcript", "final_transcript"]
    text: str
    ts: float


class STTAdapter:
    async def stream(self, websocket: WebSocket) -> AsyncIterator[STTEvent]:
        raise NotImplementedError

    async def aclose(self) -> None:
        return None


def get_stt_adapter() -> STTAdapter:
    provider = os.getenv("STT_PROVIDER", "browser-demo")
    if provider == "browser-demo":
        from .browser_demo import BrowserDemoSTT
        return BrowserDemoSTT()
    else:
        from .provider_adapter import ProviderSTT
        return ProviderSTT(api_key=os.getenv("PROVIDER_API_KEY", ""))



