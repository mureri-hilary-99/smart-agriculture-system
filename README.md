# Smart Agriculture Crop Recommendation System

An IoT and AI-based crop recommendation system designed to help farmers identify suitable crops using soil and environmental conditions.

## Current features

- FastAPI backend with documented REST endpoints
- Scikit-learn Random Forest crop classifier
- Crop prediction using:
  - Nitrogen (N)
  - Phosphorus (P)
  - Potassium (K)
  - Temperature
  - Humidity
  - Soil pH
  - Rainfall
- Vanilla HTML, CSS and JavaScript field console
- Recommendation confidence and top alternative crops
- Planned ESP32, DHT22/DHT10, MQTT, and database integration

## Architecture

```text
Sensors / manual farm input
        ↓
HTML / CSS / JS dashboard
        ↓
FastAPI REST API
        ↓
Random Forest model
        ↓
Crop recommendation
```

## Local setup

### Backend

```cmd
cd backend
python -m venv .venv
.venv\Scripts\activate.bat
pip install "fastapi[standard]" uvicorn python-dotenv pydantic scikit-learn pandas numpy sqlalchemy asyncpg psycopg2-binary python-multipart joblib requests
copy .env.example .env
uvicorn app.main:app --reload
```

Open the generated interactive API reference at:

```text
http://localhost:8000/docs
```

The full API contract for frontend and database work — including implemented endpoints, proposal-derived endpoints, shared schemas, and the proposed database mapping — is in [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md).

### Model training

1. Download a compatible Crop Recommendation Dataset from Kaggle.
2. Place `Crop_recommendation.csv` in `backend/data/`.
3. Train:

```cmd
cd backend
.venv\Scripts\activate.bat
python app\ml\train_model.py
```

### Frontend

The field console uses plain HTML, CSS and JavaScript — no build step or package install.

```cmd
cd frontend
python -m http.server 3000
```

Open the dashboard at:

```text
http://localhost:3000
```

Set the API base URL and bearer token with the **Connection** button in the top bar. Route-to-endpoint mapping and design notes are in [`frontend/README.md`](frontend/README.md).

## Important notice

The recommendation is a machine-learning decision-support output, not a planting guarantee. Validate recommendations using local soil tests, seasonality, rainfall forecasts, water availability, local crop suitability, pest risk, extension officers, and market conditions.

## Planned IoT integration

```text
DHT22/DHT10 + NPK + pH + soil moisture sensors
        ↓
ESP32
        ↓
MQTT / AWS IoT Core
        ↓
FastAPI ingestion API
        ↓
Database and real-time dashboard
```