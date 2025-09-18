from sqlalchemy.orm import declarative_base, Mapped, mapped_column
from sqlalchemy import String, DateTime, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

Base = declarative_base()


class IntakeSession(Base):
    __tablename__ = "intake_sessions"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=lambda: uuid.uuid4().hex)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class IntakeStep(Base):
    __tablename__ = "intake_steps"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True)
    step: Mapped[str] = mapped_column(String(32))
    language: Mapped[str] = mapped_column(String(16))
    text: Mapped[str] = mapped_column(Text)
    confirmed: Mapped[bool]
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class IntakeSummary(Base):
    __tablename__ = "intake_summaries"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    complete_transcript: Mapped[str] = mapped_column(Text)  # Full conversation transcript
    structured_summary: Mapped[dict] = mapped_column(JSON)  # Structured summary JSON
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)



