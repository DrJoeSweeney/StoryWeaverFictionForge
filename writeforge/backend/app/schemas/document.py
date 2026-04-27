from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class DocumentBase(BaseModel):
    title: str
    content: Optional[str] = ""
    doc_type: str = "chapter"
    sort_order: int = 0
    parent_id: Optional[str] = None


class DocumentCreate(DocumentBase):
    project_id: str


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    doc_type: Optional[str] = None
    sort_order: Optional[int] = None
    parent_id: Optional[str] = None


class DocumentRead(DocumentBase):
    id: str
    project_id: str
    word_count: int
    created_at: datetime
    updated_at: datetime
    children: List["DocumentRead"] | None = []
    
    class Config:
        from_attributes = True
