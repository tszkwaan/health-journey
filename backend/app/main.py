from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Literal
import asyncio
import os

from .stt.base import STTEvent, STTAdapter, get_stt_adapter
from .storage import db, models, crud
from .forms.ws import websocket_endpoint
from .forms.ws_manager import form_ws_manager

app = FastAPI(title="Voice AI Pre-Care")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for now
    allow_credentials=False,  # Set to False when allowing all origins
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add manual CORS handling as backup
@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response


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


@app.get("/api/intake/summaries")
async def list_summaries():
    """List all intake summaries for doctor dashboard"""
    with db.SessionLocal() as session:
        return crud.list_all_summaries(session)


@app.get("/api/intake/{session_id}")
async def get_intake(session_id: str):
    with db.SessionLocal() as session:
        return crud.get_intake(session, session_id)


@app.post("/api/intake/{session_id}/summary")
async def generate_summary(session_id: str):
    with db.SessionLocal() as session:
        return crud.generate_summary(session, session_id)


@app.get("/api/intake/{session_id}/summary")
async def get_saved_summary(session_id: str):
    """Get saved summary and transcript for doctor review"""
    with db.SessionLocal() as session:
        result = crud.get_saved_summary(session, session_id)
        if not result:
            return {"error": "Summary not found"}
        return result


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


@app.websocket("/api/forms/ws")
async def ws_forms(websocket: WebSocket, reservation_id: str):
    await websocket_endpoint(websocket, reservation_id)


class FormNotification(BaseModel):
    reservationId: str
    formId: str
    formData: Optional[dict] = None
    error: Optional[str] = None
    type: str


@app.post("/api/forms/notify")
async def notify_form_generation(notification: FormNotification):
    if notification.type == "form_generated":
        await form_ws_manager.send_form_generated(
            notification.reservationId, 
            notification.formId, 
            notification.formData or {}
        )
    elif notification.type == "form_generation_error":
        await form_ws_manager.send_form_error(
            notification.reservationId, 
            notification.formId, 
            notification.error or "Unknown error"
        )
    return {"ok": True}



