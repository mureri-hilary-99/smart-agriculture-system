from pydantic import BaseModel, Field


class CropInput(BaseModel):
    N: float = Field(..., ge=0, description="Nitrogen content in soil")
    P: float = Field(..., ge=0, description="Phosphorus content in soil")
    K: float = Field(..., ge=0, description="Potassium content in soil")
    temperature: float = Field(..., description="Air temperature in degrees Celsius")
    humidity: float = Field(..., ge=0, le=100, description="Relative humidity percentage")
    ph: float = Field(..., ge=0, le=14, description="Soil pH")
    rainfall: float = Field(..., ge=0, description="Rainfall in millimetres")


class CropOption(BaseModel):
    crop: str
    confidence: float


class CropPrediction(BaseModel):
    recommended_crop: str
    confidence: float
    top_recommendations: list[CropOption]