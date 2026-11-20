"""Farm endpoints (API doc #12-#15)."""
from fastapi import APIRouter, Depends

from api_service.application.services import Services
from api_service.domain.entities import User
from api_service.interfaces.dependencies import get_current_user, get_services
from api_service.interfaces.schemas import FarmCreateRequest, FarmUpdateRequest

router = APIRouter(prefix="/api/v1/farms", tags=["farms"])


@router.get("")
def list_farms(
    user: User = Depends(get_current_user),
    services: Services = Depends(get_services),
):
    return services.farms.list(user)


@router.post("", status_code=201)
def create_farm(
    payload: FarmCreateRequest,
    user: User = Depends(get_current_user),
    services: Services = Depends(get_services),
):
    return services.farms.create(user, payload.model_dump())


@router.get("/{farm_id}")
def get_farm(
    farm_id: int,
    user: User = Depends(get_current_user),
    services: Services = Depends(get_services),
):
    return services.farms.get(user, farm_id)


@router.patch("/{farm_id}")
def update_farm(
    farm_id: int,
    payload: FarmUpdateRequest,
    user: User = Depends(get_current_user),
    services: Services = Depends(get_services),
):
    return services.farms.update(user, farm_id, payload.as_updates())
