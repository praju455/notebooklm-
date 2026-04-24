from typing import Optional
import os
from app.config import get_settings
from .base import LLMProvider
from .anthropic import AnthropicProvider
from .openai import OpenAIProvider
from .gemini import GeminiProvider
from .groq import GroqProvider

settings = get_settings()


class ProviderFactory:
    """Factory for creating LLM providers."""
    
    @staticmethod
    def create_provider(provider_name: str, model: Optional[str] = None) -> Optional[LLMProvider]:
        """Create a provider instance."""
        provider_name = provider_name.lower()
        
        if provider_name == "anthropic":
            if not settings.anthropic_api_key:
                return None
            default_model = "claude-sonnet-4-20250514"
            return AnthropicProvider(settings.anthropic_api_key, model or default_model)
        
        elif provider_name == "openai":
            if not settings.openai_api_key:
                return None
            default_model = "gpt-4o-mini"
            return OpenAIProvider(settings.openai_api_key, model or default_model)
        
        elif provider_name == "gemini":
            if not settings.gemini_api_key:
                return None
            default_model = "gemini-2.5-flash"
            return GeminiProvider(settings.gemini_api_key, model or default_model)
        
        elif provider_name == "groq":
            if not settings.groq_api_key:
                return None
            default_model = "llama-3.3-70b-versatile"
            return GroqProvider(settings.groq_api_key, model or default_model)
        
        return None
    
    @staticmethod
    def get_available_providers() -> list[str]:
        """Get list of available providers based on API keys."""
        available = []
        
        if settings.anthropic_api_key:
            available.append("anthropic")
        if settings.openai_api_key:
            available.append("openai")
        if settings.gemini_api_key:
            available.append("gemini")
        if settings.groq_api_key:
            available.append("groq")
        
        return available
    
    @staticmethod
    def get_default_provider() -> Optional[LLMProvider]:
        """Get default provider based on available API keys."""
        # Priority: Groq > OpenAI > Anthropic > Gemini
        providers = ["groq", "openai", "anthropic", "gemini"]
        
        for provider_name in providers:
            provider = ProviderFactory.create_provider(provider_name)
            if provider:
                return provider
        
        return None
