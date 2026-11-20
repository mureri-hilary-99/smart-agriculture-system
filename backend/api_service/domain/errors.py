"""Domain-level exceptions. The HTTP layer maps these to responses."""


class DomainError(Exception):
    status_code = 500
    code = "internal_error"

    def __init__(self, detail=None, code=None):
        self.detail = detail or (self.__class__.__doc__ or "Unexpected error").strip()
        if code is not None:
            self.code = code
        super().__init__(self.detail)


class ValidationError(DomainError):
    """The supplied data is missing, malformed or out of range."""

    status_code = 422
    code = "validation_error"


class UnauthorizedError(DomainError):
    """Authentication is required or the credentials are invalid."""

    status_code = 401
    code = "unauthorized"


class ForbiddenError(DomainError):
    """The authenticated user may not perform this action."""

    status_code = 403
    code = "forbidden"


class NotFoundError(DomainError):
    """The requested resource does not exist."""

    status_code = 404
    code = "not_found"


class ConflictError(DomainError):
    """The request conflicts with existing state."""

    status_code = 409
    code = "conflict"


class ExternalServiceError(DomainError):
    """An external provider (e.g. weather) failed."""

    status_code = 502
    code = "external_service_error"
