"""Application (use-case) layer.

Services own business rules, authorization and orchestration. They depend only
on repository/provider contracts, never on framework-specific HTTP objects or an ORM.
"""
import csv
import io
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from api_service.domain.entities import (
    AuditLog,
    Crop,
    Dataset,
    Farm,
    Recommendation,
    Role,
    User,
    WeatherReading,
    paginate,
)
from api_service.domain.errors import (
    ConflictError,
    ExternalServiceError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
)
from api_service.infrastructure.model_provider import EXTENDED_FEATURES, STANDARD_FEATURES
from api_service.infrastructure.security import PasswordHasher, TokenProvider
from api_service.infrastructure.weather import WeatherProvider
from api_service.repositories.contracts import (
    AuditLogRepository,
    CropRepository,
    DatasetRepository,
    FarmRepository,
    RecommendationRepository,
    SystemParamRepository,
    UserRepository,
    WeatherRepository,
)


def _parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _within(recorded_at: str, date_from: Optional[str], date_to: Optional[str]) -> bool:
    day = recorded_at[:10]
    if date_from and day < date_from:
        return False
    if date_to and day > date_to:
        return False
    return True


@dataclass
class ServiceContext:
    users: UserRepository
    farms: FarmRepository
    weather: WeatherRepository
    recommendations: RecommendationRepository
    crops: CropRepository
    params: SystemParamRepository
    datasets: DatasetRepository
    audit: AuditLogRepository
    passwords: PasswordHasher
    tokens: TokenProvider
    weather_provider: WeatherProvider
    model: Any
    min_confidence: float
    weather_cache_ttl: int
    default_page_size: int
    max_page_size: int

    def page_args(self, page: Optional[int], page_size: Optional[int]) -> Tuple[int, int]:
        resolved_page = max(1, int(page or 1))
        resolved_size = int(page_size or self.default_page_size)
        return resolved_page, min(max(1, resolved_size), self.max_page_size)

    def threshold(self) -> float:
        param = self.params.get("min_confidence")
        try:
            return float(param.value) if param else self.min_confidence
        except (TypeError, ValueError):
            return self.min_confidence


def _require_admin(user: User) -> None:
    if user.role != Role.ADMIN:
        raise ForbiddenError("Administrator access required")


def _can_access(user: User, farm: Farm) -> bool:
    if user.role in {Role.ADMIN, Role.EXTENSION_OFFICER}:
        return True
    return farm.owner_user_id == user.id


def _require_farm(ctx: ServiceContext, user: User, farm_id: int) -> Farm:
    farm = ctx.farms.get(farm_id)
    if not farm:
        raise NotFoundError(f"Farm {farm_id} was not found")
    if not _can_access(user, farm):
        raise ForbiddenError("You do not have access to this farm")
    return farm


