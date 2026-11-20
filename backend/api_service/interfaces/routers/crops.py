"""Crop catalogue endpoints (API doc #28-#30)."""
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response, status

from api_service.application.services import Services
from api_service.domain.entities import User
from api_service.interfaces.dependencies import get_current_user, get_services, require_admin
from api_service.interfaces.schemas import CropCreateRequest, CropUpdateRequest

router = APIRouter(prefix="/api/v1/crops", tags=["crops"])


@router.get("")
def list_crops(
    q: Optional[str] = Query(default=None),
    is_active: bool = Query(default=False, description="Return only active crops"),
    user: User = Depends(get_current_user),
    services: Services = Depends(get_services),
):
    return services.crops.list(q, is_active)


@router.get("/{code}")
def get_crop(
    code: str,
    user: User = Depends(get_current_user),
    services: Services = Depends(get_services),
):
    return services.crops.get(code)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_crop(
    payload: CropCreateRequest,
    admin: User = Depends(require_admin),
    services: Services = Depends(get_services),
):
    return services.crops.create(admin, payload.model_dump())


@router.patch("/{code}")
def update_crop(
    code: str,
    payload: CropUpdateRequest,
    admin: User = Depends(require_admin),
    services: Services = Depends(get_services),
):
    return services.crops.update(admin, code, payload.as_updates())


@router.delete("/{code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_crop(
    code: str,
    admin: User = Depends(require_admin),
    services: Services = Depends(get_services),
):
    services.crops.delete(admin, code)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
