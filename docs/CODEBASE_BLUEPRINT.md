# Codebase Blueprint — From Documentation to Implementation

> **Purpose.** Turn [`PROJECT_UNDERSTANDING.md`](./PROJECT_UNDERSTANDING.md) into an actionable build plan and audit what already exists. This is the working contract for the codebase: entities, API surface, ML artifacts, data flow, module layout, tests, and a prioritized gap list.
>
> **Stack assumption:** the repository already scaffolds **FastAPI + PostgreSQL (SQLAlchemy) + Next.js/TypeScript**. The proposal says Flask/MySQL/HTML-CSS-JS. This blueprint keeps the scaffolded stack but preserves 100% of the proposal's *behaviour* (FR-1…FR-10, two-model strategy, weather enrichment, buffering, roles, history). If the team chooses the proposal stack instead, the domain model, API contracts, and ML design below still apply — only framework-specific modules change.

---

## 1. Current code audit

### What exists

| Path | State | Notes |
|---|---|---|
| `backend/app/main.py` | Working | FastAPI app, CORS for `http://localhost:3000`, `/`, `/health`, mounts prediction router at `/api/v1`. |
| `backend/app/core/config.py` | Working | `APP_NAME`, `DEBUG`, `DATABASE_URL` (defaults PostgreSQL). Uses `pydantic-settings`. |
| `backend/app/schemas/crop.py` | Working | `CropInput` (N, P, K, temperature, humidity, ph, rainfall), `CropOption`, `CropPrediction`. |
| `backend/app/services/crop_service.py` | Working | Loads joblib artifact, predicts, returns top-3 with probabilities. **Fails at import if model file missing.** |
| `backend/app/routers/prediction.py` | Working | `POST /api/v1/predict`; applies `MIN_CONFIDENCE = 0.60` fallback message; wraps exceptions as HTTP 500. |
| `backend/app/ml/train_model.py` | Working | Single RandomForestClassifier (300 trees, balanced), 80/20 stratified split, joblib artifact + `model_metrics.json`. |
| `backend/app/database/database.py` | **Empty** | No engine/session/Base defined. |
| `backend/requirements.txt` | **Empty** | Dependencies only listed ad-hoc in README. |
| `frontend/` | **Only `.env.example`** | `NEXT_PUBLIC_API_URL=http://localhost:8000`. No app code. |
| `README.md` | Current | Documents prediction-only API and planned IoT integration. |

### Gap analysis — documented requirement → implementation status

| Documented requirement | Status | Action needed |
|---|---|---|
| FR-1 Register / login, authorization | ❌ Missing | Auth module, user model, password hashing, JWT or session. |
| FR-2 Collect soil data from sensors | ❌ Missing | Sensor ingestion endpoint + firmware JSON contract. |
| FR-3 Transmit field → server | ❌ Missing | HTTPS ingestion route + device auth + offline buffer replay. |
| FR-4 Acquire weather from external source | ❌ Missing | Open-Meteo client for coordinates + recent-rainfall summation. |
| FR-5 Store soil/weather/user/recommendation data | ❌ Missing | Database models + migrations (`database.py` is empty). |
| FR-6 Pre-process and validate readings | ⚠️ Partial | Pydantic ranges exist for manual input; no sensor-side range rejection or validation service. |
| FR-7 Use trained AI model | ✅ Present | Single 7-feature model only. |
| FR-8 Generate recommendations | ✅ Present | Top-3 with probabilities; confidence fallback present. |
| FR-9 Admin manages users/crops/params/datasets | ❌ Missing | Admin role + CRUD endpoints. |
| FR-10 View historical data & recommendations | ❌ Missing | History endpoints + dashboard views. |
| Two models (standard 4-feature + extended 7-feature) | ❌ Missing | Retrain and persist both; select by request type. |
| Five candidate algorithms + 5-fold CV + metrics | ❌ Missing | Extend training pipeline. |
| ≥90% target accuracy check | ❌ Missing | Assert/report in training. |
| Three roles (farmer, extension officer, admin) | ❌ Missing | Role model + authorization dependency. |
| Offline buffering on ESP32 | ❌ Missing | Firmware + batch/replay endpoint. |
| Stale weather marked out of date | ❌ Missing | Weather freshness metadata in API/UI. |
| Sensor calibration & pytest suite | ❌ Missing | Test scaffolding. |
| Dependencies pinned | ❌ Missing | Populate `requirements.txt`. |
| HTTPS in production | ❌ Missing | Deployment/config concern. |

