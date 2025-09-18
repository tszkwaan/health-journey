from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Literal
import asyncio
import os

from .stt.base import STTEvent, STTAdapter, get_stt_adapter
from .storage import db, models, crud

app = FastAPI(title="Voice AI Pre-Care")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateSessionOut(BaseModel):
    sessionId: str


@app.on_event("startup")
async def startup() -> None:
    models.Base.metadata.create_all(db.engine)


@app.post("/api/intake/sessions", response_model=CreateSessionOut)
async def create_session() -> CreateSessionOut:
    session = crud.create_session(db.SessionLocal())
    return CreateSessionOut(sessionId=session.session_id)


StepLiteral = Literal[
    "greeting",
    "identification",
    "reason",
    "onset",
    "severity",
    "history",
    "allergies",
    "safety",
]


class StepIn(BaseModel):
    step: StepLiteral
    language: Literal["en", "zh-HK"]
    text: str
    confirmed: bool


@app.post("/api/intake/{session_id}/step")
async def save_step(session_id: str, body: StepIn):
    with db.SessionLocal() as session:
        crud.save_step(session, session_id=session_id, step=body.step, text=body.text, language=body.language, confirmed=body.confirmed)
    return {"ok": True}


@app.get("/api/intake/{session_id}")
async def get_intake(session_id: str):
    with db.SessionLocal() as session:
        return crud.get_intake(session, session_id)


@app.post("/api/intake/{session_id}/summary")
async def generate_summary(session_id: str):
    with db.SessionLocal() as session:
        return crud.generate_summary(session, session_id)


@app.websocket("/api/voice/ws/stt")
async def ws_stt(websocket: WebSocket):
    await websocket.accept()
    session_id = websocket.query_params.get("sessionId")
    adapter: STTAdapter = get_stt_adapter()
    try:
        async for event in adapter.stream(websocket):
            # Event is already JSON-serializable
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        await adapter.aclose()



