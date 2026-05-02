from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import AsyncIterator
from app.database import get_db
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.models.ai_provider import AIProviderConfig
from app.services.ai.base import Message
from app.services.ai.manager import ai_manager, decrypt_credentials
from app.services.ai.agentic_orchestrator import AgenticOrchestrator
from app.services.storage.base import BaseStorage
from app.api.deps import get_storage_dep

router = APIRouter()


class WritingRequest(BaseModel):
    messages: list[dict]
    provider: str | None = None
    model: str | None = None
    temperature: float = 0.7
    project_id: str | None = None
    include_style_guide: bool = False


class AgenticRequest(BaseModel):
    messages: list[dict]
    provider: str | None = None
    model: str | None = None
    temperature: float = 0.7
    project_id: str | None = None
    include_style_guide: bool = False
    action: str | None = None  # e.g. "continue", "rewrite", "shorten"
    prompt: str = ""  # Raw user prompt for classification
    reasoning_provider: str | None = None
    reasoning_model: str | None = None
    document_type: str | None = None
    field_name: str | None = None


async def get_user_provider(db: AsyncSession, user: User, provider: str | None = None):
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
        # Corrupted config (e.g., encryption key changed). Delete it and ask user to re-add.
        await db.delete(config)
        await db.commit()
        raise HTTPException(
            status_code=400,
            detail="Stored API key is corrupted (encryption key changed). Please re-add your API key in Settings."
        )
    
    return ai_manager.create_provider(config.provider, creds)


async def build_style_guide_context(storage: BaseStorage, project_id: str, user_id: str) -> str:
    entries = await storage.list_style_guide(project_id, user_id)
    if not entries:
        return ""
    
    parts = ["## Author's Style Reference\n"]
    for entry in entries:
        parts.append(f"### {entry.get('title', 'Entry')}\n{entry.get('content', '')}")
    
    return "\n\n".join(parts)


@router.post("/complete")
async def complete(
    req: WritingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    ai_provider = await get_user_provider(db, current_user, req.provider)
    
    messages = [Message(role=m["role"], content=m["content"]) for m in req.messages]
    
    # Inject style guide context if requested
    if req.include_style_guide and req.project_id and storage:
        sg_context = await build_style_guide_context(storage, req.project_id, current_user.id)
        if sg_context:
            # Prepend style guide to system message or create one
            if messages and messages[0].role == "system":
                messages[0] = Message(
                    role="system",
                    content=messages[0].content + "\n\n---\n\nFollow this author's style guide when writing:\n\n" + sg_context
                )
            else:
                messages.insert(0, Message(
                    role="system",
                    content="Follow this author's style guide when writing:\n\n" + sg_context
                ))
    
    try:
        response = await ai_provider.complete(
            messages=messages,
            model=req.model or "",
            temperature=req.temperature,
        )
        return {"content": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def stream(
    req: WritingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    ai_provider = await get_user_provider(db, current_user, req.provider)
    messages = [Message(role=m["role"], content=m["content"]) for m in req.messages]
    
    # Inject style guide context if requested
    if req.include_style_guide and req.project_id:
        sg_context = await build_style_guide_context(storage, req.project_id, current_user.id)
        if sg_context:
            if messages and messages[0].role == "system":
                messages[0] = Message(
                    role="system",
                    content=messages[0].content + "\n\n---\n\nFollow this author's style guide when writing:\n\n" + sg_context
                )
            else:
                messages.insert(0, Message(
                    role="system",
                    content="Follow this author's style guide when writing:\n\n" + sg_context
                ))
    
    async def generate() -> AsyncIterator[str]:
        try:
            async for chunk in ai_provider.stream(
                messages=messages,
                model=req.model or "",
                temperature=req.temperature,
            ):
                yield f"data: {chunk}\n\n"
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/agentic")
async def agentic(
    req: AgenticRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    storage: BaseStorage = Depends(get_storage_dep),
):
    """
    Agentic writing endpoint with tiered ReAct.
    Classifies the task, retrieves relevant context, and generates a response.
    """
    writing_provider = await get_user_provider(db, current_user, req.provider)

    # Use separate reasoning model if configured
    if req.reasoning_provider:
        reasoning_provider = await get_user_provider(db, current_user, req.reasoning_provider)
    else:
        reasoning_provider = writing_provider

    messages = [Message(role=m["role"], content=m["content"]) for m in req.messages]

    # Inject style guide if requested (legacy support)
    if req.include_style_guide and req.project_id and storage:
        sg_context = await build_style_guide_context(storage, req.project_id, current_user.id)
        if sg_context:
            if messages and messages[0].role == "system":
                messages[0] = Message(
                    role="system",
                    content=messages[0].content + "\n\n---\n\nFollow this author's style guide when writing:\n\n" + sg_context
                )
            else:
                messages.insert(0, Message(
                    role="system",
                    content="Follow this author's style guide when writing:\n\n" + sg_context
                ))

    orchestrator = AgenticOrchestrator(
        writing_provider=writing_provider,
        reasoning_provider=reasoning_provider,
    )

    try:
        result = await orchestrator.run(
            messages=messages,
            model=req.model or "",
            temperature=req.temperature,
            project_id=req.project_id,
            user_id=current_user.id,
            storage=storage,
            action=req.action,
            prompt_text=req.prompt,
            reasoning_model=req.reasoning_model or "",
            document_type=req.document_type,
            field_name=req.field_name,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
