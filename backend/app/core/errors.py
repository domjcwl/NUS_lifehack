"""One error shape for the whole API: {"detail": "..."}.

Routes and services raise these instead of building HTTPException inline, so the
frontend can rely on a single response format for every failure.
"""

from fastapi import HTTPException, status


class APIError(HTTPException):
    """Base for every expected application error."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Request could not be processed"

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(
            status_code=self.status_code, detail=detail or self.default_detail
        )


class NotFoundError(APIError):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "Resource not found"


class ConflictError(APIError):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Resource already exists"


class AuthError(APIError):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Not authenticated"

    def __init__(self, detail: str | None = None) -> None:
        # WWW-Authenticate is what tells a client to re-authenticate rather than retry.
        HTTPException.__init__(
            self,
            status_code=self.status_code,
            detail=detail or self.default_detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class PermissionError_(APIError):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "You do not have access to this resource"


class ValidationError(APIError):
    # Literal 422 rather than the constant: Starlette renamed it, and the number
    # is stable across every version a teammate might have installed.
    status_code = 422
    default_detail = "Invalid input"


class RateLimitError(APIError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = "Too many requests, please try again later"


class ExternalServiceError(APIError):
    """An upstream API failed and no fallback could cover for it."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "An external service is temporarily unavailable"