---

## 2. Domain model (derived from Proposal §3.1.1 and §3.1.5)

The proposal names the tables explicitly: **users, farms, devices, sensor readings, weather readings, crops, recommendations**. Add two supporting entities implied by the requirements (roles are handled as a user field; audit/session data is optional).

```text
User ──< Farm >──< Device >──< SensorReading
  │                             
  ├── role: farmer | extension_officer | administrator
  ├── assigned_farms (extension officers)
  │
Farm ──< WeatherReading
Farm ──< Recommendation >── Crop
Recommendation ──< RecommendationCrop (rank, probability)   # top-3
User ──< Recommendation (who requested / for whom)
```

### Entity definitions (implementation sketch)

**User**
- `id` (PK), `email` (unique), `password_hash`, `full_name`, `role` (enum: `farmer`, `extension_officer`, `administrator`), `is_active`, `created_at`.
- Constraints: hashed passwords only (ethics §9.6); never store plaintext.

**Farm**
- `id` (PK), `owner_id` (FK → User), `name`, `latitude`, `longitude`, `location_name`, `created_at`.
- Coordinates are required for weather lookup.

**Device**
- `id` (PK), `farm_id` (FK → Farm), `device_key` (unique, hashed — used to authenticate sensor uploads), `firmware_version`, `last_seen_at`, `is_active`.

**SensorReading** (one row per averaged transmission)
- `id`, `device_id` (FK), `farm_id` (FK), `recorded_at`, `received_at`.
- `soil_moisture`, `soil_ph`, `air_temperature`, `relative_humidity`.
- `source`: `sensor` (from device). Values outside calibrated valid ranges are rejected at ingest.
- Note: soil moisture is **stored and displayed but never used as a model feature** (Table 3.1).

**WeatherReading**
- `id`, `farm_id` (FK), `observed_at`, `fetched_at`, `temperature`, `relative_humidity`, `rainfall_mm`, `rainfall_window_start`, `rainfall_window_end`, `source` (`open_meteo`), `is_stale` (bool).
- `is_stale` supports "show last known weather marked out of date" (§9.3).

**Crop**
- `id`, `name` (unique), `local_name`, `is_kenyan_supported` (bool), `agronomic_source` (e.g. KALRO / FAO EcoCrop), `requirement_notes`, `enabled`.

**Recommendation**
- `id`, `farm_id` (FK), `requested_by_user_id` (FK, nullable for automatic sensor-triggered runs), `sensor_reading_id` (FK, nullable), `weather_reading_id` (FK, nullable), `model_variant` (`standard` | `extended`), `created_at`, `npk_provided` (bool).

**RecommendationCrop**
- `id`, `recommendation_id` (FK), `crop_id` (FK), `rank` (1–3), `probability`.

### Data-write flow per reading

```text
ESP32 JSON POST (device_key)
   → authenticate device
   → validate + range-check (reject implausible)
   → insert SensorReading
   → fetch weather for farm coordinates (Open-Meteo)
       ├─ success → insert WeatherReading(is_stale=False)
       └─ failure → reuse latest WeatherReading(is_stale=True)
   → choose model variant:
       ├─ no NPK supplied → standard (pH, temp, humidity, rainfall)
       └─ NPK supplied   → extended (+ N, P, K)
   → predict top-3 → insert Recommendation + RecommendationCrop rows
   → dashboard reads latest recommendation + readings
```

