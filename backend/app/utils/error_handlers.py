"""
Centralized error handling utilities for better error messages and logging.
"""

from typing import Optional
import traceback
from fastapi import HTTPException, status


class APIError(Exception):
    """Base exception for API errors."""
    
    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[dict] = None
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(APIError):
    """Raised when input validation fails."""
    
    def __init__(self, message: str, details: Optional[dict] = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details
        )


class ResourceNotFoundError(APIError):
    """Raised when a requested resource is not found."""
    
    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            message=f"{resource} with ID '{resource_id}' not found",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"resource": resource, "id": resource_id}
        )


class ServiceUnavailableError(APIError):
    """Raised when a required service is unavailable."""
    
    def __init__(self, service: str, reason: Optional[str] = None):
        message = f"{service} is currently unavailable"
        if reason:
            message += f": {reason}"
        super().__init__(
            message=message,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details={"service": service, "reason": reason}
        )


class RateLimitError(APIError):
    """Raised when rate limit is exceeded."""
    
    def __init__(self, retry_after: Optional[int] = None):
        message = "Rate limit exceeded"
        if retry_after:
            message += f". Please retry after {retry_after} seconds"
        super().__init__(
            message=message,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details={"retry_after": retry_after}
        )


def handle_llm_error(error: Exception, provider: str) -> HTTPException:
    """
    Convert LLM provider errors into user-friendly HTTP exceptions.
    
    Args:
        error: The original exception from the LLM provider
        provider: Name of the LLM provider (e.g., 'openai', 'groq')
        
    Returns:
        HTTPException with appropriate status code and message
    """
    error_str = str(error).lower()
    
    # Rate limit errors
    if 'rate limit' in error_str or '429' in error_str:
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "Rate limit exceeded",
                "message": f"{provider.title()} API rate limit reached. Please try again later or switch to a different model.",
                "provider": provider
            }
        )
    
    # Authentication errors
    if 'api key' in error_str or 'authentication' in error_str or '401' in error_str:
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "Authentication failed",
                "message": f"Invalid or missing {provider.title()} API key. Please check your configuration.",
                "provider": provider
            }
        )
    
    # Model not found / deprecated
    if 'not found' in error_str or 'decommissioned' in error_str or '404' in error_str:
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Model unavailable",
                "message": f"The selected model is no longer available. Please choose a different model in Settings.",
                "provider": provider
            }
        )
    
    # Token limit exceeded
    if 'token' in error_str and ('limit' in error_str or 'too large' in error_str):
        return HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": "Request too large",
                "message": "Your message or conversation history is too long. Try clearing the chat or asking a shorter question.",
                "provider": provider
            }
        )
    
    # Permission denied
    if 'permission' in error_str or 'denied' in error_str or '403' in error_str:
        return HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "Permission denied",
                "message": f"Access denied by {provider.title()}. Your API key may not have the required permissions.",
                "provider": provider
            }
        )
    
    # Generic error
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={
            "error": "LLM provider error",
            "message": f"An error occurred with {provider.title()}: {str(error)[:200]}",
            "provider": provider
        }
    )


def handle_ingestion_error(error: Exception, source_type: str) -> HTTPException:
    """
    Convert document ingestion errors into user-friendly HTTP exceptions.
    
    Args:
        error: The original exception
        source_type: Type of source being ingested (e.g., 'pdf', 'github', 'url')
        
    Returns:
        HTTPException with appropriate status code and message
    """
    error_str = str(error).lower()
    
    # File format errors
    if 'format' in error_str or 'parse' in error_str or 'decode' in error_str:
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Invalid file format",
                "message": f"Could not parse {source_type.upper()} file. The file may be corrupted or in an unsupported format.",
                "source_type": source_type
            }
        )
    
    # Network errors (for URL/GitHub ingestion)
    if 'connection' in error_str or 'timeout' in error_str or 'network' in error_str:
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "Connection failed",
                "message": f"Could not connect to the {source_type}. Please check the URL and try again.",
                "source_type": source_type
            }
        )
    
    # 403/404 errors for web scraping
    if '403' in error_str or 'forbidden' in error_str:
        return HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "Access denied",
                "message": "The website blocked our request. Try a different URL or check if the site allows scraping.",
                "source_type": source_type
            }
        )
    
    if '404' in error_str or 'not found' in error_str:
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Resource not found",
                "message": f"The {source_type} could not be found. Please check the URL and try again.",
                "source_type": source_type
            }
        )
    
    # File too large
    if 'size' in error_str or 'too large' in error_str or 'memory' in error_str:
        return HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": "File too large",
                "message": f"The {source_type} file is too large to process. Try a smaller file.",
                "source_type": source_type
            }
        )
    
    # Empty content
    if 'empty' in error_str or 'no content' in error_str or 'meaningful' in error_str:
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "No content found",
                "message": f"Could not extract any meaningful content from the {source_type}.",
                "source_type": source_type
            }
        )
    
    # Generic error
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={
            "error": "Ingestion failed",
            "message": f"Failed to ingest {source_type}: {str(error)[:200]}",
            "source_type": source_type
        }
    )


def log_error(error: Exception, context: Optional[dict] = None):
    """
    Log an error with context for debugging.
    
    Args:
        error: The exception to log
        context: Additional context (user_id, request_id, etc.)
    """
    print(f"\n{'='*60}")
    print(f"ERROR: {type(error).__name__}")
    print(f"Message: {str(error)}")
    if context:
        print(f"Context: {context}")
    print(f"Traceback:")
    traceback.print_exc()
    print(f"{'='*60}\n")
