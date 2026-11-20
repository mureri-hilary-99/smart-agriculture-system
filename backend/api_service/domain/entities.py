"""Framework-neutral domain entities (plain dataclasses, no ORM)."""
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class Role:
    FARMER = "farmer"
    EXTENSION_OFFICER = "extension_officer"
    ADMIN = "admin"
    ALL = (FARMER, EXTENSION_OFFICER, ADMIN)


@dataclass
class User:
    id: int
    full_name: str
    email: str
    password_hash: str = field(default="", repr=False)
    phone: Optional[str] = None
    location: Optional[str] = None
    county: Optional[str] = None
    role: str = Role.FARMER
    is_active: bool = True
    created_at: str = field(default_factory=utcnow)

    def public(self) -> Dict[str, Any]:
        data = asdict(self)
        data.pop("password_hash", None)
        return data


@dataclass
class Farm:
    id: int
    owner_user_id: int
    name: str
    latitude: float
    longitude: float
    county: Optional[str] = None
    created_at: str = field(default_factory=utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class WeatherReading:
    id: int
    farm_id: int
    recorded_at: str
    temperature: float
    humidity: float
    rainfall: float
    source: str = "provider"
    provider: Optional[str] = None
    is_stale: bool = False
    warning: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Recommendation:
    id: int
    farm_id: int
    recommended_crop: str
    confidence: float
    top_recommendations: List[Dict[str, Any]] = field(default_factory=list)
    soil_reading_id: Optional[int] = None
    weather_reading_id: Optional[int] = None
    requested_by_user_id: Optional[int] = None
    status: str = "ok"
    advice: Optional[str] = None
    model_version: str = "unknown"
    created_at: str = field(default_factory=utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Crop:
    id: int
    code: str
    name: str
    local_name: Optional[str] = None
    optimal: Dict[str, List[float]] = field(default_factory=dict)
    is_active: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Dataset:
    id: int
    name: str
    file_uri: str
    rows_count: Optional[int] = None
    status: str = "registered"
    uploaded_by: Optional[int] = None
    created_at: str = field(default_factory=utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SystemParam:
    key: str
    value: Any
    updated_by: Optional[int] = None
    updated_at: str = field(default_factory=utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AuditLog:
    id: int
    actor_user_id: Optional[int]
    action: str
    entity: str
    entity_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Page:
    items: List[Dict[str, Any]]
    total: int
    page: int
    page_size: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "items": self.items,
            "total": self.total,
            "page": self.page,
            "page_size": self.page_size,
        }


def paginate(items: List[Any], page: int, page_size: int) -> Page:
    """Apply in-memory pagination to a list of dicts or entities with to_dict()."""
    total = len(items)
    start = (page - 1) * page_size
    chunk = items[start : start + page_size]
    rendered = [item if isinstance(item, dict) else item.to_dict() for item in chunk]
    return Page(items=rendered, total=total, page=page, page_size=page_size)