---

## 3. API contract

Keep `/api/v1` prefix. Add these routes (grouped by router module).

### Existing — `prediction.py`
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/predict` | Manual 7-feature prediction (current behavior preserved). |

> Refactor note: this endpoint currently hardcodes the 7-feature service. Make it explicitly use the **extended** model (it requires NPK) so semantics match Table 3.1.

### New — `auth.py`
| Method | Path | Purpose | Role |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Create farmer account | public |
| POST | `/api/v1/auth/login` | Return token | public |
| GET | `/api/v1/auth/me` | Current user profile | any |

### New — `sensors.py` (firmware-facing)
| Method | Path | Purpose | Role |
|---|---|---|---|
| POST | `/api/v1/sensors/readings` | Single averaged reading (device auth) | device |
| POST | `/api/v1/sensors/readings/batch` | Replay buffered readings after outage | device |
| GET | `/api/v1/sensors/readings` | List readings for a farm | farmer / extension / admin |

**Single reading payload (the fixed JSON contract):**
```json
{
  "device_key": "<hashed device credential>",
  "recorded_at": "2026-11-20T10:00:00Z",
  "soil_moisture": 42.5,
  "soil_ph": 6.4,
  "air_temperature": 26.1,
  "relative_humidity": 68.0
}
```
The ESP32 takes several samples every 10 minutes, averages, rejects out-of-range values, and sends one record. Server re-validates defensively.

### New — `weather.py`
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/weather/latest?farm_id=` | Latest weather with `is_stale` flag |
| POST | `/api/v1/weather/refresh?farm_id=` | On-demand Open-Meteo fetch (admin / scheduled) |

### New — `recommendations.py`
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/recommendations/latest?farm_id=` | Latest recommendation + top-3 crops |
| GET | `/api/v1/recommendations?farm_id=&from=&to=` | History (FR-10) |

### New — `admin.py`
| Method | Path | Purpose | Role |
|---|---|---|---|
| CRUD | `/api/v1/admin/users` | Manage users (FR-9) | admin |
| CRUD | `/api/v1/admin/crops` | Manage crop catalogue / enabled crops | admin |
| CRUD | `/api/v1/admin/devices` | Register/rotate device keys | admin |
| GET/PUT | `/api/v1/admin/settings` | System parameters, supported crop list | admin |

### Response shape for recommendations
```json
{
  "recommended_crop": "maize",
  "confidence": 0.94,
  "model_variant": "standard",
  "weather_is_stale": false,
  "top_recommendations": [
    { "crop": "maize", "confidence": 0.94 },
    { "crop": "beans", "confidence": 0.04 },
    { "crop": "potato", "confidence": 0.02 }
  ],
  "created_at": "2026-11-20T10:00:12Z"
}
```
Preserve the existing low-confidence fallback text from `prediction.py` when confidence is below the threshold (currently `0.60`) — it is a good safety behaviour aligned with the "decision support, not guarantee" framing.

---

## 4. ML design (Proposal §3.1.3)

### Artifacts to produce
```text
backend/models/
  crop_standard.joblib      # features: ph, temperature, humidity, rainfall
  crop_extended.joblib      # features: N, P, K, temperature, humidity, ph, rainfall
  model_metrics.json        # both variants, all candidate models, CV + test results
