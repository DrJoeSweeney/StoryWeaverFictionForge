from fastapi import APIRouter, Depends, HTTPException
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.services.storage.base import BaseStorage
from app.api.deps import get_storage_dep

router = APIRouter()


@router.post("/project/{project_id}/rebuild")
async def rebuild_embeddings(
    project_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    """(Re)build the embedding index for a project."""
    vs = getattr(storage, "vector_store", None)
    if not vs:
        raise HTTPException(status_code=501, detail="Vector store not available")

    try:
        stats = await vs.build_index(project_id, current_user.id, storage)
        return {"message": "Embedding index rebuilt", "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to build index: {str(e)}")


@router.post("/project/{project_id}/search")
async def search_embeddings(
    project_id: str,
    data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    """Semantic search over project embeddings."""
    vs = getattr(storage, "vector_store", None)
    if not vs:
        raise HTTPException(status_code=501, detail="Vector store not available")

    query = data.get("query", "")
    top_k = data.get("top_k", 10)
    filters = data.get("filters")

    if not query:
        raise HTTPException(status_code=400, detail="query is required")

    try:
        results = await vs.search(project_id, current_user.id, query, top_k=top_k, filters=filters)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
