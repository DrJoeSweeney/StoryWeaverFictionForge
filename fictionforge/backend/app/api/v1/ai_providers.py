from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.database import get_db
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.models.ai_provider import AIProviderConfig
from app.services.ai.manager import ai_manager, encrypt_credentials, decrypt_credentials
from app.services.ai.base import Message

router = APIRouter()


@router.get("/models")
async def list_models():
    return ai_manager.list_all_models()


@router.get("/openrouter-models")
async def list_openrouter_models():
    return ai_manager.fetch_openrouter_models()


@router.post("/openrouter-models/refresh")
async def refresh_openrouter_models(
    current_user: User = Depends(get_current_active_user)
):
    """Force refresh OpenRouter model list from upstream API."""
    models = ai_manager.fetch_openrouter_models(force_refresh=True)
    return {"count": len(models), "models": models}


@router.get("/active-models")
async def list_active_models(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(AIProviderConfig).where(
            AIProviderConfig.user_id == current_user.id,
            AIProviderConfig.is_active == True
        )
    )
    configs = result.scalars().all()
    
    if not configs:
        return []
    
    all_models = []
    active_providers = {c.provider for c in configs}
    
    for provider_name in active_providers:
        if provider_name == "openrouter":
            models = ai_manager.fetch_openrouter_models()
            all_models.extend(models)
        else:
            config = next((c for c in configs if c.provider == provider_name), None)
            provider_class = ai_manager._providers.get(provider_name)
            if provider_class and config:
                try:
                    creds = decrypt_credentials(config.credentials)
                    instance = provider_class(creds.get("api_key", ""))
                except Exception:
                    instance = provider_class("")
                models = instance.list_models()
                all_models.extend([
                    {
                        "id": m.id,
                        "name": m.name,
                        "provider": m.provider,
                        "capabilities": [c.value for c in m.capabilities],
                    }
                    for m in models
                ])
    
    return all_models


@router.get("/configs")
async def list_configs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(AIProviderConfig).where(AIProviderConfig.user_id == current_user.id)
    )
    configs = result.scalars().all()
    # Don't return encrypted credentials
    return [
        {
            "id": c.id,
            "provider": c.provider,
            "config_type": c.config_type,
            "is_active": c.is_active,
            "created_at": c.created_at,
        }
        for c in configs
    ]


@router.post("/configs")
async def create_config(
    provider: str,
    api_key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    encrypted = encrypt_credentials({"api_key": api_key.strip()})
    config = AIProviderConfig(
        user_id=current_user.id,
        provider=provider,
        config_type="api_key",
        credentials=encrypted,
        is_active=True,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return {
        "id": config.id,
        "provider": config.provider,
        "config_type": config.config_type,
        "is_active": config.is_active,
    }


@router.delete("/configs/{config_id}")
async def delete_config(
    config_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(AIProviderConfig).where(
            AIProviderConfig.id == config_id,
            AIProviderConfig.user_id == current_user.id
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    
    await db.delete(config)
    await db.commit()
    return {"message": "Config deleted"}


@router.post("/test/{provider}")
async def test_provider(
    provider: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from cryptography.fernet import InvalidToken
    
    result = await db.execute(
        select(AIProviderConfig).where(
            AIProviderConfig.user_id == current_user.id,
            AIProviderConfig.provider == provider,
            AIProviderConfig.is_active == True
        )
    )
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(status_code=400, detail=f"No config found for {provider}")
    
    try:
        creds = decrypt_credentials(config.credentials)
    except InvalidToken:
        await db.delete(config)
        await db.commit()
        raise HTTPException(status_code=400, detail="Stored API key is corrupted. Please re-add it.")
    
    try:
        ai_provider = ai_manager.create_provider(config.provider, creds)
        # Minimal test call — just verify the key works
        models = ai_provider.list_models()
        last_error = None
        for model_info in models:
            try:
                await ai_provider.complete(
                    messages=[Message(role="user", content="Hi")],
                    model=model_info.id,
                    temperature=0.7,
                    max_tokens=100
                )
                return {"success": True, "provider": provider, "message": "Connection successful"}
            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                # If model not found, try next model in list
                if "404" in str(e) or "not found" in err_str or "no endpoints" in err_str:
                    continue
                raise
        # All models failed
        return {"success": False, "provider": provider, "message": str(last_error)}
    except Exception as e:
        return {"success": False, "provider": provider, "message": str(e)}
