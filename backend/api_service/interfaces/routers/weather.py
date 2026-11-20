"""Weather endpoints (API doc #21-#23). External weather data, not IoT sensors."""
from typing import Optional, Tuple

from fastapi import APIRouter, Depends, Query

from api_service.application.services import Services
from api_service.domain.entities import User
from api_service.interfaces.dependencies import (
    date_filters,
    get_current_user,
    get_services,
    pagination_args,
)
from api_service.interfaces.schemas import WeatherRefreshRequest

router = APIRouter(prefix="/api/v1/weather", tags=["weather"])


@router.get("/current")
def current_weather(
    farm_id: int = Query(..., gt=0),
    user: User = Depends(get_current_user),
    services: Services = Depends(get_services),
):
    return services.weather.current(user, farm_id)


@router.get("")
def weather_history(
    farm_id: int = Query(..., gt=0),
    dates: Tuple[Optional[str], Optional[str]] = Depends(date_filters),
    pagination: Tuple[int, Optional[int]] = Depends(pagination_args),
    user: User = Depends(get_current_user),
    services: Services = Depends(get_services),
):
    date_from, date_to = dates
    page, page_size = pagination
    return services.weather.history(
        user, farm_id, date_from, date_to, page, page_size
    )


@router.post("/refresh")
def refresh_weather(
    payload: WeatherRefreshRequest,
    user: User = Depends(get_current_user),
    services: Services = Depends(get_services),
):
    return services.weather.refresh(user, payload.farm_id)
