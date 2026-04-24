from typing import Optional, List, AsyncIterator
from groq import Groq
from .base import LLMProvider, LLMResponse, LLMMessage


class GroqProvider(LLMProvider):
    """Groq provider (LLaMA, Mixtral)."""
    
    AVAILABLE_MODELS = [
        "llama-3.3-70b-versatile",
        "llama-3.1-70b-versatile",
        "llama-3.1-8b-instant",
        "llama3-70b-8192",
        "llama3-8b-8192",
    ]
    
    def __init__(self, api_key: str, model: str = "llama-3.3-70b-versatile"):
        super().__init__(api_key, model)
        self.client = Groq(api_key=api_key)
    
    async def generate(
        self,
        messages: List[LLMMessage],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> LLMResponse:
        """Generate a response using Groq."""
        # Convert messages to Groq format
        groq_messages = []
        
        if system_prompt:
            groq_messages.append({"role": "system", "content": system_prompt})
        
        for msg in messages:
            if msg.role != "system":
                groq_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=groq_messages,
                temperature=temperature,
                max_tokens=max_tokens or 2048,
                **kwargs
            )
            
            content = response.choices[0].message.content or ""
            usage = response.usage
            
            return LLMResponse(
                content=content,
                model=self.model,
                provider="groq",
                tokens_used=(usage.prompt_tokens + usage.completion_tokens) if usage else 0,
                cost=0.0,  # Groq has free tier
                finish_reason=response.choices[0].finish_reason
            )
        except Exception as e:
            raise Exception(f"Groq API error: {str(e)}")
    
    async def generate_stream(
        self,
        messages: List[LLMMessage],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        """Generate a streaming response."""
        groq_messages = []
        
        if system_prompt:
            groq_messages.append({"role": "system", "content": system_prompt})
        
        for msg in messages:
            if msg.role != "system":
                groq_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })
        
        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=groq_messages,
                temperature=temperature,
                max_tokens=max_tokens or 2048,
                stream=True,
                **kwargs
            )
            
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            raise Exception(f"Groq streaming error: {str(e)}")
    
    def supports_function_calling(self) -> bool:
        """Groq supports function calling."""
        return True
    
    def get_available_models(self) -> List[str]:
        """Get available Groq models."""
        return self.AVAILABLE_MODELS
