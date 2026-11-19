# Smart Agriculture — API Documentation

**System:** IoT and AI-Based Crop Recommendation System (Kenya smallholder farms)  
**API version:** `v1` · **Document status:** design contract (implemented + proposal-derived)  
**Backend:** FastAPI (`backend/app/main.py`) · **Model:** scikit-learn Random Forest

> **Feasibility confirmation:** Feasible. The codebase already exposes a working prediction API, and the proposal defines the remaining functional needs (auth, IoT ingestion, weather, storage, history, admin, reports). The frontend directory is currently empty and `app/database/database.py` is blank, so this document acts as the contract for building those layers rather than a description of finished code.

---

## 1. Ground truth and legend

| Source | What it gives us |
|---|---|
| `backend/app/main.py` | Root/health endpoints, CORS, `/api/v1` router mount |
| `backend/app/routers/prediction.py` | `POST /api/v1/predict`, 0.60 confidence gate |
| `backend/app/schemas/crop.py` | Exact request/response fields for prediction |
| `backend/app/services/crop_service.py` | Model behaviour, top-3 alternatives, rounding |
| `backend/app/ml/train_model.py` | Feature order, classes, metrics artifact |
| `PROJECT_REQUIREMENTS.md` / proposal `.docx` | Required auth, roles, IoT, weather, persistence, history, admin, reports |

**Status legend**

- ✅ **Implemented** — exists in code today
- ⚙️ **Generated** — provided automatically by FastAPI
- 📋 **Planned** — required by the proposal, not yet implemented
- ⏸️ **Deferred** — mentioned in literature review but outside core scope

Machine-readable spec for implemented endpoints: `GET /openapi.json` (also `/docs`, `/redoc`).

### 1.1 Confirmation status

| Part of this document | Confirmed? | Basis |
|---|---|---|
| `GET /`, `GET /health`, `POST /api/v1/predict`, request/response fields, validation rules, 0.60 threshold, top-3 behaviour, CORS | **Yes — source-confirmed** | Direct inspection of `main.py`, `prediction.py`, `crop.py`, `crop_service.py`, `train_model.py` on 2026-11-20 |
| Runtime `/openapi.json` comparison | **Not verified in this environment** | `fastapi`/`pydantic`/`joblib`/`pandas`/`sklearn` are not installed; `backend/models/crop_random_forest.joblib` and `backend/data/Crop_recommendation.csv` are absent. Follow README setup, train the model, then compare |
| Auth, farms, devices, ingestion, weather, history, admin, datasets, reports, audit | **No — proposed, not backend-confirmed** | Derived from the proposal's functional requirements; these endpoints do not exist in the codebase yet |
| Database tables/indexes | **No — proposed** | `backend/app/database/database.py` is empty; engine choice is still unresolved |

> Do not treat 📋 rows as existing backend routes. They are the agreed design target for implementing the frontend and database layers.

---

## 2. Conventions

| Item | Rule |
|---|---|
| Base URL (dev) | `http://localhost:8000` |
| Version prefix | `/api/v1` (system checks are unversioned) |
| Content type | `application/json`; UTF-8 |
| Timestamps | ISO 8601 UTC, e.g. `2026-11-20T09:30:00Z` |
| IDs | Integer primary keys, returned as `id` / `*_id` |
| Auth (planned) | `Authorization: Bearer <JWT>` for user endpoints; `X-Device-Key: <key>` for ESP32 ingestion |
| Roles (planned) | `farmer`, `extension_officer`, `admin` |
| Pagination | `?page=1&page_size=50` → `{ "items": [], "total": 0, "page": 1, "page_size": 50 }` |
| Date filters | `?from=2026-11-01&to=2026-11-20` (inclusive) |
| CORS today | Only `http://localhost:3000` is allowed (`main.py`) |
| Error body today | FastAPI default: `{"detail": "..."}` or `{"detail": [...]}` for 422 |
| Error body target | Keep `detail`; add optional `code`, `request_id` without breaking clients |

