"""In-memory repository adapters.

These are NOT an ORM and NOT persistent. They exist so that every endpoint can
run today without the database service. The database team replaces these
adapters with ORM-backed implementations of the same contracts.
"""
import itertools
import threading
from typing import Dict, List, Optional

from api_service.domain.entities import (
    AuditLog,
    Crop,
    Dataset,
    Farm,
    Recommendation,
    SystemParam,
    User,
    WeatherReading,
)

# Kenya-relevant subset of the public Crop Recommendation Dataset classes.
SEED_CROPS = [
    ("maize", "Maize", "Mahindi", {"ph": [5.5, 7.5], "rainfall": [500, 1200], "temperature": [18, 32]}),
    ("beans", "Beans", "Maharage", {"ph": [5.5, 7.0], "rainfall": [350, 700], "temperature": [16, 28]}),
    ("potato", "Potato", "Viazi", {"ph": [5.0, 6.5], "rainfall": [500, 900], "temperature": [15, 25]}),
    ("tomato", "Tomato", "Nyanya", {"ph": [6.0, 7.0], "rainfall": [400, 800], "temperature": [20, 30]}),
    ("kale", "Kale", "Sukuma wiki", {"ph": [5.8, 7.0], "rainfall": [400, 800], "temperature": [15, 28]}),
    ("coffee", "Coffee", "Kahawa", {"ph": [5.5, 6.5], "rainfall": [1000, 1800], "temperature": [18, 26]}),
    ("banana", "Banana", "Ndizi", {"ph": [5.5, 7.0], "rainfall": [900, 1600], "temperature": [22, 32]}),
    ("sorghum", "Sorghum", "Mtama", {"ph": [5.5, 7.5], "rainfall": [300, 700], "temperature": [22, 35]}),
]


class _BaseMemoryRepository:
    def __init__(self):
        self._lock = threading.RLock()


class InMemoryUserRepository(_BaseMemoryRepository):
    def __init__(self):
        super().__init__()
        self._items: Dict[int, User] = {}
        self._ids = itertools.count(1)

    def add(self, user: User) -> User:
        with self._lock:
            user.id = next(self._ids)
            self._items[user.id] = user
            return user

    def get_by_id(self, user_id: int) -> Optional[User]:
        with self._lock:
            return self._items.get(user_id)

    def get_by_email(self, email: str) -> Optional[User]:
        with self._lock:
            needle = email.strip().lower()
            return next((u for u in self._items.values() if u.email.lower() == needle), None)

    def list(self) -> List[User]:
        with self._lock:
            return list(self._items.values())

    def update(self, user: User) -> User:
        with self._lock:
            if user.id not in self._items:
                raise KeyError(user.id)
            self._items[user.id] = user
            return user


class InMemoryFarmRepository(_BaseMemoryRepository):
    def __init__(self):
        super().__init__()
        self._items: Dict[int, Farm] = {}
        self._ids = itertools.count(1)

    def add(self, farm: Farm) -> Farm:
        with self._lock:
            farm.id = next(self._ids)
            self._items[farm.id] = farm
            return farm

    def get(self, farm_id: int) -> Optional[Farm]:
        with self._lock:
            return self._items.get(farm_id)

    def list_all(self) -> List[Farm]:
        with self._lock:
            return list(self._items.values())

    def update(self, farm: Farm) -> Farm:
        with self._lock:
            if farm.id not in self._items:
                raise KeyError(farm.id)
            self._items[farm.id] = farm
            return farm


class InMemoryWeatherRepository(_BaseMemoryRepository):
    def __init__(self):
        super().__init__()
        self._items: Dict[int, WeatherReading] = {}
        self._ids = itertools.count(1)

    def add(self, reading: WeatherReading) -> WeatherReading:
        with self._lock:
            reading.id = next(self._ids)
            self._items[reading.id] = reading
            return reading

    def latest(self, farm_id: int) -> Optional[WeatherReading]:
        with self._lock:
            matches = [r for r in self._items.values() if r.farm_id == farm_id]
            return max(matches, key=lambda r: r.id) if matches else None

    def list(self, farm_id: int) -> List[WeatherReading]:
        with self._lock:
            return [r for r in self._items.values() if r.farm_id == farm_id]

    def invalidate_stale(self, farm_id: int) -> None:
        with self._lock:
            for reading in self._items.values():
                if reading.farm_id == farm_id:
                    reading.is_stale = True


