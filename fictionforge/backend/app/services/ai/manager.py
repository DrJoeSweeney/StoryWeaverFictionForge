import json
import time
import requests
from cryptography.fernet import Fernet
from app.config import get_settings
from app.services.ai.base import AIProvider, ModelInfo, ModelCapability
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


_OR_PROVIDER_NAMES: dict[str, str] = {
    "anthropic": "Anthropic",
    "openai": "OpenAI",
    "google": "Google",
    "meta-llama": "Meta",
    "mistralai": "Mistral AI",
    "x-ai": "xAI",
    "deepseek": "DeepSeek",
    "qwen": "Alibaba",
    "moonshotai": "Moonshot AI",
    "nvidia": "NVIDIA",
    "perplexity": "Perplexity",
    "nousresearch": "Nous Research",
    "microsoft": "Microsoft",
    "cohere": "Cohere",
    "01-ai": "01.AI",
    "huggingface": "Hugging Face",
    "recursal": "Recursal",
    "rwkv": "RWKV",
    "neversleep": "NeverSleep",
    "infermatic": "Infermatic",
    "openrouter": "OpenRouter",
    "liquid": "Liquid AI",
    "thedrone": "The Drone",
    "pygmalionai": "PygmalionAI",
    "fireworks": "Fireworks",
    "together": "Together AI",
    "hyperbolic": "Hyperbolic",
    "liuhaotian": "Liuhaotian",
    "raifile": "Raifile",
    " Shuttleai": "ShuttleAI",
    "aion-labs": "Aion Labs",
    "bigcode": "BigCode",
    "allenai": "Allen AI",
    "rekaai": "Reka AI",
    "lizpreciatior": "Lizpreciatior",
    "intelligent": "Intelligent",
    "kimi": "Moonshot AI",
}


def _extract_openrouter_provider(model_id: str) -> str:
    """Extract the real provider name from an OpenRouter model ID like 'anthropic/claude-3.7-sonnet'."""
    org = model_id.split("/")[0] if "/" in model_id else ""
    return _OR_PROVIDER_NAMES.get(org, org.capitalize() if org else "Unknown")


def _infer_openrouter_capabilities(model_id: str, name: str, description: str | None, context_length: int | None) -> list[ModelCapability]:
    """Infer model capabilities from OpenRouter metadata."""
    caps: set[ModelCapability] = set()
    mid = model_id.lower()
    nm = (name or "").lower()
    desc = (description or "").lower()
    combined = f"{mid} {nm} {desc}"

    # Reasoning models
    reasoning_keywords = [
        "o1", "o3", "o4", "claude", "sonnet", "gemini-2.5", "deepseek-r1",
        "qwq", "o1-preview", "o1-mini", "deepseek", "qwen", "command-r-plus",
        "llama-4", "mistral-large", "mixtral"
    ]
    if any(k in mid for k in reasoning_keywords):
        caps.add(ModelCapability.REASONING)

    # Vision models
    vision_keywords = ["vision", "gpt-4o", "claude-3", "gemini-1.5", "gemini-2", "llava", "qwen-vl"]
    if any(k in mid for k in vision_keywords):
        caps.add(ModelCapability.VISION)

    # Web search / research
    web_keywords = ["search", "perplexity", "sonar"]
    if any(k in combined for k in web_keywords):
        caps.add(ModelCapability.WEB_SEARCH)

    # Audio generation
    audio_keywords = ["audio", "tts", "whisper", "speech"]
    if any(k in combined for k in audio_keywords):
        caps.add(ModelCapability.AUDIO)

    # Image generation
    image_keywords = ["dall-e", "flux", "midjourney", "sdxl", "stable-diffusion", "image", "imagen"]
    if any(k in combined for k in image_keywords):
        caps.add(ModelCapability.IMAGE)

    # Coding
    coding_keywords = ["code", "coder", "qwen-coder", "deepseek-coder"]
    if any(k in combined for k in coding_keywords):
        caps.add(ModelCapability.CODING)

    # Long context (128k+)
    if context_length and context_length >= 128000:
        caps.add(ModelCapability.LONG_CONTEXT)

    # Default: if nothing else, assume writing
    if not caps or caps == {ModelCapability.LONG_CONTEXT}:
        caps.add(ModelCapability.WRITING)
    else:
        # Most models can also write
        caps.add(ModelCapability.WRITING)

    return list(caps)


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

    def fetch_openrouter_models(self, force_refresh: bool = False) -> list[dict]:
        now = time.time()
        if not force_refresh and self._openrouter_cache and (now - self._openrouter_cache_time) < self._openrouter_cache_ttl:
            return self._openrouter_cache
        try:
            res = requests.get("https://openrouter.ai/api/v1/models", timeout=10)
            res.raise_for_status()
            data = res.json()
            models = []
            for m in data.get("data", []):
                model_id = m.get("id", "")
                name = m.get("name") or model_id
                description = m.get("description", "")
                context_length = m.get("context_length")
                caps = _infer_openrouter_capabilities(model_id, name, description, context_length)
                real_provider = _extract_openrouter_provider(model_id)
                models.append({
                    "id": model_id,
                    "name": name,
                    "provider": "openrouter",
                    "real_provider": real_provider,
                    "context_length": context_length,
                    "pricing": m.get("pricing"),
                    "capabilities": [c.value for c in caps],
                })
            self._openrouter_cache = models
            self._openrouter_cache_time = now
            return models
        except Exception:
            # Fallback to hardcoded openrouter models
            instance = OpenRouterProvider("")
            return [
                {
                    "id": mi.id,
                    "name": mi.name,
                    "provider": "openrouter",
                    "capabilities": [c.value for c in mi.capabilities],
                }
                for mi in instance.list_models()
            ]


ai_manager = AIManager()