**Units and input scale**

| Field | Unit / meaning | Constraint |
|---|---|---|
| `N`, `P`, `K` | Nutrient values on the **same scale as the training dataset** (treat as ppm/dataset-scaled until confirmed) | `>= 0` |
| `temperature` | Air temperature, °C | any float today; planned `-20…60` |
| `humidity` | Relative humidity, % | `0…100` |
| `ph` | Soil pH | `0…14` |
| `rainfall` | Rainfall, mm | `>= 0` |
| `soil_moisture` | Sensor moisture, % | `0…100` — displayed/stored, **not used by current model** |

> ⚠️ The model was trained on `N, P, K, temperature, humidity, ph, rainfall`. Soil moisture from the ESP32 is a proposal requirement but is **not** a current model feature. Keep it in the DB and UI; add it to the model only after retraining.

---

## 3. Endpoint index

| # | Method | Path | Status | Auth (target) | Purpose |
|---:|---|---|---|---|---|
| 1 | GET | `/` | ✅ | none | Service banner / smoke check |
| 2 | GET | `/health` | ✅ | none | Liveness check |
| 3 | POST | `/api/v1/predict` | ✅ | none today → user | Manual crop prediction from 7 model features |
| 4 | GET | `/docs`, `/redoc`, `/openapi.json` | ⚙️ | none | Generated API reference |
| 5 | POST | `/api/v1/auth/register` | 📋 | none | Create account (default role `farmer`) |
| 6 | POST | `/api/v1/auth/login` | 📋 | none | Issue access/refresh tokens |
| 7 | POST | `/api/v1/auth/refresh` | 📋 | refresh token | Rotate access token |
| 8 | GET | `/api/v1/auth/me` | 📋 | user | Current profile + role |
| 9 | PATCH | `/api/v1/users/me` | 📋 | user | Update profile/phone/location |
| 10 | GET | `/api/v1/admin/users` | 📋 | admin | List users |
| 11 | PATCH | `/api/v1/admin/users/{user_id}` | 📋 | admin | Change role / active status |
| 12 | GET | `/api/v1/farms` | 📋 | user (own) | List farms |
| 13 | POST | `/api/v1/farms` | 📋 | user | Create farm with location |
| 14 | GET | `/api/v1/farms/{farm_id}` | 📋 | user (owner) | Farm detail |
| 15 | PATCH | `/api/v1/farms/{farm_id}` | 📋 | user (owner) | Update farm |
| 16 | POST | `/api/v1/devices/ingestions` | 📋 | device key | ESP32 batch upload + validation + inference |
| 17 | GET | `/api/v1/devices` | 📋 | user/admin | List registered devices |
| 18 | POST | `/api/v1/devices` | 📋 | admin | Register device, issue key |
| 19 | GET | `/api/v1/soil-readings` | 📋 | user | Historical soil/environment readings |
| 20 | GET | `/api/v1/soil-readings/latest` | 📋 | user | Most recent reading per farm |
| 21 | GET | `/api/v1/weather/current` | 📋 | user | Current weather for farm location |
| 22 | GET | `/api/v1/weather` | 📋 | user | Historical weather readings |
| 23 | POST | `/api/v1/weather/refresh` | 📋 | admin/system | Fetch from external weather provider |
| 24 | POST | `/api/v1/recommendations` | 📋 | user | Generate + persist recommendation |
| 25 | GET | `/api/v1/recommendations` | 📋 | user | Recommendation history |
| 26 | GET | `/api/v1/recommendations/latest` | 📋 | user | Latest recommendation for a farm |
| 27 | GET | `/api/v1/recommendations/{id}` | 📋 | user | Single recommendation detail |
| 28 | GET | `/api/v1/crops` | 📋 | user | Crop catalogue / suitability ranges |
| 29 | GET | `/api/v1/crops/{code}` | 📋 | user | One crop detail |
| 30 | POST / PATCH / DELETE | `/api/v1/crops[/{code}]` | 📋 | admin | Manage crop catalogue |
| 31 | GET / PATCH | `/api/v1/admin/system-params` | 📋 | admin | Confidence threshold, refresh interval, alert limits |
| 32 | GET / POST | `/api/v1/admin/datasets` | 📋 | admin | Dataset registry for retraining |
| 33 | GET | `/api/v1/model/info` | 📋 | user | Model version, features, classes, test accuracy |
| 34 | GET | `/api/v1/reports/summary` | 📋 | user/admin | Aggregated readings + recommendations |
| 35 | GET | `/api/v1/reports/export` | 📋 | user/admin | CSV export |
| 36 | GET | `/api/v1/audit-logs` | 📋 | admin | Admin/data-change audit trail |

