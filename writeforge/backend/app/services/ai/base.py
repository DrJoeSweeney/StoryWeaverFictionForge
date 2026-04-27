from typing import Protocol, AsyncIterator
from pydantic import BaseModel


class Message(BaseModel):
    role: str  # system, user, assistant
    content: str


class ModelInfo(BaseModel):
    id: str
    name: str
    provider: str
    max_tokens: int | None = None
    supports_streaming: bool = True


class AIProvider(Protocol):
    async def complete(self, messages: list[Message], model: str, temperature: float = 0.7, max_tokens: int | None = None, **kwargs) -> str:
        ...
    
    async def stream(self, messages: list[Message], model: str, temperature: float = 0.7, max_tokens: int | None = None, **kwargs) -> AsyncIterator[str]:
        ...
    
    def list_models(self) -> list[ModelInfo]:
        ...
