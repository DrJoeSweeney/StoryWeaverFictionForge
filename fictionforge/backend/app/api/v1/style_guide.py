from fastapi import APIRouter, Depends, HTTPException
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.services.storage.base import BaseStorage
from app.api.deps import get_storage_dep

router = APIRouter()


@router.get("/project/{project_id}")
async def list_style_guide(
    project_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    return await storage.list_style_guide(project_id, current_user.id)


@router.post("")
async def create_style_guide(
    data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    return await storage.create_style_guide(current_user.id, data)


@router.put("/{entry_id}")
async def update_style_guide(
    entry_id: str,
    data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    updated = await storage.update_style_guide(entry_id, current_user.id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Entry not found")
    return updated


@router.post("/reorder")
async def reorder_style_guide(
    data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    project_id = data.get("project_id")
    item_ids = data.get("item_ids", [])
    if not project_id or not item_ids:
        raise HTTPException(status_code=400, detail="project_id and item_ids required")
    success = await storage.reorder_style_guide(project_id, current_user.id, item_ids)
    if not success:
        raise HTTPException(status_code=404, detail="Project or entries not found")
    return {"message": "Style guide entries reordered"}


@router.delete("/{entry_id}")
async def delete_style_guide(
    entry_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    deleted = await storage.delete_style_guide(entry_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted"}