class AuthService:
    def __init__(self, ctx: ServiceContext):
        self.ctx = ctx

    def register(self, data: Dict[str, Any]) -> Dict[str, Any]:
        email = data["email"].strip().lower()
        if self.ctx.users.get_by_email(email):
            raise ConflictError("An account with this email already exists")
        user = User(
            id=0,
            full_name=data["full_name"].strip(),
            email=email,
            password_hash=self.ctx.passwords.hash(data["password"]),
            phone=data.get("phone"),
            location=data.get("location"),
            county=data.get("county"),
            role=Role.FARMER,
        )
        saved = self.ctx.users.add(user)
        self.ctx.audit.add(
            AuditLog(
                id=0,
                actor_user_id=saved.id,
                action="register",
                entity="user",
                entity_id=str(saved.id),
            )
        )
        return saved.public()

    def login(self, data: Dict[str, Any]) -> Dict[str, Any]:
        user = self.ctx.users.get_by_email(data["email"].strip().lower())
        if not user or not self.ctx.passwords.verify(data["password"], user.password_hash):
            raise UnauthorizedError("Invalid email or password")
        if not user.is_active:
            raise ForbiddenError("This account has been deactivated")
        return self.ctx.tokens.issue(user)

    def refresh(self, refresh_token: str) -> Dict[str, Any]:
        return self.ctx.tokens.rotate(refresh_token)

    @staticmethod
    def me(user: User) -> Dict[str, Any]:
        return user.public()

    def update_profile(self, user: User, data: Dict[str, Any]) -> Dict[str, Any]:
        for field in ("full_name", "phone", "location", "county"):
            if field in data:
                setattr(user, field, data[field])
        if "role" in data:
            raise ForbiddenError("Users cannot change their own role")
        saved = self.ctx.users.update(user)
        return saved.public()

    def admin_list_users(
        self, user: User, page: Optional[int], page_size: Optional[int]
    ) -> Dict[str, Any]:
        _require_admin(user)
        current, size = self.ctx.page_args(page, page_size)
        return paginate(
            [item.public() for item in self.ctx.users.list()], current, size
        ).to_dict()

    def admin_update_user(
        self, actor: User, user_id: int, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        _require_admin(actor)
        target = self.ctx.users.get_by_id(user_id)
        if not target:
            raise NotFoundError(f"User {user_id} was not found")
        if "role" in data:
            if data["role"] not in Role.ALL:
                raise ValidationError(f"role must be one of {', '.join(Role.ALL)}")
            target.role = data["role"]
        if "is_active" in data:
            target.is_active = bool(data["is_active"])
        saved = self.ctx.users.update(target)
        self.ctx.audit.add(
            AuditLog(
                id=0,
                actor_user_id=actor.id,
                action="update_user",
                entity="user",
                entity_id=str(user_id),
                metadata={k: v for k, v in data.items() if k in {"role", "is_active"}},
            )
        )
        return saved.public()


class FarmService:
    def __init__(self, ctx: ServiceContext):
        self.ctx = ctx

    def list(self, user: User) -> List[Dict[str, Any]]:
        farms = self.ctx.farms.list_all()
        if user.role == Role.FARMER:
            farms = [farm for farm in farms if farm.owner_user_id == user.id]
        return [farm.to_dict() for farm in farms]

    def create(self, user: User, data: Dict[str, Any]) -> Dict[str, Any]:
        farm = Farm(
            id=0,
            owner_user_id=user.id,
            name=data["name"].strip(),
            latitude=float(data["latitude"]),
            longitude=float(data["longitude"]),
            county=data.get("county"),
        )
        saved = self.ctx.farms.add(farm)
        self.ctx.audit.add(
            AuditLog(
                id=0,
                actor_user_id=user.id,
                action="create_farm",
                entity="farm",
                entity_id=str(saved.id),
            )
        )
        return saved.to_dict()

    def get(self, user: User, farm_id: int) -> Dict[str, Any]:
        return _require_farm(self.ctx, user, farm_id).to_dict()

    def update(self, user: User, farm_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        farm = _require_farm(self.ctx, user, farm_id)
        if user.role == Role.FARMER and farm.owner_user_id != user.id:
            raise ForbiddenError("Only the owner or an administrator may update this farm")
        for field in ("name", "county", "latitude", "longitude"):
            if field in data:
                value = float(data[field]) if field in {"latitude", "longitude"} else data[field]
                setattr(farm, field, value)
        return self.ctx.farms.update(farm).to_dict()


class WeatherService:
    def __init__(self, ctx: ServiceContext):
        self.ctx = ctx

    def _fetch(self, farm: Farm) -> Dict[str, Any]:
        values = self.ctx.weather_provider.current(farm.latitude, farm.longitude)
        self.ctx.weather.invalidate_stale(farm.id)
        reading = WeatherReading(
            id=0,
            farm_id=farm.id,
            recorded_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            temperature=values["temperature"],
            humidity=values["humidity"],
            rainfall=values["rainfall"],
            source="provider",
            provider=self.ctx.weather_provider.name,
            is_stale=False,
        )
        return self.ctx.weather.add(reading).to_dict()

    def _stale_fallback(self, farm_id: int, reason: str) -> Dict[str, Any]:
        cached = self.ctx.weather.latest(farm_id)
        if not cached:
            raise ExternalServiceError(f"{reason} and no cached weather is available")
        payload = cached.to_dict()
        payload["is_stale"] = True
        payload["warning"] = "Showing last known weather; live data is unavailable."
        return payload

    def current(self, user: User, farm_id: int) -> Dict[str, Any]:
        farm = _require_farm(self.ctx, user, farm_id)
        cached = self.ctx.weather.latest(farm.id)
        if cached and not cached.is_stale:
            age = (
                datetime.now(timezone.utc) - _parse_timestamp(cached.recorded_at)
            ).total_seconds()
            if age <= self.ctx.weather_cache_ttl:
                return cached.to_dict()
        try:
            return self._fetch(farm)
        except Exception as error:  # provider failure -> documented stale behaviour
            return self._stale_fallback(farm.id, str(error))

    def history(
        self,
        user: User,
        farm_id: int,
        date_from: Optional[str],
        date_to: Optional[str],
        page: Optional[int],
        page_size: Optional[int],
    ) -> Dict[str, Any]:
        _require_farm(self.ctx, user, farm_id)
        readings = [
            reading.to_dict()
            for reading in self.ctx.weather.list(farm_id)
            if _within(reading.recorded_at, date_from, date_to)
        ]
        readings.sort(key=lambda item: item["recorded_at"], reverse=True)
        current, size = self.ctx.page_args(page, page_size)
        return paginate(readings, current, size).to_dict()

    def refresh(self, user: User, farm_id: int) -> Dict[str, Any]:
        farm = _require_farm(self.ctx, user, farm_id)
        try:
            return self._fetch(farm)
        except Exception as error:
            return self._stale_fallback(farm.id, str(error))


class RecommendationService:
    def __init__(self, ctx: ServiceContext):
        self.ctx = ctx

    def _visible(self, user: User) -> List[Recommendation]:
        farms = self.ctx.farms.list_all()
        if user.role == Role.FARMER:
            allowed = {farm.id for farm in farms if farm.owner_user_id == user.id}
            return [r for r in self._all() if r.farm_id in allowed]
        return self._all()

    def _all(self) -> List[Recommendation]:
        farm_ids = {farm.id for farm in self.ctx.farms.list_all()}
        return [
            recommendation
            for farm_id in farm_ids
            for recommendation in self.ctx.recommendations.list(farm_id)
        ]

    def create(self, user: User, data: Dict[str, Any]) -> Dict[str, Any]:
        farm = _require_farm(self.ctx, user, data["farm_id"])
        source = data.get("source", "latest")
        if source not in {"latest", "manual"}:
            raise ValidationError("source must be 'latest' or 'manual'")

        features: Dict[str, float] = {
            key: float(value) for key, value in (data.get("inputs") or {}).items()
        }
        weather = self.ctx.weather.latest(farm.id)
        if weather:
            features.setdefault("temperature", weather.temperature)
            features.setdefault("humidity", weather.humidity)
            features.setdefault("rainfall", weather.rainfall)

        variant = (
            "extended"
            if all(key in features for key in ("N", "P", "K"))
            else "standard"
        )
        required = EXTENDED_FEATURES if variant == "extended" else STANDARD_FEATURES
        missing = [key for key in required if key not in features]
        if missing:
            raise ValidationError(
                "Missing required inputs for "
                f"{variant} model: {', '.join(missing)}. "
                "Provide them in `inputs` or ensure weather data is available."
            )

        prediction = self.ctx.model.predict(features, variant)
        confidence = float(prediction["confidence"])
        threshold = self.ctx.threshold()
        status = "ok" if confidence >= threshold else "low_confidence"
        advice = (
            None
            if status == "ok"
            else "Confidence is low. Collect more local data or consult an extension officer."
        )

        recommendation = Recommendation(
            id=0,
            farm_id=farm.id,
            recommended_crop=prediction["recommended_crop"],
            confidence=confidence,
            top_recommendations=prediction["top_recommendations"],
            weather_reading_id=weather.id if weather else None,
            requested_by_user_id=user.id,
            status=status,
            advice=advice,
            model_version=self.ctx.model.info().get("version", "unknown"),
        )
        saved = self.ctx.recommendations.add(recommendation)
        return saved.to_dict()

    def list(
        self,
        user: User,
        farm_id: Optional[int],
        date_from: Optional[str],
        date_to: Optional[str],
        page: Optional[int],
        page_size: Optional[int],
    ) -> Dict[str, Any]:
        if farm_id is not None:
            _require_farm(self.ctx, user, farm_id)
            items = self.ctx.recommendations.list(farm_id)
        else:
            items = self._visible(user)
        rows = [
            item.to_dict()
            for item in items
            if _within(item.created_at, date_from, date_to)
        ]
        rows.sort(key=lambda item: item["id"], reverse=True)
        current, size = self.ctx.page_args(page, page_size)
        return paginate(rows, current, size).to_dict()

    def latest(self, user: User, farm_id: int) -> Dict[str, Any]:
        _require_farm(self.ctx, user, farm_id)
        recommendation = self.ctx.recommendations.latest(farm_id)
        if not recommendation:
            raise NotFoundError(f"No recommendation exists for farm {farm_id}")
        return recommendation.to_dict()

    def get(self, user: User, recommendation_id: int) -> Dict[str, Any]:
        recommendation = self.ctx.recommendations.get(recommendation_id)
        if not recommendation:
            raise NotFoundError(f"Recommendation {recommendation_id} was not found")
        _require_farm(self.ctx, user, recommendation.farm_id)
        return recommendation.to_dict()


class CropService:
    def __init__(self, ctx: ServiceContext):
        self.ctx = ctx

    def list(self, query: Optional[str], active_only: bool) -> List[Dict[str, Any]]:
        crops = self.ctx.crops.list()
        if active_only:
            crops = [crop for crop in crops if crop.is_active]
        if query:
            needle = query.lower()
            crops = [
                crop
                for crop in crops
                if needle in crop.code.lower() or needle in crop.name.lower()
            ]
        return [crop.to_dict() for crop in crops]

    def get(self, code: str) -> Dict[str, Any]:
        crop = self.ctx.crops.get_by_code(code)
        if not crop:
            raise NotFoundError(f"Crop '{code}' was not found")
        return crop.to_dict()

    def create(self, user: User, data: Dict[str, Any]) -> Dict[str, Any]:
        _require_admin(user)
        code = data["code"].strip().lower()
        if self.ctx.crops.get_by_code(code):
            raise ConflictError(f"Crop '{code}' already exists")
        crop = self.ctx.crops.add(
            Crop(
                id=0,
                code=code,
                name=data["name"].strip(),
                local_name=data.get("local_name"),
                optimal=data.get("optimal") or {},
                is_active=bool(data.get("is_active", True)),
            )
        )
        return crop.to_dict()

    def update(self, user: User, code: str, data: Dict[str, Any]) -> Dict[str, Any]:
        _require_admin(user)
        crop = self.ctx.crops.get_by_code(code)
        if not crop:
            raise NotFoundError(f"Crop '{code}' was not found")
        for field in ("name", "local_name", "optimal", "is_active"):
            if field in data:
                setattr(crop, field, data[field])
        return self.ctx.crops.update(crop).to_dict()

    def delete(self, user: User, code: str) -> None:
        _require_admin(user)
        if not self.ctx.crops.delete(code):
            raise NotFoundError(f"Crop '{code}' was not found")


class AdminService:
    def __init__(self, ctx: ServiceContext):
        self.ctx = ctx

    def get_params(self, user: User) -> List[Dict[str, Any]]:
        _require_admin(user)
        return [param.to_dict() for param in self.ctx.params.all().values()]

    def set_params(self, user: User, values: Dict[str, Any]) -> List[Dict[str, Any]]:
        _require_admin(user)
        if not values:
            raise ValidationError("Provide at least one parameter to update")
        updated = []
        for key, value in values.items():
            updated.append(
                self.ctx.params.set(key, value, user.id).to_dict()
            )
        self.ctx.audit.add(
            AuditLog(
                id=0,
                actor_user_id=user.id,
                action="update_system_params",
                entity="system_param",
                metadata={"keys": sorted(values.keys())},
            )
        )
        return updated

    def list_datasets(self, user: User) -> List[Dict[str, Any]]:
        _require_admin(user)
        return [dataset.to_dict() for dataset in self.ctx.datasets.list()]

    def create_dataset(self, user: User, data: Dict[str, Any]) -> Dict[str, Any]:
        _require_admin(user)
        dataset = self.ctx.datasets.add(
            Dataset(
                id=0,
                name=data["name"].strip(),
                file_uri=data["file_uri"].strip(),
                rows_count=data.get("rows_count"),
                status="registered",
                uploaded_by=user.id,
            )
        )
        self.ctx.audit.add(
            AuditLog(
                id=0,
                actor_user_id=user.id,
                action="create_dataset",
                entity="dataset",
                entity_id=str(dataset.id),
                metadata={"name": dataset.name},
            )
        )
        return dataset.to_dict()

    def audit_logs(
        self,
        user: User,
        actor_id: Optional[int],
        date_from: Optional[str],
        date_to: Optional[str],
        page: Optional[int],
        page_size: Optional[int],
    ) -> Dict[str, Any]:
        _require_admin(user)
        rows = [
            log.to_dict()
            for log in self.ctx.audit.list()
            if (actor_id is None or log.actor_user_id == actor_id)
            and _within(log.created_at, date_from, date_to)
        ]
        rows.sort(key=lambda item: item["id"], reverse=True)
        current, size = self.ctx.page_args(page, page_size)
        return paginate(rows, current, size).to_dict()


class ReportService:
    def __init__(self, ctx: ServiceContext):
        self.ctx = ctx

    def _rows(
        self,
        user: User,
        farm_id: int,
        date_from: Optional[str],
        date_to: Optional[str],
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        _require_farm(self.ctx, user, farm_id)
        weather = [
            item.to_dict()
            for item in self.ctx.weather.list(farm_id)
            if _within(item.recorded_at, date_from, date_to)
        ]
        recommendations = [
            item.to_dict()
            for item in self.ctx.recommendations.list(farm_id)
            if _within(item.created_at, date_from, date_to)
        ]
        return weather, recommendations

    def summary(
        self,
        user: User,
        farm_id: int,
        date_from: Optional[str],
        date_to: Optional[str],
    ) -> Dict[str, Any]:
        weather, recommendations = self._rows(user, farm_id, date_from, date_to)

        def average(key: str) -> Optional[float]:
            values = [row[key] for row in weather if row.get(key) is not None]
            return round(sum(values) / len(values), 2) if values else None

        counts: Dict[str, int] = {}
        for row in recommendations:
            counts[row["recommended_crop"]] = counts.get(row["recommended_crop"], 0) + 1

        return {
            "farm_id": farm_id,
            "readings_count": len(weather),
            "avg_temperature": average("temperature"),
            "avg_humidity": average("humidity"),
            "avg_rainfall": average("rainfall"),
            # Soil moisture is collected by the IoT team; not stored by this backend.
            "avg_moisture": None,
            "recommendation_counts": counts,
            "timeline": [
                {
                    "created_at": row["created_at"],
                    "recommended_crop": row["recommended_crop"],
                    "confidence": row["confidence"],
                    "status": row["status"],
                }
                for row in recommendations
            ],
        }

    def export_csv(
        self,
        user: User,
        farm_id: int,
        date_from: Optional[str],
        date_to: Optional[str],
    ) -> str:
        _, recommendations = self._rows(user, farm_id, date_from, date_to)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "id",
                "farm_id",
                "created_at",
                "recommended_crop",
                "confidence",
                "status",
                "model_version",
            ]
        )
        for row in recommendations:
            writer.writerow(
                [
                    row["id"],
                    row["farm_id"],
                    row["created_at"],
                    row["recommended_crop"],
                    row["confidence"],
                    row["status"],
                    row["model_version"],
                ]
            )
        return output.getvalue()


class Services:
    """Facade used by the HTTP layer."""

    def __init__(self, ctx: ServiceContext):
        self.ctx = ctx
        self.auth = AuthService(ctx)
        self.farms = FarmService(ctx)
        self.weather = WeatherService(ctx)
        self.recommendations = RecommendationService(ctx)
        self.crops = CropService(ctx)
        self.admin = AdminService(ctx)
        self.reports = ReportService(ctx)
