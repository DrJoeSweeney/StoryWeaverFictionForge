import asyncio
import time
from fastapi import APIRouter, Depends, HTTPException
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.services.storage import get_storage
from app.services.ai.agentic_orchestrator import AgenticOrchestrator
from app.services.ai.base import Message
from app.services.ai.manager import ai_manager, decrypt_credentials
from app.services.ai.activity_logger import log_ai_activity
from app.models.ai_provider import AIProviderConfig
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db

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
        raise HTTPException(status_code=404, detail="Agent not found")
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
        raise HTTPException(status_code=404, detail="Agent not found")
    return skill


@router.delete("/{skill_id}")
async def delete_skill(
    skill_id: str,
    current_user: User = Depends(get_current_active_user),
):
    storage = get_storage()
    deleted = await storage.delete_skill(skill_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"message": "Agent deleted"}


@router.post("/{skill_id}/apply")
async def apply_skill(
    skill_id: str,
    apply_data: dict,
    current_user: User = Depends(get_current_active_user),
):
    storage = get_storage()
    skill = await storage.get_skill(skill_id, current_user.id)
    if not skill:
        raise HTTPException(status_code=404, detail="Agent not found")

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


async def _fetch_skill_context(storage, skill: dict, project_id: str | None, user_id: str, current_doc_id: str | None = None) -> str:
    """Fetch project context based on skill's context_sources and specific_documents."""
    import json
    from app.services.ai.context_retriever import ContextRetriever

    if not project_id:
        return ""

    sources = []
    try:
        sources = json.loads(skill.get("context_sources", "[]")) if skill.get("context_sources") else []
    except Exception:
        sources = []

    specific_docs = []
    try:
        specific_docs = json.loads(skill.get("specific_documents", "[]")) if skill.get("specific_documents") else []
    except Exception:
        specific_docs = []

    retriever = ContextRetriever(storage)
    result = await retriever.fetch_by_plan(project_id, user_id, sources)

    # Fetch specific documents by title
    if specific_docs:
        docs = await storage.list_documents(project_id, user_id)
        for doc in docs:
            if doc.get("title", "") in specific_docs:
                full_doc = await storage.get_document(doc.get("id"), user_id)
                if full_doc and full_doc not in result.documents:
                    result.documents.append(full_doc)

    # If current doc is specified and not already included
    if current_doc_id:
        current_doc = await storage.get_document(current_doc_id, user_id)
        if current_doc and current_doc not in result.documents:
            result.documents.append(current_doc)

    return result.to_prompt_text(max_tokens=12000)


async def _get_user_provider(db: AsyncSession, user: User, provider: str | None = None):
    from cryptography.fernet import InvalidToken
    query = select(AIProviderConfig).where(
        AIProviderConfig.user_id == user.id,
        AIProviderConfig.is_active == True
    )
    if provider:
        query = query.where(AIProviderConfig.provider == provider)
    result = await db.execute(query)
    config = result.scalars().first()
    if not config:
        raise HTTPException(status_code=400, detail="No AI provider configured. Please add an API key in settings.")
    try:
        creds = decrypt_credentials(config.credentials)
    except InvalidToken:
        await db.delete(config)
        await db.commit()
        raise HTTPException(status_code=400, detail="Stored API key is corrupted. Please re-add your API key in Settings.")
    return ai_manager.create_provider(config.provider, creds)