```

### Training pipeline requirements
1. Load `backend/data/Crop_recommendation.csv` (2,200 rows, 22 crops, N/P/K/temp/humidity/ph/rainfall). **Not in repo** — add to `.gitignore` (already done) and document download.
2. Filter to Kenya-supported crops; verify against KALRO / FAO EcoCrop and extension-officer review. Track added crops (potato, tomato, kale) separately.
3. Clean: drop/flag missing and impossible values; remove duplicates.
4. Scale features where algorithms need it (use a `Pipeline` with `StandardScaler` for SVM/KNN; tree models do not require it).
5. For weather rainfall, aggregate to the same window as the dataset's `rainfall` feature — **fix and record the window** (e.g. 30-day sum) as a named setting.
6. Candidates: `DecisionTreeClassifier`, `KNeighborsClassifier`, `SVC(probability=True)`, `RandomForestClassifier`, `GradientBoostingClassifier`.
7. `train_test_split(stratify=y, test_size=0.2, random_state=42)` + `StratifiedKFold(n_splits=5)`.
8. Metrics: accuracy, macro precision, macro recall, macro F1, confusion matrix.
9. Select best per variant; assert/report against the **≥90% held-out accuracy target**.
10. Persist joblib artifacts including `model`, `features`, `classes`, `variant`, and training metadata (dataset hash, crop list, rainfall window).

### Service design
Replace the single global `crop_service` with a registry:
```python
models = {
    "standard": load_artifact("crop_standard.joblib"),
    "extended": load_artifact("crop_extended.joblib"),
}
```
- `predict(values, variant)` builds a DataFrame in the artifact's exact feature order, returns top-3 with probabilities.
- Load lazily or with a clear startup error; current import-time failure (`crop_service = CropRecommendationService()`) means the whole API cannot start without a model file. Prefer lifespan startup with a helpful error, or allow `/health` to report `model_loaded: false`.
- Add `GET /health` fields: database connectivity, model variants loaded, weather client configured.

### Why two models (non-negotiable design point)
- Hardware measures pH, temperature, humidity, soil moisture. Rainfall comes from weather API. **NPK is not sensed** → standard model must work without it.
- Soil moisture is **not in the training dataset** → including it would be invalid; store/display only.
- Extended model is opt-in when the user supplies a soil-test report.

---

## 5. Firmware contract (ESP32, C/C++)

- Sensors: capacitive soil moisture (analog → ADC1), soil pH probe + signal board (analog → ADC1), DHT22 (digital).
- **Use ADC1 pins only** — ADC2 is disabled while Wi-Fi is active.
- Loop: every 10 minutes take several samples per sensor, average, discard out-of-range values, build JSON (see §3), POST over HTTPS.
- On POST failure: append to a local ring buffer (persist to flash/NVS if possible); on reconnect, POST to `/sensors/readings/batch` oldest-first; de-duplicate server-side by `(device_key, recorded_at)`.
- Include `device_key` in every request; never embed user passwords.
- Calibration constants (pH buffers 4.01/6.86, moisture dry/wet references, DHT22 reference comparison) live in firmware config and are recorded during testing.

---

## 6. Recommended module layout

```text
backend/
  app/
    main.py                     # app factory, CORS, lifespan, router registration
    core/
      config.py                 # + weather/settings/DB/JWT config
      security.py               # password hashing, JWT, role dependencies
    database/
      database.py               # engine, SessionLocal, Base  (currently empty)
      models.py                 # all entities from §2
      migrations/               # Alembic
    schemas/
      crop.py                   # existing; extend with variant/weather fields
      user.py, sensor.py, weather.py, recommendation.py, admin.py
    services/
      crop_service.py           # model registry (refactor existing)
      weather_service.py        # Open-Meteo client + rainfall aggregation
      recommendation_service.py # orchestrates reading → prediction → persistence
      sensor_service.py         # validation, buffering replay, de-dup
    routers/
      prediction.py (existing), auth.py, sensors.py,
      weather.py, recommendations.py, admin.py
    ml/
      train_model.py            # extend to two variants + 5 candidates + CV
    tests/
      test_validation.py, test_api.py, test_services.py, test_model.py
  data/          (gitignored) Crop_recommendation.csv
  models/        (gitignored) *.joblib, model_metrics.json
  requirements.txt               # populate + pin

