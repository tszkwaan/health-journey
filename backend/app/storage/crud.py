from sqlalchemy.orm import Session
from datetime import datetime
from . import models


def create_session(db: Session) -> models.IntakeSession:
    obj = models.IntakeSession()
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def save_step(db: Session, session_id: str, step: str, text: str, language: str, confirmed: bool) -> None:
    obj = models.IntakeStep(session_id=session_id, step=step, language=language, text=text, confirmed=confirmed)
    db.add(obj)
    db.commit()


def get_intake(db: Session, session_id: str):
    steps = db.query(models.IntakeStep).filter(models.IntakeStep.session_id == session_id).order_by(models.IntakeStep.created_at.asc()).all()
    return {"sessionId": session_id, "steps": [
        {"step": s.step, "text": s.text, "language": s.language, "confirmed": s.confirmed, "created_at": s.created_at.isoformat()} for s in steps
    ]}


def generate_summary(db: Session, session_id: str):
    steps = db.query(models.IntakeStep).filter(models.IntakeStep.session_id == session_id).all()
    def first_text(step_key: str):
        for s in steps:
            if s.step == step_key and s.confirmed:
                return s.text
        return ""

    relevant_history = [s.text for s in steps if s.step == "history" and s.confirmed]
    allergies = [s.text for s in steps if s.step == "allergies" and s.confirmed]

    red_flags = []
    safety_text = first_text("safety").lower()
    for kw in ["chest pain", "shortness of breath", "faint", "severe bleeding", "suicid"]:
        if kw in safety_text:
            red_flags.append(kw)

    return {
        "patient_info": {"name": first_text("identification"), "dob": "", "contact": ""},
        "main_complaint": first_text("reason"),
        "symptom_onset": first_text("onset"),
        "severity": "unknown",
        "relevant_history": relevant_history,
        "allergies": allergies,
        "red_flags": red_flags,
        "created_at": datetime.utcnow().isoformat(),
        "sessionId": session_id,
    }



