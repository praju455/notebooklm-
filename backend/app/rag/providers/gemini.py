from typing import Optional, List, AsyncIterator
from google import genai
from .base import LLMProvider, LLMResponse, LLMMessage


from google.genai import types

class GeminiProvider(LLMProvider):
    """Google Gemini provider."""
    
    AVAILABLE_MODELS = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
    ]
    
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        super().__init__(api_key, model)
        self.client = genai.Client(api_key=api_key)

    async def generate(
        self,
        messages: List[LLMMessage],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> LLMResponse:
        """Generate a response using Gemini."""
        
        # Add system prompt to messages if provided
        final_messages = []
        if system_prompt:
            final_messages.append(types.Content(
                role="user",
                parts=[types.Part.from_text(text=system_prompt)]
            ))
            
        for msg in messages:
            role = "model" if msg.role == "assistant" else "user"
            final_messages.append(types.Content(
                role=role,
                parts=[types.Part.from_text(text=msg.content)]
            ))

        try:
            # Use config for generation configuration
            response = self.client.models.generate_content(
                model=self.model,
                contents=final_messages,
                config=types.GenerateContentConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens or 8192,
                ),
                **kwargs
            )
            
            content = response.text if response.text else ""
            
            return LLMResponse(
                content=content,
                model=self.model,
                provider="gemini",
                tokens_used=None,
                cost=0.0,
                finish_reason=None
            )
        except Exception as e:
            raise Exception(f"Gemini API error: {str(e)}")
    
    async def generate_stream(
        self,
        messages: List[LLMMessage],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        """Generate a streaming response."""
        
        final_messages = []
        if system_prompt:
            final_messages.append(types.Content(
                role="user",
                parts=[types.Part.from_text(text=system_prompt)]
            ))
            
        for msg in messages:
            role = "model" if msg.role == "assistant" else "user"
            final_messages.append(types.Content(
                role=role,
                parts=[types.Part.from_text(text=msg.content)]
            ))
        
        try:
            response = self.client.models.generate_content_stream(
                model=self.model,
                contents=final_messages,
                config=types.GenerateContentConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens or 8192,
                ),
                **kwargs
            )
            
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            raise Exception(f"Gemini streaming error: {str(e)}")
    
    def supports_function_calling(self) -> bool:
        """Gemini supports function calling."""
        return True
    
    def get_available_models(self) -> List[str]:
        """Get available Gemini models."""
        return self.AVAILABLE_MODELS