class InMemoryRecommendationRepository(_BaseMemoryRepository):
    def __init__(self):
        super().__init__()
        self._items: Dict[int, Recommendation] = {}
        self._ids = itertools.count(1)

    def add(self, recommendation: Recommendation) -> Recommendation:
        with self._lock:
            recommendation.id = next(self._ids)
            self._items[recommendation.id] = recommendation
            return recommendation

    def get(self, recommendation_id: int) -> Optional[Recommendation]:
        with self._lock:
            return self._items.get(recommendation_id)

    def latest(self, farm_id: int) -> Optional[Recommendation]:
        with self._lock:
            matches = [r for r in self._items.values() if r.farm_id == farm_id]
            return max(matches, key=lambda r: r.id) if matches else None

    def list(self, farm_id: int) -> List[Recommendation]:
        with self._lock:
            return [r for r in self._items.values() if r.farm_id == farm_id]


class InMemoryCropRepository(_BaseMemoryRepository):
    def __init__(self):
        super().__init__()
        self._items: Dict[str, Crop] = {}
        self._ids = itertools.count(1)
        for code, name, local_name, optimal in SEED_CROPS:
            crop = Crop(
                id=next(self._ids),
                code=code,
                name=name,
                local_name=local_name,
                optimal=optimal,
            )
            self._items[code] = crop

    def add(self, crop: Crop) -> Crop:
        with self._lock:
            crop.id = next(self._ids)
            self._items[crop.code] = crop
            return crop

    def get_by_code(self, code: str) -> Optional[Crop]:
        with self._lock:
            return self._items.get(code)

    def list(self) -> List[Crop]:
        with self._lock:
            return list(self._items.values())

    def update(self, crop: Crop) -> Crop:
        with self._lock:
            if crop.code not in self._items:
                raise KeyError(crop.code)
            self._items[crop.code] = crop
            return crop

    def delete(self, code: str) -> bool:
        with self._lock:
            return self._items.pop(code, None) is not None


class InMemorySystemParamRepository(_BaseMemoryRepository):
    def __init__(self):
        super().__init__()
        self._items: Dict[str, SystemParam] = {
            "min_confidence": SystemParam(key="min_confidence", value=0.60),
            "weather_cache_ttl_seconds": SystemParam(
                key="weather_cache_ttl_seconds", value=600
            ),
            "sensor_reading_interval_minutes": SystemParam(
                key="sensor_reading_interval_minutes", value=10
            ),
        }

    def all(self) -> Dict[str, SystemParam]:
        with self._lock:
            return dict(self._items)

    def get(self, key: str) -> Optional[SystemParam]:
        with self._lock:
            return self._items.get(key)

    def set(self, key: str, value, updated_by: Optional[int]) -> SystemParam:
        with self._lock:
            param = SystemParam(key=key, value=value, updated_by=updated_by)
            self._items[key] = param
            return param


class InMemoryDatasetRepository(_BaseMemoryRepository):
    def __init__(self):
        super().__init__()
        self._items: Dict[int, Dataset] = {}
        self._ids = itertools.count(1)

    def add(self, dataset: Dataset) -> Dataset:
        with self._lock:
            dataset.id = next(self._ids)
            self._items[dataset.id] = dataset
            return dataset

    def list(self) -> List[Dataset]:
        with self._lock:
            return list(self._items.values())


class InMemoryAuditLogRepository(_BaseMemoryRepository):
    def __init__(self):
        super().__init__()
        self._items: Dict[int, AuditLog] = {}
        self._ids = itertools.count(1)

    def add(self, log: AuditLog) -> AuditLog:
        with self._lock:
            log.id = next(self._ids)
            self._items[log.id] = log
            return log

    def list(self) -> List[AuditLog]:
        with self._lock:
            return list(self._items.values())
