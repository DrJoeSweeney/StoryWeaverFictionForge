from typing import AsyncIterator
import anthropic
from app.services.ai.base import AIProvider, Message, ModelInfo


class AnthropicProvider:
    def __init__(self, api_key: str):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
    
    async def complete(self, messages: list[Message], model: str = "claude-3-5-sonnet-20241022", temperature: float = 0.7, max_tokens: int | None = None, **kwargs) -> str:
        system_msg = None
        chat_messages = []
        for msg in messages:
            if msg.role == "system":
                system_msg = msg.content
            else:
                chat_messages.append({"role": msg.role, "content": msg.content})
        
        response = await self.client.messages.create(
            model=model,
            max_tokens=max_tokens or 4096,
            temperature=temperature,
            system=system_msg,
            messages=chat_messages,
        )
        return response.content[0].text
    
    async def stream(self, messages: list[Message], model: str = "claude-3-5-sonnet-20241022", temperature: float = 0.7, max_tokens: int | None = None, **kwargs) -> AsyncIterator[str]:
        system_msg = None
        chat_messages = []
        for msg in messages:
            if msg.role == "system":
                system_msg = msg.content
            else:
                chat_messages.append({"role": msg.role, "content": msg.content})
        
        async with self.client.messages.stream(
            model=model,
            max_tokens=max_tokens or 4096,
            temperature=temperature,
            system=system_msg,
            messages=chat_messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text
    
    def list_models(self) -> list[ModelInfo]:
        return [
            ModelInfo(id="claude-3-5-sonnet-20241022", name="Claude 3.5 Sonnet", provider="anthropic", max_tokens=8192),
            ModelInfo(id="claude-3-5-haiku-20241022", name="Claude 3.5 Haiku", provider="anthropic", max_tokens=8192),
            ModelInfo(id="claude-3-opus-20240229", name="Claude 3 Opus", provider="anthropic", max_tokens=4096),
        ]
