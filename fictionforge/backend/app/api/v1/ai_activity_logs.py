import csv
import io
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete
from app.database import get_db
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.models.ai_activity_log import AIActivityLog

router = APIRouter()


@router.get("")
async def list_ai_activity_logs(
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(AIActivityLog)
        .where(AIActivityLog.user_id == current_user.id)
        .order_by(desc(AIActivityLog.created_at))
        .limit(limit)
        .offset(offset)
    )
    logs = result.scalars().all()
    return [
        {
            "id": log.id,
            "project_id": log.project_id,
            "document_id": log.document_id,
            "request_type": log.request_type,
            "action": log.action,
            "skill_id": log.skill_id,
            "skill_name": log.skill_name,
            "prompt_text": log.prompt_text,
            "model": log.model,
            "provider": log.provider,
            "temperature": log.temperature,
            "tier": log.tier,
            "reasoning_log": log.reasoning_log,
            "consulted_docs": log.consulted_docs,
            "context_length": log.context_length,
            "request_messages": log.request_messages,
            "result_content": log.result_content,
            "result_tokens_input": log.result_tokens_input,
            "result_tokens_output": log.result_tokens_output,
            "latency_ms": log.latency_ms,
            "error": log.error,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


@router.get("/export/csv")
async def export_ai_activity_logs_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(AIActivityLog)
        .where(AIActivityLog.user_id == current_user.id)
        .order_by(desc(AIActivityLog.created_at))
    )
    logs = result.scalars().all()

    if not logs:
        raise HTTPException(status_code=404, detail="No logs to export")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Created At", "Request Type", "Action", "Agent Name", "Model", "Provider",
        "Temperature", "Tier", "Project ID", "Document ID", "Prompt Text",
        "Result Content", "Context Length", "Latency (ms)", "Error"
    ])

    for log in logs:
        writer.writerow([
            log.id,
            log.created_at.isoformat() if log.created_at else "",
            log.request_type,
            log.action or "",
            log.skill_name or "",
            log.model or "",
            log.provider or "",
            log.temperature or "",
            log.tier or "",
            log.project_id or "",
            log.document_id or "",
            (log.prompt_text or "").replace("\n", " ")[:1000],
            (log.result_content or "").replace("\n", " ")[:2000],
            log.context_length or "",
            log.latency_ms or "",
            (log.error or "").replace("\n", " ")[:500],
        ])

    output.seek(0)
    filename = f"ai_activity_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.delete("")
async def clear_ai_activity_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        delete(AIActivityLog).where(AIActivityLog.user_id == current_user.id)
    )
    await db.commit()
    return {"message": "Logs cleared", "deleted": result.rowcount}
