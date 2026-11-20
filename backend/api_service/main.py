"""FastAPI application for the extended Smart Agriculture backend.

This app deliberately does NOT implement the already-shipped endpoints
`GET /`, `GET /health`, `POST /api/v1/predict` or the generated docs, and it
does NOT implement sensor/IoT ingestion or soil-reading endpoints. Those remain
with their owning teams. Run with:

    cd backend
    uvicorn api_service.main:app --reload --port 8001
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_service.config import get_settings
from api_service.interfaces.errors import register_exception_handlers
from api_service.interfaces.routers import (
    admin,
    auth,
    crops,
    farms,
    recommendations,
    reports,
    weather,
)

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "Layered FastAPI backend: auth, farms, weather, recommendations, crops, "
        "admin, model info and reports. No ORM and no frontend in this service."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

for router in (
    auth.router,
    farms.router,
    weather.router,
    recommendations.router,
    crops.router,
    admin.router,
    admin.audit_router,
    admin.model_router,
    reports.router,
):
    app.include_router(router)
