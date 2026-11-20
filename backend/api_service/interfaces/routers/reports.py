"""Report endpoints (API doc #34-#35)."""
from typing import Optional, Tuple

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from api_service.application.services import Services
from api_service.domain.entities import User
from api_service.interfaces.dependencies import date_filters, get_current_user, get_services

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


@router.get("/summary")
def report_summary(
    farm_id: int = Query(..., gt=0),
    dates: Tuple[Optional[str], Optional[str]] = Depends(date_filters),
    user: User = Depends(get_current_user),
    services: Services = Depends(get_services),
):
    date_from, date_to = dates
    return services.reports.summary(user, farm_id, date_from, date_to)


@router.get("/export")
def report_export(
    farm_id: int = Query(..., gt=0),
    dates: Tuple[Optional[str], Optional[str]] = Depends(date_filters),
    format: str = Query(default="csv", pattern="^csv$"),
    user: User = Depends(get_current_user),
    services: Services = Depends(get_services),
):
    date_from, date_to = dates
    content = services.reports.export_csv(user, farm_id, date_from, date_to)
    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="recommendations_farm_{farm_id}.csv"'
        },
    )
