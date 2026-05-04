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
    """Deprecated: returns story-plan documents (outlines, scenes, beats)."""
    docs = await storage.list_documents(project_id, current_user.id)
    return [d for d in docs if d.get("doc_type") in ("outline", "scene", "beat")]


@router.post("/project/{project_id}")
async def create_outline(
    project_id: str,
    outline_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    """Deprecated: create a story-plan document via the document endpoint."""
    outline_data["project_id"] = project_id
    outline_data.setdefault("doc_type", "outline")
    return await storage.create_document(current_user.id, outline_data)


@router.put("/{outline_id}")
async def update_outline(
    outline_id: str,
    outline_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    """Deprecated: update via the document endpoint."""
    outline = await storage.update_document(outline_id, current_user.id, outline_data)
    if not outline:
        raise HTTPException(status_code=404, detail="Outline not found")
    return outline


@router.post("/reorder")
async def reorder_outlines(
    data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    """Deprecated: reorder via the document endpoint."""
    project_id = data.get("project_id")
    item_ids = data.get("item_ids", [])
    if not project_id or not item_ids:
        raise HTTPException(status_code=400, detail="project_id and item_ids required")
    success = await storage.reorder_documents(project_id, current_user.id, item_ids)
    if not success:
        raise HTTPException(status_code=404, detail="Project or outlines not found")
    return {"message": "Outlines reordered"}


@router.delete("/{outline_id}")
async def delete_outline(
    outline_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    """Deprecated: delete via the document endpoint."""
    deleted = await storage.delete_document(outline_id, current_user.id)
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
    """Deprecated: create a beat as a child document."""
    beat_data["project_id"] = (await storage.get_document(outline_id, current_user.id) or {}).get("project_id")
    if not beat_data.get("project_id"):
        raise HTTPException(status_code=404, detail="Parent outline not found")
    beat_data["parent_id"] = outline_id
    beat_data.setdefault("doc_type", "beat")
    return await storage.create_document(current_user.id, beat_data)


@router.put("/beats/{beat_id}")
async def update_beat(
    beat_id: str,
    beat_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    """Deprecated: update via the document endpoint."""
    beat = await storage.update_document(beat_id, current_user.id, beat_data)
    if not beat:
        raise HTTPException(status_code=404, detail="Beat not found")
    return beat


@router.delete("/beats/{beat_id}")
async def delete_beat(
    beat_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    """Deprecated: delete via the document endpoint."""
    deleted = await storage.delete_document(beat_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Beat not found")
    return {"message": "Beat deleted"}
