import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class CanvasNode(Base):
    __tablename__ = "canvas_nodes"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    node_type = Column(String, default="note")  # scene, character, note, image
    label = Column(String, nullable=False)
    data = Column(Text, nullable=True)  # JSON blob
    position_x = Column(Float, default=0)
    position_y = Column(Float, default=0)
    width = Column(Float, default=200)
    height = Column(Float, default=100)
    color = Column(String, nullable=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=True)
    character_id = Column(String, ForeignKey("characters.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    project = relationship("Project", back_populates="canvas_nodes")


class CanvasEdge(Base):
    __tablename__ = "canvas_edges"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    source_node_id = Column(String, ForeignKey("canvas_nodes.id"), nullable=False)
    target_node_id = Column(String, ForeignKey("canvas_nodes.id"), nullable=False)
    label = Column(String, nullable=True)
    edge_type = Column(String, default="related")  # chronology, causality, presence, theme
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="canvas_edges")
