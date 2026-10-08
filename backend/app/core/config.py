from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    APP_NAME: str = "Smart Agriculture API"
    DEBUG: bool = True
    DATABASE_URL: str = "postgresql://postgres:yourpassword@localhost:5432/crop_recommendation"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()