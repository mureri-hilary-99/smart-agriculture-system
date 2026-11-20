"""FastAPI dependency providers (HTTP boundary only)."""
import re
from typing import Optional, Tuple

from fastapi import Depends, Header, Query

from api_service.application.services import Services
from api_service.domain.entities import Role, User
from api_service.domain.errors import ForbiddenError, UnauthorizedError, ValidationError
from api_service.infrastructure.container import Container, get_container

DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def get_services(container: Container = Depends(get_container)) -> Services:
    return container.services


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    services: Services = Depends(get_services),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedError("A Bearer access token is required")
    token = authorization.split(" ", 1)[1].strip()
    claims = services.ctx.tokens.decode(token, "access")
    user = services.ctx.users.get_by_id(int(claims["sub"]))
    if not user or not user.is_active:
        raise UnauthorizedError("Account is unknown or inactive")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.ADMIN:
        raise ForbiddenError("Administrator access required")
    return user


def pagination_args(
    page: int = Query(default=1, ge=1),
    page_size: Optional[int] = Query(default=None, ge=1, le=200),
) -> Tuple[int, Optional[int]]:
    return page, page_size


def date_filters(
    date_from: Optional[str] = Query(default=None, alias="from"),
    date_to: Optional[str] = Query(default=None, alias="to"),
) -> Tuple[Optional[str], Optional[str]]:
    for name, value in (("from", date_from), ("to", date_to)):
        if value is not None and not DATE_PATTERN.match(value):
            raise ValidationError(f"'{name}' must use YYYY-MM-DD format")
    if date_from and date_to and date_from > date_to:
        raise ValidationError("'from' must not be after 'to'")
    return date_from, date_to
