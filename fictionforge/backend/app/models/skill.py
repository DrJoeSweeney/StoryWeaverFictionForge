import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Skill(Base):
    __tablename__ = "skills"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, default="writing")  # writing, style, worldbuilding, character
    prompt_template = Column(Text, nullable=False)
    variables = Column(Text, nullable=True)  # JSON schema for variables
    example_input = Column(Text, nullable=True)
    example_output = Column(Text, nullable=True)
    is_global = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="skills")


class SkillApplication(Base):
    __tablename__ = "skill_applications"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    skill_id = Column(String, ForeignKey("skills.id"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    document_id = Column(String, ForeignKey("documents.id"), nullable=True)
    applied_at = Column(DateTime, default=datetime.utcnow)
    result_snapshot = Column(Text, nullable=True)
    
    skill = relationship("Skill")
