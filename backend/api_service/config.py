"""Environment-driven configuration for the API service (no framework coupling)."""
import os
from dataclasses import dataclass


def _bool(name: str, default: bool) -> bool:
    return os.environ.get(name, str(default)).lower() in {"1", "true", "yes"}


@dataclass(frozen=True)
class Settings:
    app_name: str
    secret_key: str
    min_confidence: float
    weather_provider: str
    open_meteo_url: str
    weather_timeout_seconds: float
    weather_cache_ttl_seconds: int
    access_token_ttl_seconds: int
    refresh_token_ttl_seconds: int
    default_page_size: int
    max_page_size: int
    cors_origins: tuple
    bootstrap_admin_email: str
    bootstrap_admin_password: str


def get_settings() -> Settings:
    origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
    return Settings(
        app_name=os.environ.get("APP_NAME", "Smart Agriculture Extended API"),
        secret_key=os.environ.get("SECRET_KEY", "dev-only-insecure-key-change-me"),
        min_confidence=float(os.environ.get("MIN_CONFIDENCE", "0.60")),
        weather_provider=os.environ.get("WEATHER_PROVIDER", "stub").lower(),
        open_meteo_url=os.environ.get(
            "OPEN_METEO_URL", "https://api.open-meteo.com/v1/forecast"
        ),
        weather_timeout_seconds=float(os.environ.get("WEATHER_TIMEOUT_SECONDS", "5")),
        weather_cache_ttl_seconds=int(os.environ.get("WEATHER_CACHE_TTL_SECONDS", "600")),
        access_token_ttl_seconds=int(os.environ.get("ACCESS_TOKEN_TTL_SECONDS", "3600")),
        refresh_token_ttl_seconds=int(
            os.environ.get("REFRESH_TOKEN_TTL_SECONDS", str(7 * 24 * 3600))
        ),
        default_page_size=int(os.environ.get("DEFAULT_PAGE_SIZE", "50")),
        max_page_size=int(os.environ.get("MAX_PAGE_SIZE", "200")),
        cors_origins=tuple(item.strip() for item in origins.split(",") if item.strip()),
        bootstrap_admin_email=os.environ.get("BOOTSTRAP_ADMIN_EMAIL", "admin@agri.local"),
        bootstrap_admin_password=os.environ.get(
            "BOOTSTRAP_ADMIN_PASSWORD", "AdminPass123!"
        ),
    )