⏸️ Deferred (literature-derived, not in core proposal scope): alert thresholds/notifications, irrigation control, pest/disease detection, fertiliser guidance, market prices, equipment automation.

---

## 4. Implemented endpoints — exact contract

### 4.1 `GET /`

**Response `200`**

```json
{ "message": "Smart Agriculture API is running!", "status": "healthy" }
```

### 4.2 `GET /health`

**Response `200`**

```json
{ "status": "healthy" }
```

### 4.3 `POST /api/v1/predict`

Manual prediction using the seven trained features. Public today; no persistence occurs.

**Request body** (`CropInput`)

```json
{
  "N": 90,
  "P": 40,
  "K": 40,
  "temperature": 25.6,
  "humidity": 62.3,
  "ph": 6.8,
  "rainfall": 120.0
}
```

**Validation (enforced by Pydantic)**

| Field | Rule | Error code |
|---|---|---|
| `N`, `P`, `K` | `ge=0` | 422 |
| `humidity` | `0 <= x <= 100` | 422 |
| `ph` | `0 <= x <= 14` | 422 |
| `rainfall` | `ge=0` | 422 |
| `temperature` | required float (no range in current code) | 422 |

**Response `200`** (`CropPrediction`)

```json
{
  "recommended_crop": "rice",
  "confidence": 0.9123,
  "top_recommendations": [
    { "crop": "rice",  "confidence": 0.9123 },
    { "crop": "jute",  "confidence": 0.0412 },
    { "crop": "cotton", "confidence": 0.0231 }
  ]
}
```

**Low-confidence response** — when `confidence < 0.60`, `recommended_crop` is replaced with the exact sentinel below; `confidence` and `top_recommendations` remain the model's raw output (rounded to 4 dp).

```json
{
  "recommended_crop": "No reliable crop recommendation—collect more local soil and climate data",
  "confidence": 0.4127,
  "top_recommendations": [ "…" ]
}
```

**Errors**

| Status | Body | Cause |
|---|---|---|
| 422 | `{"detail": [...]}` | Pydantic validation failure |
| 500 | `{"detail": "Could not generate crop recommendation: ..."}` | Model load/inference failure (e.g. missing `backend/models/crop_random_forest.joblib`) |

**Frontend notes**

- Treat any `recommended_crop` equal to the sentinel string as "no reliable advice" — show a "collect more data / consult extension officer" state.
- Do not sort `top_recommendations`; it is already descending.
- Keep user-entered N/P/K on the training scale; unit labels should say "dataset-scaled nutrient value" until the dataset units are confirmed.

---

## 5. Planned endpoints — grouped contract

### 5.1 Authentication and users

| Method | Path | Request | Response `200/201` | Notes |
|---|---|---|---|---|
| POST | `/api/v1/auth/register` | `{full_name, email, password, phone?, location?, county?}` | `{id, email, full_name, role, created_at}` | Public; default role `farmer`; 409 on duplicate email |
| POST | `/api/v1/auth/login` | `{email, password}` | `{access_token, refresh_token, token_type, expires_in, user}` | 401 on bad credentials |
| POST | `/api/v1/auth/refresh` | `{refresh_token}` | `{access_token, expires_in}` | Rotating refresh tokens recommended |
| GET | `/api/v1/auth/me` | — | `User` | Requires Bearer token |
| PATCH | `/api/v1/users/me` | partial `User` | `User` | Cannot change own `role` |
| GET | `/api/v1/admin/users` | `page, page_size, role?, q?` | `Page<User>` | Admin only |
| PATCH | `/api/v1/admin/users/{user_id}` | `{role?, is_active?}` | `User` | Admin only; prefer deactivate over delete |

