from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.services.storage.base import BaseStorage
from app.api.deps import get_storage_dep

router = APIRouter()


@router.get("")
async def list_projects(
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    return await storage.list_projects(current_user.id)


@router.post("")
async def create_project(
    project_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    return await storage.create_project(current_user.id, project_data)


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    project = await storage.get_project(project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}")
async def update_project(
    project_id: str,
    project_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    project = await storage.update_project(project_id, current_user.id, project_data)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    deleted = await storage.delete_project(project_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted"}


@router.get("/{project_id}/tags")
async def get_project_tags(
    project_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    import re
    tags: set[str] = set()
    tag_pattern = re.compile(r"#([a-zA-Z0-9_-]+)")

    def extract(text: str | None) -> None:
        if text:
            for m in tag_pattern.finditer(text):
                tags.add(m.group(1))

    # Documents
    for doc in await storage.list_documents(project_id, current_user.id):
        extract(doc.get("content"))

    # Story Bible
    for entry in await storage.list_story_bible(project_id, current_user.id):
        extract(entry.get("content"))

    # Style Guide
    for entry in await storage.list_style_guide(project_id, current_user.id):
        extract(entry.get("content"))

    # Characters
    for char in await storage.list_characters(project_id, current_user.id):
        for field in ("appearance", "personality", "background", "goals",
                      "conflicts", "voice_description", "notes"):
            extract(char.get(field))

    return sorted(tags)
