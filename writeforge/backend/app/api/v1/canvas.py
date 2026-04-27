from fastapi import APIRouter, Depends, HTTPException
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.services.storage.base import BaseStorage
from app.api.deps import get_storage_dep

router = APIRouter()


@router.get("/project/{project_id}/nodes")
async def list_nodes(
    project_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    return await storage.list_canvas_nodes(project_id, current_user.id)


@router.post("/project/{project_id}/nodes")
async def create_node(
    project_id: str,
    node_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    node_data["project_id"] = project_id
    return await storage.create_canvas_node(current_user.id, node_data)


@router.put("/nodes/{node_id}")
async def update_node(
    node_id: str,
    node_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    node = await storage.update_canvas_node(node_id, current_user.id, node_data)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.delete("/nodes/{node_id}")
async def delete_node(
    node_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    deleted = await storage.delete_canvas_node(node_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Node not found")
    return {"message": "Node deleted"}


@router.get("/project/{project_id}/edges")
async def list_edges(
    project_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    return await storage.list_canvas_edges(project_id, current_user.id)


@router.post("/project/{project_id}/edges")
async def create_edge(
    project_id: str,
    edge_data: dict,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    edge_data["project_id"] = project_id
    return await storage.create_canvas_edge(current_user.id, edge_data)


@router.delete("/edges/{edge_id}")
async def delete_edge(
    edge_id: str,
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    deleted = await storage.delete_canvas_edge(edge_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Edge not found")
    return {"message": "Edge deleted"}