### 5.2 Farms and devices

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/api/v1/farms` | — | `Page<Farm>` | Farmers see own; admin sees all |
| POST | `/api/v1/farms` | `{name, latitude, longitude, county?}` | `Farm` | Location drives weather lookup |
| GET/PATCH | `/api/v1/farms/{farm_id}` | partial `Farm` | `Farm` | Ownership enforced |
| GET | `/api/v1/devices` | `farm_id?` | `Page<Device>` | — |
| POST | `/api/v1/devices` | `{farm_id, label, type:"esp32"}` | `{id, device_key, farm_id}` | Return key once; store hash only |

**`POST /api/v1/devices/ingestions`** — ESP32 upload (device key auth)

```json
{
  "device_id": "esp32-001",
  "recorded_at": "2026-11-20T09:30:00Z",
  "soil": { "N": 90, "P": 40, "K": 40, "ph": 6.7, "soil_moisture": 32.5,
            "temperature": 24.5, "humidity": 61.0 },
  "weather": { "temperature": 25.0, "humidity": 60, "rainfall": 0 }
}
```

**Response `201`**

```json
{
  "soil_reading_id": 1842,
  "weather_reading_id": 931,
  "recommendation": {
    "id": 507,
    "recommended_crop": "maize",
    "confidence": 0.8841,
    "status": "ok",
    "top_recommendations": [ "…" ]
  },
  "quality_flags": []
}
```

- Validate before inference; implausible values are stored with `is_valid=false` and a `quality_flags` entry, never silently dropped.
- Keep a per-device deduplication key on `(device_id, recorded_at)` so retries do not double-insert.
- `weather` is optional; when absent, the server resolves current weather from the farm's coordinates.

### 5.3 Soil, weather, and recommendations

| Method | Path | Query / body | Response | Notes |
|---|---|---|---|---|
| GET | `/api/v1/soil-readings` | `farm_id, from?, to?, page, page_size` | `Page<SoilReading>` | Newest first |
| GET | `/api/v1/soil-readings/latest` | `farm_id` | `SoilReading` | Dashboard primary card |
| GET | `/api/v1/weather/current` | `farm_id` | `WeatherReading` | Cache-first; provider fallback |
| GET | `/api/v1/weather` | `farm_id, from?, to?` | `Page<WeatherReading>` | Archived provider/sensor data |
| POST | `/api/v1/weather/refresh` | `{farm_id}` | `WeatherReading` | Admin/system; respects provider quota |
| POST | `/api/v1/recommendations` | `{farm_id, source:"latest"\|"manual", inputs?}` | `Recommendation` | Persists result + model version |
| GET | `/api/v1/recommendations` | `farm_id, from?, to?, page, page_size` | `Page<Recommendation>` | History chart/table |
| GET | `/api/v1/recommendations/latest` | `farm_id` | `Recommendation` | Reuse dashboard card |
| GET | `/api/v1/recommendations/{id}` | — | `Recommendation` | Drill-down |
| GET | `/api/v1/model/info` | — | `{version, features, classes, test_accuracy, trained_at}` | Reads `models/model_metrics.json` |

**`Recommendation` extends the implemented `CropPrediction`:**

```json
{
  "id": 507,
  "farm_id": 3,
  "soil_reading_id": 1842,
  "weather_reading_id": 931,
  "recommended_crop": "maize",
  "confidence": 0.8841,
  "top_recommendations": [ { "crop": "maize", "confidence": 0.8841 } ],
  "status": "ok",
  "advice": null,
  "model_version": "rf-2026-11-v1",
  "created_at": "2026-11-20T09:30:04Z"
}
```

- `status`: `ok` when `confidence >= 0.60`, otherwise `low_confidence`.
- On `low_confidence`, reuse the exact sentinel string from `POST /predict` in `recommended_crop` and put explanatory text in `advice` so one UI branch covers both endpoints.
- Make the `0.60` threshold a `system_param` so it can change without a rebuild; keep the code default as fallback.
- Register static routes (`/latest`, `/current`) **before** dynamic ones such as `/recommendations/{id}`, or type the path parameter as `{id:int}` to avoid shadowing.

### 5.4 Admin catalogue, parameters, datasets, reports

| Method | Path | Request / query | Response | Notes |
|---|---|---|---|---|
| GET | `/api/v1/crops` | `q?, is_active?` | `Page<Crop>` | Public to authenticated users |
| GET | `/api/v1/crops/{code}` | — | `Crop` | `code` e.g. `maize` |
| POST/PATCH/DELETE | `/api/v1/crops[/{code}]` | `Crop` payload | `Crop` / `204` | Admin only |
| GET/PATCH | `/api/v1/admin/system-params` | partial `{key:value}` | `{items: [...]}` | Threshold, intervals, units |
| GET | `/api/v1/admin/datasets` | — | `Page<Dataset>` | — |
| POST | `/api/v1/admin/datasets` | `{name, file_uri}` | `Dataset` | Triggers validation, not auto-retrain |
| GET | `/api/v1/reports/summary` | `farm_id, from, to` | `{readings_count, avg_moisture, avg_ph, recommendation_counts, timeline}` | Backs dashboard charts |
| GET | `/api/v1/reports/export` | `farm_id, from, to, format:"csv"` | `text/csv` stream | Reuse same query as summary |
| GET | `/api/v1/audit-logs` | `actor_id?, from?, to?` | `Page<AuditLog>` | Admin only |

---

## 6. Shared response schemas

```ts
// Frontend-facing shapes (TypeScript style, JSON on the wire)
User       = { id, full_name, email, phone?, location?, county?, role, is_active, created_at }
Farm       = { id, owner_user_id, name, latitude, longitude, county?, created_at }
Device     = { id, farm_id, label, type, status, last_seen_at? }
SoilReading = { id, farm_id, device_id?, recorded_at, N, P, K, temperature,
                humidity, ph, rainfall, soil_moisture?, source,
                is_valid, quality_flags: string[] }
