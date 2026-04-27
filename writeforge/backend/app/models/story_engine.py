import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class StoryOutline(Base):
    __tablename__ = "story_outlines"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    structure_type = Column(String, default="three-act")  # three-act, hero-journey, save-the-cat, custom
    content = Column(Text, nullable=True)  # JSON blob for flexible structure
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    project = relationship("Project", back_populates="story_outlines")
    beats = relationship("StoryBeat", back_populates="outline", cascade="all, delete-orphan")


class StoryBeat(Base):
    __tablename__ = "story_beats"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    outline_id = Column(String, ForeignKey("story_outlines.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    act_number = Column(Integer, default=1)
    position = Column(Integer, default=0)
    target_word_count = Column(Integer, nullable=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    outline = relationship("StoryOutline", back_populates="beats")
