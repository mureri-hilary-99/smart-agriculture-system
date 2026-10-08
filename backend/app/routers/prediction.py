from fastapi import APIRouter, HTTPException

from app.schemas.crop import CropInput, CropPrediction
from app.services.crop_service import crop_service

router = APIRouter()

MIN_CONFIDENCE = 0.60


@router.post("/predict", response_model=CropPrediction)
def predict_crop(data: CropInput):
    try:
        result = crop_service.predict(data.model_dump())

        if result["confidence"] < MIN_CONFIDENCE:
            result["recommended_crop"] = (
                "No reliable crop recommendation—collect more local soil and climate data"
            )

        return result

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not generate crop recommendation: {str(error)}"
        )