@router.post("/{skill_id}/execute")
async def execute_skill(
    skill_id: str,
    execute_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Execute a skill with full agentic context retrieval.
    If the skill is_agentic, it fetches specified context sources,
    builds messages, and runs through the agentic orchestrator.
    """
    storage = get_storage()
    skill = await storage.get_skill(skill_id, current_user.id)
    if not skill:
        raise HTTPException(status_code=404, detail="Agent not found")

    import json
    from jinja2 import Template

    project_id = execute_data.get("project_id")
    document_id = execute_data.get("document_id")
    messages_raw = execute_data.get("messages", [])
    context = execute_data.get("context", {})
    provider = execute_data.get("provider")
    model = execute_data.get("model") or skill.get("model", "")
    temperature = execute_data.get("temperature")
    if temperature is None:
        temperature = skill.get("temperature", 0.8)
    reasoning_provider = execute_data.get("reasoning_provider")
    reasoning_model = execute_data.get("reasoning_model", "")

    # Render template with context variables
    variables = json.loads(skill.get("variables", "{}")) if skill.get("variables") else {}
    merged = {**{k: "" for k in variables.keys()}, **context}
    template = Template(skill["prompt_template"])
    rendered = template.render(**merged)

    # Build messages
    messages = [Message(role=m["role"], content=m["content"]) for m in messages_raw]

    # If agentic, fetch context and run through orchestrator
    if skill.get("is_agentic"):
        writing_provider = await _get_user_provider(db, current_user, provider)
        if reasoning_provider:
            rp = await _get_user_provider(db, current_user, reasoning_provider)
        else:
            rp = writing_provider

        extra_context = ""
        if project_id:
            extra_context = await _fetch_skill_context(
                storage, skill, project_id, current_user.id, document_id
            )

        # Inject skill system prompt + context into messages
        system_prompt = skill.get("system_prompt", "You are a creative writing assistant.")
        if extra_context:
            system_prompt += f"\n\n---\n\nRelevant project context:\n{extra_context}"

        # Find or prepend system message
        modified_messages = list(messages)
        system_idx = next((i for i, m in enumerate(modified_messages) if m.role == "system"), -1)
        if system_idx >= 0:
            modified_messages[system_idx] = Message(
                role="system",
                content=modified_messages[system_idx].content + "\n\n---\n\n" + system_prompt,
            )
        else:
            modified_messages.insert(0, Message(role="system", content=system_prompt))

        # Inject rendered user prompt
        modified_messages.append(Message(role="user", content=rendered))

        orchestrator = AgenticOrchestrator(
            writing_provider=writing_provider,
            reasoning_provider=rp,
            reasoning_model=reasoning_model,
        )

        # Build unified template context for the agentic pipeline
        template_context = {
            "text": rendered,
            "fullContext": context.get("fullContext", ""),
            "document_type": context.get("documentType") or context.get("document_type", ""),
            "field_name": context.get("fieldName") or context.get("field_name", ""),
            "document_title": context.get("document_title", ""),
            "module": context.get("module", ""),
            "title": context.get("title", ""),
            "description": context.get("description", ""),
        }

        start_time = time.time()
        try:
            result = await orchestrator.run(
                messages=modified_messages,
                model=model,
                temperature=temperature,
                project_id=project_id,
                user_id=current_user.id,
                storage=storage,
                action=skill.get("action") or None,
                prompt_text=rendered,
                reasoning_model=reasoning_model,
                template_context=template_context,
            )
            latency_ms = int((time.time() - start_time) * 1000)
            result["skill"] = skill
            result["rendered_prompt"] = rendered
            asyncio.create_task(log_ai_activity(
                user_id=current_user.id,
                project_id=project_id,
                document_id=document_id,
                request_type="agent",
                action=skill.get("action"),
                skill_id=skill_id,
                skill_name=skill.get("name"),
                prompt_text=rendered,
                model=model,
                provider=provider,
                temperature=temperature,
                tier=result.get("tier"),
                reasoning_log=result.get("reasoning_log"),
                consulted_docs=result.get("consulted_docs"),
                context_length=len(extra_context) if extra_context else 0,
                request_messages=messages_raw,
                result_content=result.get("content"),
                latency_ms=latency_ms,
            ))
            return result
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            asyncio.create_task(log_ai_activity(
                user_id=current_user.id,
                project_id=project_id,
                document_id=document_id,
                request_type="agent",
                action=skill.get("action"),
                skill_id=skill_id,
                skill_name=skill.get("name"),
                prompt_text=rendered,
                model=model,
                provider=provider,
                temperature=temperature,
                context_length=len(extra_context) if extra_context else 0,
                request_messages=messages_raw,
                latency_ms=latency_ms,
                error=str(e),
            ))
            raise HTTPException(status_code=500, detail=str(e))

    # Non-agentic: just return the rendered prompt (client calls writing endpoint)
    return {
        "skill": skill,
        "rendered_prompt": rendered,
        "variables": merged,
        "content": rendered,
        "reasoning_log": [],
        "tier": "agent",
        "consulted_docs": [],
    }
