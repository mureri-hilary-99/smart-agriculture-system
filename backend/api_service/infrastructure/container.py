"""Composition root.

All concrete adapters are wired here. The database and AI/ML teams can replace
the in-memory repositories and the stub model provider in this one place.
"""
from typing import Optional

from api_service.application.services import ServiceContext, Services
from api_service.config import Settings, get_settings
from api_service.domain.entities import Role, User
from api_service.infrastructure.model_provider import ModelProvider, StubModelProvider
from api_service.infrastructure.security import PasswordHasher, TokenProvider
from api_service.infrastructure.weather import (
    WeatherProvider,
    build_weather_provider,
)
from api_service.repositories.memory import (
    InMemoryAuditLogRepository,
    InMemoryCropRepository,
    InMemoryDatasetRepository,
    InMemoryFarmRepository,
    InMemoryRecommendationRepository,
    InMemorySystemParamRepository,
    InMemoryUserRepository,
    InMemoryWeatherRepository,
)


class Container:
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self.users = InMemoryUserRepository()
        self.farms = InMemoryFarmRepository()
        self.weather = InMemoryWeatherRepository()
        self.recommendations = InMemoryRecommendationRepository()
        self.crops = InMemoryCropRepository()
        self.params = InMemorySystemParamRepository()
        self.datasets = InMemoryDatasetRepository()
        self.audit = InMemoryAuditLogRepository()
        self.passwords = PasswordHasher()

        # Bootstrap administrator so admin-only endpoints are usable from the
        # first request. Override credentials via environment variables.
        if not self.users.get_by_email(self.settings.bootstrap_admin_email):
            self.users.add(
                User(
                    id=0,
                    full_name="System Administrator",
                    email=self.settings.bootstrap_admin_email,
                    password_hash=self.passwords.hash(
                        self.settings.bootstrap_admin_password
                    ),
                    role=Role.ADMIN,
                )
            )

        self.tokens = TokenProvider(
            self.settings.secret_key,
            self.settings.access_token_ttl_seconds,
            self.settings.refresh_token_ttl_seconds,
        )
        weather_provider: WeatherProvider = build_weather_provider(
            self.settings.weather_provider,
            self.settings.open_meteo_url,
            self.settings.weather_timeout_seconds,
        )
        model_provider: ModelProvider = StubModelProvider(self.settings.min_confidence)
        self.weather_provider = weather_provider
        self.model_provider = model_provider

        context = ServiceContext(
            users=self.users,
            farms=self.farms,
            weather=self.weather,
            recommendations=self.recommendations,
            crops=self.crops,
            params=self.params,
            datasets=self.datasets,
            audit=self.audit,
            passwords=self.passwords,
            tokens=self.tokens,
            weather_provider=weather_provider,
            model=model_provider,
            min_confidence=self.settings.min_confidence,
            weather_cache_ttl=self.settings.weather_cache_ttl_seconds,
            default_page_size=self.settings.default_page_size,
            max_page_size=self.settings.max_page_size,
        )
        self.services = Services(context)


_container: Optional[Container] = None


def get_container() -> Container:
    global _container
    if _container is None:
        _container = Container()
    return _container


def reset_container() -> Container:
    """Rebuild all state. Used by tests; safe because no external store exists."""
    global _container
    _container = Container()
    return _container
