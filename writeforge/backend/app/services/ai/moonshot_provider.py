from typing import AsyncIterator
import openai
from app.services.ai.base import AIProvider, Message, ModelInfo


class MoonshotProvider:
    def __init__(self, api_key: str):
        # Auto-detect endpoint from key prefix:
        # sk-kimi- keys are from platform.kimi.ai (Kimi Code API)
        # sk- keys are from platform.moonshot.cn (legacy Moonshot API)
        if api_key.startswith("sk-kimi-"):
            base_url = "https://api.kimi.com/coding/v1"
            # Kimi Code API requires an approved User-Agent
            default_headers = {"User-Agent": "KimiCLI/1.0"}
        else:
            base_url = "https://api.moonshot.ai/v1"
            default_headers = None
        self.client = openai.AsyncOpenAI(
            base_url=base_url,
            api_key=api_key,
            default_headers=default_headers,
        )
        self._is_kimi_code = api_key.startswith("sk-kimi-")
    
    async def complete(self, messages: list[Message], model: str = "", temperature: float = 0.7, max_tokens: int | None = None, **kwargs) -> str:
        chat_messages = [{"role": m.role, "content": m.content} for m in messages]
        # Kimi Code API only supports the 'kimi-for-coding' model ID
        if self._is_kimi_code:
            model = "kimi-for-coding"
        elif not model:
            model = "moonshot-v1-8k"
        response = await self.client.chat.completions.create(
            model=model,
            messages=chat_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=240.0,
        )
        msg = response.choices[0].message
        return msg.content or getattr(msg, "reasoning_content", "") or ""
    
    async def stream(self, messages: list[Message], model: str = "", temperature: float = 0.7, max_tokens: int | None = None, **kwargs) -> AsyncIterator[str]:
        chat_messages = [{"role": m.role, "content": m.content} for m in messages]
        # Kimi Code API only supports the 'kimi-for-coding' model ID
        if self._is_kimi_code:
            model = "kimi-for-coding"
        elif not model:
            model = "moonshot-v1-8k"
        response = await self.client.chat.completions.create(
            model=model,
            messages=chat_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            timeout=240.0,
        )
        async for chunk in response:
            if chunk.choices:
                delta = chunk.choices[0].delta
                text = delta.content or getattr(delta, "reasoning_content", None) or ""
                if text:
                    yield text
    
    def list_models(self) -> list[ModelInfo]:
        if self._is_kimi_code:
            # Kimi Code API only supports the 'kimi-for-coding' model
            return [
                ModelInfo(id="kimi-for-coding", name="Kimi for Coding", provider="moonshot"),
            ]
        return [
            ModelInfo(id="moonshot-v1-8k", name="Kimi K1 (8K)", provider="moonshot"),
            ModelInfo(id="moonshot-v1-32k", name="Kimi K1 (32K)", provider="moonshot"),
            ModelInfo(id="moonshot-v1-128k", name="Kimi K1 (128K)", provider="moonshot"),
        ]
