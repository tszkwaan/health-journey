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
    """Generate summary using LLM directly from conversation steps"""
    steps = db.query(models.IntakeStep).filter(models.IntakeStep.session_id == session_id).all()
    
    # Build complete transcript from all confirmed steps
    complete_transcript = []
    for step in sorted(steps, key=lambda x: x.created_at):
        if step.confirmed:
            complete_transcript.append(f"[{step.step}] {step.text}")
    
    print(f"🔍 DEBUG: Complete transcript: {complete_transcript}")
    
    # Use LLM to summarize the entire conversation
    adapter = get_summary_adapter()
    print(f"🔍 DEBUG: Using summary adapter: {type(adapter).__name__}")
    
    try:
        steps_payload = [
            {"step": s.step, "text": s.text, "language": s.language, "confirmed": s.confirmed, "ts": s.created_at.isoformat()}
            for s in steps
        ]
        print(f"🔍 DEBUG: Steps payload for LLM: {steps_payload}")
        
        llm_summary = None
        # Adapter may be async; call defensively
        import asyncio
        try:
            # Try to get the current event loop
            loop = asyncio.get_running_loop()
            # If we're in an async context, create a task
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, adapter.summarize(steps_payload))
                llm_summary = future.result(timeout=30)
        except RuntimeError:
            # No event loop running, safe to use asyncio.run
            llm_summary = asyncio.run(adapter.summarize(steps_payload))
        
        print(f"🔍 DEBUG: LLM Summary result: {llm_summary}")
        if llm_summary:
            print(f"📋 DEBUG: Complete LLM Summary Details:")
            print(f"   - Patient Info: {llm_summary.get('patient_info', 'N/A')}")
            print(f"   - Main Complaint: {llm_summary.get('main_complaint', 'N/A')}")
            print(f"   - Symptom Onset: {llm_summary.get('symptom_onset', 'N/A')}")
            print(f"   - Relevant History: {llm_summary.get('relevant_history', [])}")
            print(f"   - Allergies: {llm_summary.get('allergies', [])}")
            print(f"   - Red Flags: {llm_summary.get('red_flags', [])}")
    except Exception as e:
        print(f"🔍 DEBUG: LLM Summary error: {e}")
        llm_summary = None

    # Use LLM summary as the primary result, with fallbacks
    result = {
        "patient_info": llm_summary.get("patient_info", "") if llm_summary else "",
        "main_complaint": llm_summary.get("main_complaint", "") if llm_summary else "",
        "symptom_onset": llm_summary.get("symptom_onset", "") if llm_summary else "",
        "relevant_history": llm_summary.get("relevant_history", []) if llm_summary else [],
        "allergies": llm_summary.get("allergies", []) if llm_summary else [],
        "red_flags": llm_summary.get("red_flags", []) if llm_summary else [],
        "created_at": datetime.utcnow().isoformat(),
        "sessionId": session_id,
    }
    
    print(f"🔍 DEBUG: Final result: {result}")
    
    # Save or update summary in database
    existing_summary = db.query(models.IntakeSummary).filter(models.IntakeSummary.session_id == session_id).first()
    if existing_summary:
        # Update existing summary
        existing_summary.complete_transcript = "\n".join(complete_transcript)
        existing_summary.structured_summary = result
        existing_summary.created_at = datetime.utcnow()
        print(f"🔍 DEBUG: Updated existing summary in database")
    else:
        # Create new summary
        summary_obj = models.IntakeSummary(
            session_id=session_id,
            complete_transcript="\n".join(complete_transcript),
            structured_summary=result
        )
        db.add(summary_obj)
        print(f"🔍 DEBUG: Created new summary in database")
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



