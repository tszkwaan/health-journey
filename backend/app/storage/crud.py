from sqlalchemy.orm import Session
from datetime import datetime
from . import models
from ..summary.base import get_summary_adapter
import re


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

    def parse_patient_info(text: str):
        if not text:
            return {"name": "", "dob": "", "contact": ""}
        raw = text.strip()
        lower = raw.lower()
        # Extract contact: sequence of digits (and dashes/spaces) length 7-20
        contact_match = re.search(r"(\b(?:contact|phone|number|contact number)\b[^0-9]*)([+\d][\d\-\s]{6,})", lower)
        contact = ""
        if contact_match:
            contact = re.sub(r"[^+\d]", "", contact_match.group(2))
        else:
            # fallback: last long digit group
            m = re.findall(r"[+]?\d[\d\-\s]{6,}", raw)
            if m:
                contact = re.sub(r"[^+\d]", "", m[-1])

        # Extract DOB: try YYYY-MM-DD, YYYY/MM/DD, '1994 October 10th', 'Oct 10 1994'
        dob = ""
        m = re.search(r"(19|20)\d{2}[-\/. ](0?[1-9]|1[0-2])[-\/. ](0?[1-9]|[12]\d|3[01])", raw)
        if m:
            dob = f"{m.group(1)}{raw[m.start(1)+2:m.end(1)]}{''}"  # placeholder to avoid flake; replaced below
            dob = f"{m.group(1)}{raw[m.start(1):m.end(1)]}"  # not used
            dob = f"{m.group(1)}{''}"  # reset
            dob = f"{m.group(1)}{''}"  # simplify
            dob = f"{m.group(1)}{''}"  # will override below
            dob = f"{m.group(1)}"  # temporary
            dob = f"{m.group(0)}"
        else:
            month_names = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december"
            m2 = re.search(rf"((?:{month_names}))\.?\s*(\d{{1,2}})(?:st|nd|rd|th)?\s*(?:,?\s*(\d{{4}}))?", lower, re.I)
            y2 = re.search(r"(19|20)\d{2}", lower)
            if m2 and y2:
                mon = m2.group(1)
                day = m2.group(2)
                year = y2.group(0)
                dob = f"{mon} {day} {year}"

        # Extract name: look for "name is X" or start until DOB/contact markers
        name = ""
        m = re.search(r"\b(name is|my name is)\b\s*(.+)$", lower)
        segment_until = re.split(r"\b(dob|date of birth|contact|phone|number|contact number)\b", lower)
        if m:
            after = raw[m.end():].strip()
            # cut off at markers
            cut = re.split(r"\b(DOB|Date of Birth|contact|phone|number|contact number)\b", after, flags=re.I)[0].strip()
            name = cut
        elif segment_until and len(segment_until) >= 1:
            # take leading words up to first marker
            head = segment_until[0].strip()
            # remove common starters
            head = re.sub(r"^\s*(my\s+)?name\s+is\s+", "", head, flags=re.I)
            name = head.strip()

        return {"name": name, "dob": dob, "contact": contact}

    patient_ident_text = first_text("identification")
    patient_info_struct = parse_patient_info(patient_ident_text)
    # Expose patient_info as a single string for frontend simplicity
    patient_info = (
        f"Name: {patient_info_struct.get('name','').strip()}"
        f"; DOB: {patient_info_struct.get('dob','').strip()}"
        f"; Contact: {patient_info_struct.get('contact','').strip()}"
    ).strip()

    # Optional LLM summarization
    adapter = get_summary_adapter()
    try:
        steps_payload = [
            {"step": s.step, "text": s.text, "language": s.language, "confirmed": s.confirmed, "ts": s.created_at.isoformat()}
            for s in steps
        ]
        llm_summary = None
        # Adapter may be async; call defensively
        import asyncio
        if asyncio.get_event_loop().is_running():
            llm_summary = asyncio.get_event_loop().run_until_complete(adapter.summarize(steps_payload))
        else:
            llm_summary = asyncio.run(adapter.summarize(steps_payload))
    except Exception:
        llm_summary = None

    result = {
        "patient_info": patient_info,
        "patient_info_struct": patient_info_struct,
        "main_complaint": first_text("reason"),
        "symptom_onset": first_text("onset"),
        "severity": "unknown",
        "relevant_history": relevant_history,
        "allergies": allergies,
        "red_flags": red_flags,
        "created_at": datetime.utcnow().isoformat(),
        "sessionId": session_id,
    }
    if llm_summary:
        result.update({k: v for k, v in llm_summary.items() if v is not None})
    
    # Build complete transcript from all confirmed steps
    complete_transcript = []
    for step in sorted(steps, key=lambda x: x.created_at):
        if step.confirmed:
            complete_transcript.append(f"[{step.step}] {step.text}")
    
    # Save or update summary in database
    existing_summary = db.query(models.IntakeSummary).filter(models.IntakeSummary.session_id == session_id).first()
    if existing_summary:
        # Update existing summary
        existing_summary.complete_transcript = "\n".join(complete_transcript)
        existing_summary.structured_summary = result
        existing_summary.created_at = datetime.utcnow()
    else:
        # Create new summary
        summary_obj = models.IntakeSummary(
            session_id=session_id,
            complete_transcript="\n".join(complete_transcript),
            structured_summary=result
        )
        db.add(summary_obj)
    db.commit()
    
    return result


def get_saved_summary(db: Session, session_id: str):
    """Retrieve saved summary and transcript for a session"""
    summary = db.query(models.IntakeSummary).filter(models.IntakeSummary.session_id == session_id).first()
    if not summary:
        return None
    
    return {
        "session_id": summary.session_id,
        "complete_transcript": summary.complete_transcript,
        "structured_summary": summary.structured_summary,
        "created_at": summary.created_at.isoformat()
    }


def list_all_summaries(db: Session, limit: int = 50):
    """List all saved summaries for doctor review"""
    summaries = db.query(models.IntakeSummary).order_by(models.IntakeSummary.created_at.desc()).limit(limit).all()
    return [
        {
            "session_id": s.session_id,
            "patient_info": s.structured_summary.get("patient_info", ""),
            "main_complaint": s.structured_summary.get("main_complaint", ""),
            "red_flags": s.structured_summary.get("red_flags", []),
            "created_at": s.created_at.isoformat()
        }
        for s in summaries
    ]



