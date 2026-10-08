from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers.prediction import router as prediction_router

app = FastAPI(
    title=settings.APP_NAME,
    description="Smart Agriculture Crop Recommendation API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "Smart Agriculture API is running!",
        "status": "healthy"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


app.include_router(
    prediction_router,
    prefix="/api/v1",
    tags=["crop prediction"]
)