from typing import AsyncIterator
import google.generativeai as genai
from app.services.ai.base import AIProvider, Message, ModelInfo, ModelCapability


class GoogleProvider:
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.client = genai
    
    async def complete(self, messages: list[Message], model: str = "gemini-1.5-flash", temperature: float = 0.7, max_tokens: int | None = None, **kwargs) -> str:
        system_msg = ""
        chat_messages = []
        for msg in messages:
            if msg.role == "system":
                system_msg = msg.content
            else:
                chat_messages.append({"role": "user" if msg.role == "user" else "model", "parts": [msg.content]})
        
        gemini_model = self.client.GenerativeModel(model, system_instruction=system_msg or None)
        response = await gemini_model.generate_content_async(
            [m["parts"][0] for m in chat_messages],
            generation_config=genai.types.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )
        return response.text
    
    async def stream(self, messages: list[Message], model: str = "gemini-1.5-flash", temperature: float = 0.7, max_tokens: int | None = None, **kwargs) -> AsyncIterator[str]:
        system_msg = ""
        chat_messages = []
        for msg in messages:
            if msg.role == "system":
                system_msg = msg.content
            else:
                chat_messages.append({"role": "user" if msg.role == "user" else "model", "parts": [msg.content]})
        
        gemini_model = self.client.GenerativeModel(model, system_instruction=system_msg or None)
        response = await gemini_model.generate_content_async(
            [m["parts"][0] for m in chat_messages],
            generation_config=genai.types.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
            stream=True,
        )
        async for chunk in response:
            if chunk.text:
                yield chunk.text
    
    def list_models(self) -> list[ModelInfo]:
        return [
            ModelInfo(id="gemini-1.5-flash", name="Gemini 1.5 Flash", provider="google",
                      capabilities=[ModelCapability.WRITING, ModelCapability.VISION], context_window=1000000),
            ModelInfo(id="gemini-1.5-pro", name="Gemini 1.5 Pro", provider="google",
                      capabilities=[ModelCapability.REASONING, ModelCapability.WRITING, ModelCapability.VISION, ModelCapability.LONG_CONTEXT], context_window=2000000),
            ModelInfo(id="gemini-2.0-flash-exp", name="Gemini 2.0 Flash", provider="google",
                      capabilities=[ModelCapability.REASONING, ModelCapability.WRITING, ModelCapability.VISION], context_window=1000000),
        ]
