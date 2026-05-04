import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Float, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class AIActivityLog(Base):
    __tablename__ = "ai_activity_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    document_id = Column(String, nullable=True)

    request_type = Column(String, nullable=False)  # agentic, agent, direct, stream
    action = Column(String, nullable=True)
    skill_id = Column(String, nullable=True)
    skill_name = Column(String, nullable=True)

    prompt_text = Column(Text, nullable=True)
    model = Column(String, nullable=True)
    provider = Column(String, nullable=True)
    temperature = Column(Float, nullable=True)

    tier = Column(String, nullable=True)  # quick_edit, content_gen, research, deep_work
    reasoning_log = Column(Text, nullable=True)  # JSON string
    consulted_docs = Column(Text, nullable=True)  # JSON string
    context_length = Column(Integer, nullable=True)

    request_messages = Column(Text, nullable=True)  # JSON string of messages
    result_content = Column(Text, nullable=True)
    result_tokens_input = Column(Integer, nullable=True)
    result_tokens_output = Column(Integer, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    error = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="ai_activity_logs")
