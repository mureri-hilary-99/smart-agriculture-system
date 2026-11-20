"""Repository interfaces.

The database team implements these classes with an ORM of their choosing. The
application layer depends only on these contracts, never on a concrete store.
"""
from abc import ABC, abstractmethod
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


class UserRepository(ABC):
    @abstractmethod
    def add(self, user: User) -> User: ...

    @abstractmethod
    def get_by_id(self, user_id: int) -> Optional[User]: ...

    @abstractmethod
    def get_by_email(self, email: str) -> Optional[User]: ...

    @abstractmethod
    def list(self) -> List[User]: ...

    @abstractmethod
    def update(self, user: User) -> User: ...


class FarmRepository(ABC):
    @abstractmethod
    def add(self, farm: Farm) -> Farm: ...

    @abstractmethod
    def get(self, farm_id: int) -> Optional[Farm]: ...

    @abstractmethod
    def list_all(self) -> List[Farm]: ...

    @abstractmethod
    def update(self, farm: Farm) -> Farm: ...


class WeatherRepository(ABC):
    @abstractmethod
    def add(self, reading: WeatherReading) -> WeatherReading: ...

    @abstractmethod
    def latest(self, farm_id: int) -> Optional[WeatherReading]: ...

    @abstractmethod
    def list(self, farm_id: int) -> List[WeatherReading]: ...

    @abstractmethod
    def invalidate_stale(self, farm_id: int) -> None: ...


class RecommendationRepository(ABC):
    @abstractmethod
    def add(self, recommendation: Recommendation) -> Recommendation: ...

    @abstractmethod
    def get(self, recommendation_id: int) -> Optional[Recommendation]: ...

    @abstractmethod
    def latest(self, farm_id: int) -> Optional[Recommendation]: ...

    @abstractmethod
    def list(self, farm_id: int) -> List[Recommendation]: ...


class CropRepository(ABC):
    @abstractmethod
    def add(self, crop: Crop) -> Crop: ...

    @abstractmethod
    def get_by_code(self, code: str) -> Optional[Crop]: ...

    @abstractmethod
    def list(self) -> List[Crop]: ...

    @abstractmethod
    def update(self, crop: Crop) -> Crop: ...

    @abstractmethod
    def delete(self, code: str) -> bool: ...


class SystemParamRepository(ABC):
    @abstractmethod
    def all(self) -> Dict[str, SystemParam]: ...

    @abstractmethod
    def get(self, key: str) -> Optional[SystemParam]: ...

    @abstractmethod
    def set(self, key: str, value, updated_by: Optional[int]) -> SystemParam: ...


class DatasetRepository(ABC):
    @abstractmethod
    def add(self, dataset: Dataset) -> Dataset: ...

    @abstractmethod
    def list(self) -> List[Dataset]: ...


class AuditLogRepository(ABC):
    @abstractmethod
    def add(self, log: AuditLog) -> AuditLog: ...

    @abstractmethod
    def list(self) -> List[AuditLog]: ...
