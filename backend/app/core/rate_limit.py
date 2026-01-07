"""Rate limiting configuration using slowapi"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse


def get_user_identifier(request: Request) -> str:
    """Get identifier for rate limiting - IP address or user ID if authenticated"""
    # Try to get user from request state (set by auth middleware)
    if hasattr(request.state, "user") and request.state.user:
        return f"user:{request.state.user.id}"
    # Fall back to IP address
    return get_remote_address(request)


# Create limiter instance
limiter = Limiter(key_func=get_user_identifier)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Custom handler for rate limit exceeded"""
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Muitas requisições. Tente novamente em alguns minutos.",
            "retry_after": exc.detail.split("per")[0].strip() if exc.detail else "1 minute"
        }
    )