WeatherReading = { id, farm_id, recorded_at, temperature, humidity, rainfall,
                   source, provider? }
Crop       = { id, code, name, local_name?, optimal: Record<string, [number, number]>, is_active }
Dataset    = { id, name, file_uri, rows_count?, status, uploaded_by, created_at }
ApiError   = { detail: string | Array<{loc: string[]; msg: string; type: string}> }
```

---

## 7. Database layer mapping

> **Decision required:** the proposal specifies **MySQL**; `backend/app/core/config.py` currently defaults to **PostgreSQL**. Recommendation: standardise on **MySQL** to match the proposal, update `DATABASE_URL` and dependencies, and keep the schema below portable (use `JSON` → `LONGTEXT` if MySQL < 5.7).

| Table | Key columns | Notes / indexes |
|---|---|---|
| `users` | `id PK`, `email UNIQUE`, `password_hash`, `full_name`, `phone`, `location`, `county`, `role ENUM(farmer, extension_officer, admin)`, `is_active`, `created_at`, `updated_at` | Index `email`; never store plaintext passwords |
| `farms` | `id PK`, `owner_user_id FK→users`, `name`, `latitude DECIMAL(10,7)`, `longitude DECIMAL(10,7)`, `county`, `created_at` | Index `(owner_user_id)` |
| `devices` | `id PK`, `farm_id FK→farms`, `label`, `type`, `device_key_hash UNIQUE`, `status`, `last_seen_at` | Index `device_key_hash`; return raw key only at creation |
| `soil_readings` | `id PK`, `farm_id FK`, `device_id FK NULL`, `recorded_at`, `N`, `P`, `K`, `temperature`, `humidity`, `ph`, `rainfall`, `soil_moisture`, `source ENUM(sensor,manual)`, `is_valid`, `quality_flags JSON` | Index `(farm_id, recorded_at DESC)`; unique `(device_id, recorded_at)` |
| `weather_readings` | `id PK`, `farm_id FK`, `recorded_at`, `temperature`, `humidity`, `rainfall`, `source`, `provider_payload JSON` | Index `(farm_id, recorded_at DESC)` |
| `recommendations` | `id PK`, `farm_id FK`, `soil_reading_id FK NULL`, `weather_reading_id FK NULL`, `requested_by_user_id FK NULL`, `recommended_crop`, `confidence DECIMAL(5,4)`, `alternatives JSON`, `status`, `advice`, `model_version`, `created_at` | Index `(farm_id, created_at DESC)` |
| `crops` | `id PK`, `code UNIQUE`, `name`, `local_name`, `optimal JSON`, `is_active` | Seed from model `classes_` |
| `system_params` | `key PK`, `value JSON`, `updated_by FK`, `updated_at` | Store `min_confidence = 0.60` here |
| `datasets` | `id PK`, `name`, `file_uri`, `rows_count`, `status`, `uploaded_by FK`, `created_at` | Registry only; no binary blobs in DB |
| `audit_logs` | `id PK`, `actor_user_id FK`, `action`, `entity`, `entity_id`, `metadata JSON`, `created_at` | Index `(created_at)` |

**Field mapping rule:** API uses the model's exact names (`N`, `P`, `K`, `ph`); DB columns may be lowercase (`n`, `p`, `k`, `ph`). Map in the service/repository layer — do not rename API fields, because `CropInput` and the training artifact depend on them.

---

## 8. Frontend implementation notes

1. **Dashboard load order:** `GET /auth/me` → `GET /farms` → `GET /soil-readings/latest` → `GET /weather/current` → `GET /recommendations/latest`. Render each card independently so one failure does not blank the page.
2. **Manual form:** post directly to `/api/v1/predict` for a quick estimate; use `POST /api/v1/recommendations` when the result must be stored with a farm and shown in history.
3. **Low-confidence UI:** branch on the sentinel string (or `status === "low_confidence"` on the planned endpoint). Always show the confidence percentage and the "decision-support, not a guarantee" notice from the README.
4. **Polling:** ESP32 deployments should poll `/soil-readings/latest` and `/recommendations/latest` every 30–60 s; avoid polling the weather provider directly.
5. **Charts:** source `/reports/summary` for aggregates and `/reports/export?format=csv` for downloads; keep filters shared between summary and export.
6. **CORS:** run the Next.js dev server on `http://localhost:3000` or extend `allow_origins` in `main.py` before using another port.

---

## 9. Open decisions before DB/frontend code begins

1. **Database engine:** MySQL (proposal) vs PostgreSQL (current config) — pick one and align `DATABASE_URL`, driver, and migrations.
2. **Auth:** JWT access + refresh vs server sessions; decide token lifetime and whether `POST /predict` becomes authenticated.
3. **Nutrient units:** confirm N/P/K scale with the dataset owner before labelling units in the UI.
4. **Weather provider:** choose provider, API key storage, cache TTL, and fallback behaviour when offline.
5. **NPK sensing:** hardware list has moisture/DHT22/pH only, but the model needs N/P/K. Confirm manual entry, NPK sensor, or lab values as the source.
6. **Recommendation refresh:** event-driven on each ingestion vs scheduled recomputation when weather changes.
7. **Model versioning:** adopt a `model_version` convention now so stored history remains interpretable after retraining.

---

## 10. Explicitly out of scope

Pest/disease detection, irrigation control, fertiliser application guidance, market pricing, farm equipment automation, yield prediction, and map-based geospatial suitability (CropSuit-style). Do not add endpoints for these without a revised proposal.
