import json
import time
from datetime import datetime
from app.database import AsyncSessionLocal
from app.models.ai_activity_log import AIActivityLog


async def log_ai_activity(
    user_id: str,
    project_id: str | None,
    document_id: str | None,
    request_type: str,
    action: str | None = None,
    skill_id: str | None = None,
    skill_name: str | None = None,
    prompt_text: str | None = None,
    model: str | None = None,
    provider: str | None = None,
    temperature: float | None = None,
    tier: str | None = None,
    reasoning_log: list | None = None,
    consulted_docs: list | None = None,
    context_length: int | None = None,
    request_messages: list | None = None,
    result_content: str | None = None,
    result_tokens_input: int | None = None,
    result_tokens_output: int | None = None,
    latency_ms: int | None = None,
    error: str | None = None,
):
    """
    Fire-and-forget AI activity logger.
    Creates a new session internally so it doesn't interfere with the caller's transaction.
    """
    try:
        async with AsyncSessionLocal() as session:
            log = AIActivityLog(
                user_id=user_id,
                project_id=project_id,
                document_id=document_id,
                request_type=request_type,
                action=action,
                skill_id=skill_id,
                skill_name=skill_name,
                prompt_text=prompt_text,
                model=model,
                provider=provider,
                temperature=temperature,
                tier=tier,
                reasoning_log=json.dumps(reasoning_log) if reasoning_log is not None else None,
                consulted_docs=json.dumps(consulted_docs) if consulted_docs is not None else None,
                context_length=context_length,
                request_messages=json.dumps(request_messages) if request_messages is not None else None,
                result_content=result_content,
                result_tokens_input=result_tokens_input,
                result_tokens_output=result_tokens_output,
                latency_ms=latency_ms,
                error=error,
            )
            session.add(log)
            await session.commit()
    except Exception:
        # Logging should never break the main flow
        pass
