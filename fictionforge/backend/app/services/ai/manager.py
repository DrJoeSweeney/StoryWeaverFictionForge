import json
import time
import requests
from cryptography.fernet import Fernet
from app.config import get_settings
from app.services.ai.base import AIProvider, ModelInfo
from app.services.ai.anthropic_provider import AnthropicProvider
from app.services.ai.openrouter_provider import OpenRouterProvider
from app.services.ai.google_provider import GoogleProvider
from app.services.ai.moonshot_provider import MoonshotProvider

settings = get_settings()

# Use a default key for development if none provided
_fernet = None

def get_fernet():
    global _fernet
    if _fernet is None:
        key = settings.encryption_key
        if not key:
            # Generate a temporary key for dev (not secure for production)
            key = Fernet.generate_key().decode()
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet


def encrypt_credentials(creds: dict) -> str:
    f = get_fernet()
    return f.encrypt(json.dumps(creds).encode()).decode()


def decrypt_credentials(encrypted: str) -> dict:
    f = get_fernet()
    return json.loads(f.decrypt(encrypted.encode()).decode())


class AIManager:
    def __init__(self):
        self._providers: dict[str, type] = {
            "anthropic": AnthropicProvider,
            "openrouter": OpenRouterProvider,
            "google": GoogleProvider,
            "moonshot": MoonshotProvider,
        }
        self._openrouter_cache: list[dict] | None = None
        self._openrouter_cache_time: float = 0
        self._openrouter_cache_ttl: int = 300  # 5 minutes
    
    def create_provider(self, provider_name: str, credentials: dict) -> AIProvider:
        provider_class = self._providers.get(provider_name)
        if not provider_class:
            raise ValueError(f"Unknown provider: {provider_name}")
        
        if provider_name == "google":
            return provider_class(credentials.get("api_key"))
        elif provider_name == "anthropic":
            return provider_class(credentials.get("api_key"))
        elif provider_name == "openrouter":
            return provider_class(credentials.get("api_key"))
        elif provider_name == "moonshot":
            return provider_class(credentials.get("api_key"))
        
        raise ValueError(f"Provider {provider_name} not fully implemented")
    
    def list_all_models(self) -> list[ModelInfo]:
        models = []
        for provider_name, provider_class in self._providers.items():
            # Create dummy instance just to list models
            if provider_name == "anthropic":
                instance = provider_class("")
            elif provider_name == "openrouter":
                instance = provider_class("")
            elif provider_name == "google":
                instance = provider_class("")
            elif provider_name == "moonshot":
                instance = provider_class("")
            else:
                continue
            models.extend(instance.list_models())
        return models

    def fetch_openrouter_models(self) -> list[dict]:
        now = time.time()
        if self._openrouter_cache and (now - self._openrouter_cache_time) < self._openrouter_cache_ttl:
            return self._openrouter_cache
        try:
            res = requests.get("https://openrouter.ai/api/v1/models", timeout=10)
            res.raise_for_status()
            data = res.json()
            models = []
            for m in data.get("data", []):
                models.append({
                    "id": m.get("id"),
                    "name": m.get("name") or m.get("id"),
                    "provider": "openrouter",
                    "context_length": m.get("context_length"),
                    "pricing": m.get("pricing"),
                })
            self._openrouter_cache = models
            self._openrouter_cache_time = now
            return models
        except Exception:
            # Fallback to hardcoded openrouter models
            instance = OpenRouterProvider("")
            return [{"id": mi.id, "name": mi.name, "provider": "openrouter"} for mi in instance.list_models()]


ai_manager = AIManager()
