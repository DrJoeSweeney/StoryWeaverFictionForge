import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class StoryBible(Base):
    __tablename__ = "story_bibles"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    category = Column(String, nullable=False)  # world, magic, history, culture, rules
    title = Column(String, nullable=False)
    content = Column(Text, default="")
    tags = Column(String, nullable=True)  # comma-separated
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    project = relationship("Project", back_populates="story_bibles")
