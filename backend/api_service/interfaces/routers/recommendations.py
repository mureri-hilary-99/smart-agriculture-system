"""Recommendation endpoints (API doc #24-#27).

Static `/latest` is registered before `/{recommendation_id}` so it is not
shadowed by the dynamic route.
"""
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
from api_service.interfaces.schemas import RecommendationCreateRequest

router = APIRouter(prefix="/api/v1/recommendations", tags=["recommendations"])


@router.post("", status_code=201)
def create_recommendation(
    payload: RecommendationCreateRequest,
    user: User = Depends(get_current_user),
    services: Services = Depends(get_services),
):
    return services.recommendations.create(user, payload.model_dump())


@router.get("")
def list_recommendations(
    farm_id: Optional[int] = Query(default=None, gt=0),
    dates: Tuple[Optional[str], Optional[str]] = Depends(date_filters),
    pagination: Tuple[int, Optional[int]] = Depends(pagination_args),
    user: User = Depends(get_current_user),
    services: Services = Depends(get_services),
):
    date_from, date_to = dates
    page, page_size = pagination
    return services.recommendations.list(
        user, farm_id, date_from, date_to, page, page_size
    )


@router.get("/latest")
def latest_recommendation(
    farm_id: int = Query(..., gt=0),
    user: User = Depends(get_current_user),
    services: Services = Depends(get_services),
):
    return services.recommendations.latest(user, farm_id)


@router.get("/{recommendation_id}")
def get_recommendation(
    recommendation_id: int,
    user: User = Depends(get_current_user),
    services: Services = Depends(get_services),
):
    return services.recommendations.get(user, recommendation_id)
