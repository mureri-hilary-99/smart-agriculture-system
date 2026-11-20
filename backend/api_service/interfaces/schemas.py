"""Request schemas — validation boundary for all HTTP endpoints."""
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: str = Field(..., pattern=EMAIL_PATTERN)
    password: str = Field(..., min_length=8, max_length=128)
    phone: Optional[str] = Field(default=None, max_length=40)
    location: Optional[str] = Field(default=None, max_length=160)
    county: Optional[str] = Field(default=None, max_length=80)


class LoginRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_PATTERN)
    password: str = Field(..., min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=40)
    location: Optional[str] = Field(default=None, max_length=160)
    county: Optional[str] = Field(default=None, max_length=80)

    def as_updates(self) -> Dict[str, Any]:
        return self.model_dump(exclude_none=True)


class AdminUserUpdateRequest(BaseModel):
    role: Optional[Literal["farmer", "extension_officer", "admin"]] = None
    is_active: Optional[bool] = None

    def as_updates(self) -> Dict[str, Any]:
        return self.model_dump(exclude_none=True)


class FarmCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    county: Optional[str] = Field(default=None, max_length=80)


class FarmUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    county: Optional[str] = Field(default=None, max_length=80)

    def as_updates(self) -> Dict[str, Any]:
        return self.model_dump(exclude_none=True)


class WeatherRefreshRequest(BaseModel):
    farm_id: int = Field(..., gt=0)


class RecommendationCreateRequest(BaseModel):
    farm_id: int = Field(..., gt=0)
    source: Literal["latest", "manual"] = "latest"
    inputs: Dict[str, float] = Field(default_factory=dict)


class CropCreateRequest(BaseModel):
    code: str = Field(..., min_length=2, max_length=60)
    name: str = Field(..., min_length=2, max_length=120)
    local_name: Optional[str] = Field(default=None, max_length=120)
    optimal: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class CropUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    local_name: Optional[str] = Field(default=None, max_length=120)
    optimal: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

    def as_updates(self) -> Dict[str, Any]:
        return self.model_dump(exclude_none=True)


class DatasetCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=160)
    file_uri: str = Field(..., min_length=1, max_length=500)
    rows_count: Optional[int] = Field(default=None, ge=0)


class SystemParamsUpdateRequest(BaseModel):
    params: Dict[str, Any]
