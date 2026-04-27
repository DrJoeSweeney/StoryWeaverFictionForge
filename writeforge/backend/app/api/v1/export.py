from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import io
import zipfile
import os
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.services.storage import get_storage

router = APIRouter()


@router.post("/obsidian/{project_id}")
async def export_obsidian(
    project_id: str,
    current_user: User = Depends(get_current_active_user),
):
    storage = get_storage()
    project = await storage.get_project(project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Zip up the project folder
    root = storage.root_path
    user_dir = os.path.join(root, "users", storage._sanitize(current_user.id))
    project_dir = os.path.join(user_dir, storage._sanitize(project_id))

    if not os.path.exists(project_dir):
        raise HTTPException(status_code=404, detail="Project folder not found")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for dirpath, _, files in os.walk(project_dir):
            for file in files:
                filepath = os.path.join(dirpath, file)
                arcname = os.path.relpath(filepath, user_dir)
                zf.write(filepath, arcname)

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename={storage._sanitize(project_id)}_vault.zip"
        },
    )
