import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.database import Base


class Character(Base):
    __tablename__ = "characters"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    aliases = Column(String, nullable=True)
    role = Column(String, default="supporting")  # protagonist, antagonist, supporting
    archetype = Column(String, nullable=True)
    age = Column(String, nullable=True)
    appearance = Column(Text, nullable=True)  # JSON
    personality = Column(Text, nullable=True)  # JSON
    background = Column(Text, nullable=True)
    goals = Column(Text, nullable=True)
    conflicts = Column(Text, nullable=True)
    voice_description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    project = relationship("Project", back_populates="characters")
    history = relationship("CharacterHistory", back_populates="character", cascade="all, delete-orphan")


class CharacterHistory(Base):
    __tablename__ = "character_history"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    character_id = Column(String, ForeignKey("characters.id"), nullable=False)
    event_title = Column(String, nullable=False)
    event_description = Column(Text, nullable=True)
    chapter_document_id = Column(String, ForeignKey("documents.id"), nullable=True)
    timestamp_in_story = Column(String, nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    character = relationship("Character", back_populates="history")