frontend/
  app/ or src/                   # Next.js + TypeScript dashboard
    pages/ login, dashboard, history, admin
    components/ ReadingCard, TrendChart, RecommendationPanel, StaleBadge
    lib/api.ts                   # uses NEXT_PUBLIC_API_URL
```

---

## 7. Configuration to add

| Setting | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | existing | `postgresql://…` |
| `SECRET_KEY` / `JWT_ALGORITHM` / `ACCESS_TOKEN_EXPIRE_MINUTES` | auth | — |
| `OPEN_METEO_URL`, `WEATHER_REQUEST_TIMEOUT`, `RAINFALL_WINDOW_DAYS` | weather | `https://api.open-meteo.com/v1/forecast`, 10s, 30 |
| `MIN_CONFIDENCE` | promote from router constant to config | `0.60` |
| `SENSOR_READING_INTERVAL_MINUTES` | matches firmware | `10` |
| `MODEL_DIR`, `STANDARD_MODEL_FILE`, `EXTENDED_MODEL_FILE` | ML loading | — |
| `CORS_ORIGINS` | replace hardcoded localhost list | `http://localhost:3000` |

---

## 8. Testing plan (Proposal §9.5)

| Layer | Tool / approach |
|---|---|
| Sensor calibration | pH 4.01 & 6.86 buffers; moisture dry/wet refs; DHT22 vs reference thermometer; record error per sensor. (Manual procedure doc + calibration constants.) |
| Validation / API | `pytest` with TestClient: invalid, missing, out-of-range inputs; unauthorized access; role enforcement; device-key rejection. |
| Model | CV + held-out metrics for both variants; confusion matrices; accuracy target check. |
| Integration | Sensor POST → DB → weather → model → dashboard within **60 seconds**. |
| Resilience | Simulate Wi-Fi loss (batch replay), weather-service failure (`is_stale` surfaced), faulty sensor (range rejection) — no crash, no stale-as-current. |
| Pilot / usability | ≥2 weeks; farmer + extension-officer questionnaire; recommendations vs local knowledge. |

---

## 9. Prioritized build order

**P0 — make the documented core work**
1. Populate `requirements.txt`; make `config.py` complete; implement `database.py` + models + Alembic migration.
2. Refactor ML training to two variants + candidate comparison + CV + metrics; produce both artifacts.
3. Refactor `crop_service` into a variant-aware registry; make `/health` report model/DB status.
4. Implement weather service (Open-Meteo) with rainfall window and `is_stale` behaviour.
5. Implement sensor ingestion (single + batch) with device auth and validation.

**P1 — requirements that are explicitly core, not optional**
6. Auth + three roles + admin CRUD (FR-1, FR-9).
7. Recommendation persistence + history endpoints (FR-5, FR-10).
8. Dashboard: login, latest readings + trends, top-3 recommendation with stale/confidence badges, history view, admin screens.

**P2 — validation and hardening**
9. pytest suite; integration + resilience simulation; calibration procedure.
10. HTTPS deployment, Data Protection Act compliance review, pilot usability study.

**Optional / droppable (per §9.7):** GSM connectivity, additional crops beyond the Kenya-supported set.

---

## 10. Acceptance criteria checklist

- [ ] A device POST produces a stored reading, a weather lookup, a recommendation, and a dashboard update within 60 seconds.
- [ ] Standard recommendation works with no NPK; extended works when NPK is entered from a soil test.
- [ ] Soil moisture appears on the dashboard but is absent from both model feature lists.
- [ ] Top three crops with probabilities are always returned; low confidence yields the safety message.
- [ ] Weather-service failure shows last known weather explicitly marked out of date.
- [ ] Buffered readings replay after a simulated outage with no duplicates.
- [ ] Farmer, extension officer, and admin see only their permitted data/functions.
- [ ] Historical readings and recommendations are viewable.
- [ ] Both models report CV + held-out metrics; ≥90% target is checked and documented.
- [ ] Passwords hashed, HTTPS used, farm data access restricted to owner/assigned officer/admin.
