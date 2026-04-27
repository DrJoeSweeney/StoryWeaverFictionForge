from typing import AsyncIterator
import openai
from app.services.ai.base import AIProvider, Message, ModelInfo


class OpenRouterProvider:
    def __init__(self, api_key: str):
        self.client = openai.AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
            default_headers={
                "HTTP-Referer": "https://writeforge.local",
                "X-Title": "WriteForge",
            },
        )
    
    async def complete(self, messages: list[Message], model: str = "openai/gpt-4o-mini", temperature: float = 0.7, max_tokens: int | None = None, **kwargs) -> str:
        chat_messages = [{"role": m.role, "content": m.content} for m in messages]
        response = await self.client.chat.completions.create(
            model=model,
            messages=chat_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=240.0,
        )
        return response.choices[0].message.content or ""
    
    async def stream(self, messages: list[Message], model: str = "openai/gpt-4o-mini", temperature: float = 0.7, max_tokens: int | None = None, **kwargs) -> AsyncIterator[str]:
        chat_messages = [{"role": m.role, "content": m.content} for m in messages]
        response = await self.client.chat.completions.create(
            model=model,
            messages=chat_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            timeout=240.0,
        )
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    
    def list_models(self) -> list[ModelInfo]:
        return [
            ModelInfo(id="openai/gpt-4o-mini", name="GPT-4o Mini (OR)", provider="openrouter"),
            ModelInfo(id="openai/gpt-4o", name="GPT-4o (OR)", provider="openrouter"),
            ModelInfo(id="anthropic/claude-3.7-sonnet", name="Claude 3.7 Sonnet (OR)", provider="openrouter"),
            ModelInfo(id="anthropic/claude-3.5-haiku", name="Claude 3.5 Haiku (OR)", provider="openrouter"),
            ModelInfo(id="google/gemini-2.5-flash", name="Gemini 2.5 Flash (OR)", provider="openrouter"),
            ModelInfo(id="meta-llama/llama-3.3-70b-instruct", name="Llama 3.3 70B (OR)", provider="openrouter"),
        ]
