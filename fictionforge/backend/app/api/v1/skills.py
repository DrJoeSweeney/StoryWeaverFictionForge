from fastapi import APIRouter, Depends, HTTPException
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.services.storage import get_storage

router = APIRouter()


@router.get("")
async def list_skills(
    current_user: User = Depends(get_current_active_user),
):
    storage = get_storage()
    return await storage.list_skills(current_user.id)


@router.post("")
async def create_skill(
    skill_data: dict,
    current_user: User = Depends(get_current_active_user),
):
    storage = get_storage()
    return await storage.create_skill(current_user.id, skill_data)


@router.get("/{skill_id}")
async def get_skill(
    skill_id: str,
    current_user: User = Depends(get_current_active_user),
):
    storage = get_storage()
    skill = await storage.get_skill(skill_id, current_user.id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.put("/{skill_id}")
async def update_skill(
    skill_id: str,
    skill_data: dict,
    current_user: User = Depends(get_current_active_user),
):
    storage = get_storage()
    skill = await storage.update_skill(skill_id, current_user.id, skill_data)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.delete("/{skill_id}")
async def delete_skill(
    skill_id: str,
    current_user: User = Depends(get_current_active_user),
):
    storage = get_storage()
    deleted = await storage.delete_skill(skill_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Skill not found")
    return {"message": "Skill deleted"}


@router.post("/{skill_id}/apply")
async def apply_skill(
    skill_id: str,
    apply_data: dict,
    current_user: User = Depends(get_current_active_user),
):
    storage = get_storage()
    skill = await storage.get_skill(skill_id, current_user.id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    import json
    from jinja2 import Template

    variables = json.loads(skill.get("variables", "{}")) if skill.get("variables") else {}
    context = apply_data.get("context", {})
    merged = {**{k: "" for k in variables.keys()}, **context}
    template = Template(skill["prompt_template"])
    rendered = template.render(**merged)

    return {
        "skill": skill,
        "rendered_prompt": rendered,
        "variables": merged,
    }
