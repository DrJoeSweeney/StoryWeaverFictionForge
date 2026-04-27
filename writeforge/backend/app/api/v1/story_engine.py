from fastapi import APIRouter, Depends, HTTPException
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.services.storage.base import BaseStorage
from app.api.deps import get_storage_dep

router = APIRouter()


@router.get("/project/{project_id}")
async def list_outlines(
    project_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    return await storage.list_outlines(project_id, current_user.id)


@router.post("/project/{project_id}")
async def create_outline(
    project_id: str,
    outline_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    outline_data["project_id"] = project_id
    return await storage.create_outline(current_user.id, outline_data)


@router.put("/{outline_id}")
async def update_outline(
    outline_id: str,
    outline_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    outline = await storage.update_outline(outline_id, current_user.id, outline_data)
    if not outline:
        raise HTTPException(status_code=404, detail="Outline not found")
    return outline


@router.delete("/{outline_id}")
async def delete_outline(
    outline_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    deleted = await storage.delete_outline(outline_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Outline not found")
    return {"message": "Outline deleted"}


@router.post("/{outline_id}/beats")
async def create_beat(
    outline_id: str,
    beat_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    return await storage.create_beat(outline_id, current_user.id, beat_data)


@router.put("/beats/{beat_id}")
async def update_beat(
    beat_id: str,
    beat_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    beat = await storage.update_beat(beat_id, current_user.id, beat_data)
    if not beat:
        raise HTTPException(status_code=404, detail="Beat not found")
    return beat


@router.delete("/beats/{beat_id}")
async def delete_beat(
    beat_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    deleted = await storage.delete_beat(beat_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Beat not found")
    return {"message": "Beat deleted"}
