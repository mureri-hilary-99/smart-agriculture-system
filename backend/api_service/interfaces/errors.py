"""Centralised error handling — one response shape for every endpoint."""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from api_service.domain.errors import DomainError

logger = logging.getLogger(__name__)


def _response(status: int, detail, code: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": detail, "code": code})


async def domain_error_handler(request: Request, error: DomainError) -> JSONResponse:
    return _response(error.status_code, error.detail, error.code)


async def validation_error_handler(
    request: Request, error: RequestValidationError
) -> JSONResponse:
    detail = [
        {
            "loc": [str(part) for part in item.get("loc", ())],
            "msg": item.get("msg", "Invalid value"),
            "type": item.get("type", "value_error"),
        }
        for item in error.errors()
    ]
    return _response(422, detail, "validation_error")


async def unexpected_error_handler(request: Request, error: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return _response(500, "Internal server error", "internal_error")


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DomainError, domain_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unexpected_error_handler)
