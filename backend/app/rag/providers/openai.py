from typing import Optional, List, AsyncIterator
from openai import AsyncOpenAI
from .base import LLMProvider, LLMResponse, LLMMessage


class OpenAIProvider(LLMProvider):
    """OpenAI provider."""
    
    AVAILABLE_MODELS = [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-3.5-turbo",
    ]
    
    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        super().__init__(api_key, model)
        self.client = AsyncOpenAI(api_key=api_key)

    async def generate(
        self,
        messages: List[LLMMessage],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> LLMResponse:
        """Generate a response using OpenAI."""
        
        # Build messages array
        openai_messages = []
        if system_prompt:
            openai_messages.append({"role": "system", "content": system_prompt})
            
        for msg in messages:
            openai_messages.append({"role": msg.role, "content": msg.content})

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=openai_messages,
                temperature=temperature,
                max_tokens=max_tokens or 4096,
                **kwargs
            )
            
            content = response.choices[0].message.content or ""
            
            return LLMResponse(
                content=content,
                model=self.model,
                provider="openai",
                tokens_used=response.usage.total_tokens if response.usage else None,
                cost=0.0,  # Could calculate based on pricing
                finish_reason=response.choices[0].finish_reason
            )
        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}")
    
    async def generate_stream(
        self,
        messages: List[LLMMessage],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        """Generate a streaming response."""
        
        openai_messages = []
        if system_prompt:
            openai_messages.append({"role": "system", "content": system_prompt})
            
        for msg in messages:
            openai_messages.append({"role": msg.role, "content": msg.content})
        
        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=openai_messages,
                temperature=temperature,
                max_tokens=max_tokens or 4096,
                stream=True,
                **kwargs
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            raise Exception(f"OpenAI streaming error: {str(e)}")
    
    def supports_function_calling(self) -> bool:
        """OpenAI supports function calling."""
        return True
    
    def get_available_models(self) -> List[str]:
        """Get available OpenAI models."""
        return self.AVAILABLE_MODELS
