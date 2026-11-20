"""Auth and user management endpoints (API doc #5-#11)."""
from typing import Optional, Tuple

from fastapi import APIRouter, Depends

from api_service.application.services import AuthService, Services
from api_service.domain.entities import User
from api_service.interfaces.dependencies import (
    get_current_user,
    get_services,
    pagination_args,
    require_admin,
)
from api_service.interfaces.schemas import (
    AdminUserUpdateRequest,
    LoginRequest,
    ProfileUpdateRequest,
    RefreshRequest,
    RegisterRequest,
)

router = APIRouter(prefix="/api/v1", tags=["auth", "users"])


@router.post("/auth/register", status_code=201)
def register(payload: RegisterRequest, services: Services = Depends(get_services)):
    return services.auth.register(payload.model_dump())


@router.post("/auth/login")
def login(payload: LoginRequest, services: Services = Depends(get_services)):
    return services.auth.login(payload.model_dump())


@router.post("/auth/refresh")
def refresh(payload: RefreshRequest, services: Services = Depends(get_services)):
    return services.auth.refresh(payload.refresh_token)


@router.get("/auth/me")
def me(user: User = Depends(get_current_user)):
    return AuthService.me(user)


@router.patch("/users/me")
def update_profile(
    payload: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    services: Services = Depends(get_services),
):
    return services.auth.update_profile(user, payload.as_updates())


@router.get("/admin/users")
def admin_list_users(
    pagination: Tuple[int, Optional[int]] = Depends(pagination_args),
    user: User = Depends(require_admin),
    services: Services = Depends(get_services),
):
    page, page_size = pagination
    return services.auth.admin_list_users(user, page, page_size)


@router.patch("/admin/users/{user_id}")
def admin_update_user(
    user_id: int,
    payload: AdminUserUpdateRequest,
    admin: User = Depends(require_admin),
    services: Services = Depends(get_services),
):
    return services.auth.admin_update_user(admin, user_id, payload.as_updates())
