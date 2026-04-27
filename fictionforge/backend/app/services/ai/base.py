from typing import Protocol, AsyncIterator
from enum import Enum
from pydantic import BaseModel


class Message(BaseModel):
    role: str  # system, user, assistant
    content: str


class ModelCapability(str, Enum):
    REASONING = "reasoning"
    WRITING = "writing"
    CODING = "coding"
    VISION = "vision"
    LONG_CONTEXT = "long_context"
    WEB_SEARCH = "web_search"
    AUDIO = "audio"
    IMAGE = "image"


class ModelInfo(BaseModel):
    id: str
    name: str
    provider: str
    capabilities: list[ModelCapability] = []
    cost_tier: str = "mid"  # free | cheap | mid | expensive
    max_tokens: int | None = None  # Max output tokens
    context_window: int = 4096  # Total context window size
    supports_streaming: bool = True


class AIProvider(Protocol):
    async def complete(self, messages: list[Message], model: str, temperature: float = 0.7, max_tokens: int | None = None, **kwargs) -> str:
        ...
    
    async def stream(self, messages: list[Message], model: str, temperature: float = 0.7, max_tokens: int | None = None, **kwargs) -> AsyncIterator[str]:
        ...
    
    def list_models(self) -> list[ModelInfo]:
        ...
