from fastapi import APIRouter, Depends, HTTPException
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.services.storage.base import BaseStorage
from app.api.deps import get_storage_dep

router = APIRouter()


@router.get("/project/{project_id}")
async def list_story_bible(
    project_id: str,
    category: str | None = None,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    return await storage.list_story_bible(project_id, current_user.id, category)


@router.post("/project/{project_id}")
async def create_story_bible(
    project_id: str,
    bible_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    bible_data["project_id"] = project_id
    return await storage.create_story_bible(current_user.id, bible_data)


@router.put("/{entry_id}")
async def update_story_bible(
    entry_id: str,
    bible_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    entry = await storage.update_story_bible(entry_id, current_user.id, bible_data)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.delete("/{entry_id}")
async def delete_story_bible(
    entry_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    deleted = await storage.delete_story_bible(entry_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted"}
