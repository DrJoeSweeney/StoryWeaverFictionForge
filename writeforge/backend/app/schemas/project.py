from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ProjectBase(BaseModel):
    title: str
    description: Optional[str] = None
    genre: Optional[str] = None
    tone: Optional[str] = None
    status: str = "active"


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(ProjectBase):
    title: Optional[str] = None
    status: Optional[str] = None


class ProjectRead(ProjectBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
