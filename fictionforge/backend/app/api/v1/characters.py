from fastapi import APIRouter, Depends, HTTPException
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.services.storage.base import BaseStorage
from app.api.deps import get_storage_dep

router = APIRouter()


@router.get("/project/{project_id}")
async def list_characters(
    project_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    return await storage.list_characters(project_id, current_user.id)


@router.post("/project/{project_id}")
async def create_character(
    project_id: str,
    character_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    character_data["project_id"] = project_id
    return await storage.create_character(current_user.id, character_data)


@router.get("/{character_id}")
async def get_character(
    character_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    char = await storage.get_character(character_id, current_user.id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    return char


@router.put("/{character_id}")
async def update_character(
    character_id: str,
    character_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    char = await storage.update_character(character_id, current_user.id, character_data)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    return char


@router.delete("/{character_id}")
async def delete_character(
    character_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    deleted = await storage.delete_character(character_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Character not found")
    return {"message": "Character deleted"}


@router.post("/reorder")
async def reorder_characters(
    data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    project_id = data.get("project_id")
    item_ids = data.get("item_ids", [])
    if not project_id or not item_ids:
        raise HTTPException(status_code=400, detail="project_id and item_ids required")
    success = await storage.reorder_characters(project_id, current_user.id, item_ids)
    if not success:
        raise HTTPException(status_code=404, detail="Project or characters not found")
    return {"message": "Characters reordered"}


@router.get("/{character_id}/history")
async def list_character_history(
    character_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    return await storage.list_character_history(character_id, current_user.id)


@router.post("/{character_id}/history")
async def add_character_history(
    character_id: str,
    history_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    return await storage.add_character_history(character_id, current_user.id, history_data)
