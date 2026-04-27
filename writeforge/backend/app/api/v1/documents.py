from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.services.storage.base import BaseStorage
from app.api.deps import get_storage_dep

router = APIRouter()


@router.get("/project/{project_id}")
async def list_documents(
    project_id: str,
    parent_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    return await storage.list_documents(project_id, current_user.id, parent_id)


@router.post("")
async def create_document(
    doc_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    return await storage.create_document(current_user.id, doc_data)


@router.get("/{document_id}")
async def get_document(
    document_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    doc = await storage.get_document(document_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.put("/{document_id}")
async def update_document(
    document_id: str,
    doc_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    doc = await storage.update_document(document_id, current_user.id, doc_data)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    deleted = await storage.delete_document(document_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted"}


@router.post("/reorder")
async def reorder_documents(
    data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    project_id = data.get("project_id")
    document_ids = data.get("document_ids", [])
    if not project_id or not document_ids:
        raise HTTPException(status_code=400, detail="project_id and document_ids required")
    success = await storage.reorder_documents(project_id, current_user.id, document_ids)
    if not success:
        raise HTTPException(status_code=404, detail="Project or documents not found")
    return {"message": "Documents reordered"}
