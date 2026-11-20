"""Admin, dataset, audit and model-info endpoints (API doc #31-#33, #36)."""
from typing import Optional, Tuple

from fastapi import APIRouter, Depends

from api_service.application.services import Services
from api_service.domain.entities import User
from api_service.infrastructure.container import get_container
from api_service.interfaces.dependencies import (
    date_filters,
    get_current_user,
    get_services,
    pagination_args,
    require_admin,
)
from api_service.interfaces.schemas import DatasetCreateRequest, SystemParamsUpdateRequest

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])
audit_router = APIRouter(prefix="/api/v1", tags=["admin"])
model_router = APIRouter(prefix="/api/v1/model", tags=["model"])


@router.get("/system-params")
def get_system_params(
    admin: User = Depends(require_admin),
    services: Services = Depends(get_services),
):
    return services.admin.get_params(admin)


@router.patch("/system-params")
def set_system_params(
    payload: SystemParamsUpdateRequest,
    admin: User = Depends(require_admin),
    services: Services = Depends(get_services),
):
    return services.admin.set_params(admin, payload.params)


@router.get("/datasets")
def list_datasets(
    admin: User = Depends(require_admin),
    services: Services = Depends(get_services),
):
    return services.admin.list_datasets(admin)


@router.post("/datasets", status_code=201)
def create_dataset(
    payload: DatasetCreateRequest,
    admin: User = Depends(require_admin),
    services: Services = Depends(get_services),
):
    return services.admin.create_dataset(admin, payload.model_dump())


@audit_router.get("/audit-logs")
def audit_logs(
    actor_id: Optional[int] = None,
    dates: Tuple[Optional[str], Optional[str]] = Depends(date_filters),
    pagination: Tuple[int, Optional[int]] = Depends(pagination_args),
    admin: User = Depends(require_admin),
    services: Services = Depends(get_services),
):
    date_from, date_to = dates
    page, page_size = pagination
    return services.admin.audit_logs(
        admin, actor_id, date_from, date_to, page, page_size
    )


@model_router.get("/info")
def model_info(
    user: User = Depends(get_current_user),
    container=Depends(get_container),
):
    return container.model_provider.info()

