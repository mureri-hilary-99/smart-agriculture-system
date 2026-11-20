# Backend Architecture (FastAPI)

> Scope: backend only. Frontend, database/ORM and AI/ML artifacts are owned by other teams.
> Implementation: [`backend/api_service/`](../backend/api_service/).
> Contract: [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md).
> Objectives: [`REQUIREMENTS.md`](./REQUIREMENTS.md).

## 1. Layered design

```text
┌─────────────────────────────────────────────────────────────────┐
│ INTERFACES  (FastAPI)                                           │
│ routers/ · schemas.py (Pydantic) · dependencies.py · errors.py  │
│ HTTP validation, auth extraction, pagination, error mapping     │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Services facade
┌───────────────────────────▼─────────────────────────────────────┐
│ APPLICATION                                                     │
│ AuthService · FarmService · WeatherService · Recommendation-    │
│ Service · CropService · AdminService · ReportService            │
│ Business rules, role/ownership checks, orchestration            │
└───────────────────────────┬─────────────────────────────────────┘
                            │ contracts only
┌───────────────────────────▼─────────────────────────────────────┐
│ REPOSITORIES / PROVIDERS                                        │
│ contracts.py (ABCs) + InMemory* adapters                        │
│ PasswordHasher · TokenProvider · WeatherProvider · ModelProvider│
└───────────────────────────┬─────────────────────────────────────┘
                            │ plain data
┌───────────────────────────▼─────────────────────────────────────┐
│ DOMAIN                                                          │
│ Dataclass entities (User, Farm, WeatherReading, Recommendation, │
│ Crop, Dataset, SystemParam, AuditLog, Page) + DomainError types │
└─────────────────────────────────────────────────────────────────┘
```

`infrastructure/container.py` is the single composition root. It instantiates
adapters and injects a `ServiceContext` into the `Services` facade. To adopt the
database team's ORM or the AI team's trained model, only this file changes.

## 2. Objectives coverage

| Requirement file objective | Where it is satisfied |
|---|---|
| Real-time weather data for farm location | `WeatherService` + `weather` router (Open-Meteo client with stub fallback) |
| Recommendations from current conditions | `RecommendationService.create` builds features from inputs + latest weather, selects standard/extended variant |
| Simple presentation of readings/recommendations | JSON contracts consumed by the frontend team; stable response shapes |
| Store historical weather/recommendation data | `WeatherRepository`, `RecommendationRepository` (in-memory now, DB team swaps in) |
| Update recommendations when conditions change | `POST /recommendations` and `POST /weather/refresh` create fresh readings/results |
| Architecture across components | This layered design |
| Administrator management of users/crops/params/datasets | `AuthService.admin_*`, `CropService`, `AdminService` |
| View historical data | `GET /weather`, `GET /recommendations`, `GET /audit-logs`, report endpoints |
| Authentication, authorization, security | `TokenProvider`, `PasswordHasher`, `get_current_user`, `require_admin`, ownership checks |
| Modularity / swappable components | Repository and provider contracts + single composition root |
| Acceptable predictive performance | `MIN_CONFIDENCE` gate + configurable threshold; model info endpoint exposes accuracy |
| Interoperability with external services | `WeatherProvider` boundary; IoT endpoints left to the sensor team |
| Accessibility via devices | CORS configured for the frontend origin; stateless bearer auth |

Not in this backend by assignment: sensor acquisition/firmware, database ORM,
model training, and all frontend rendering.

## 3. Endpoint inventory

### Implemented in this service (31)

| Group | Endpoints |
|---|---|
| Auth/users (7) | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`, `PATCH /users/me`, `GET /admin/users`, `PATCH /admin/users/{id}` |
| Farms (4) | `GET|POST /farms`, `GET|PATCH /farms/{farm_id}` |
| Weather (3) | `GET /weather/current`, `GET /weather`, `POST /weather/refresh` |
| Recommendations (4) | `POST /recommendations`, `GET /recommendations`, `GET /recommendations/latest`, `GET /recommendations/{id}` |
| Crops (5) | `GET /crops`, `GET /crops/{code}`, `POST /crops`, `PATCH /crops/{code}`, `DELETE /crops/{code}` |
| Admin (5) | `GET|PATCH /admin/system-params`, `GET|POST /admin/datasets`, `GET /audit-logs` |
| Model (1) | `GET /model/info` |
| Reports (2) | `GET /reports/summary`, `GET /reports/export` |

All are prefixed with `/api/v1`.

### Excluded (owned elsewhere)

| Endpoints | Owner / reason |
|---|---|
| `GET /`, `GET /health`, `POST /api/v1/predict`, `/docs`, `/redoc`, `/openapi.json` | Already implemented in `backend/app/` |
| `POST /devices/ingestions`, `GET|POST /devices`, `GET /soil-readings`, `GET /soil-readings/latest` | Sensor/IoT team |

## 4. Cross-cutting behaviour

- **Authentication:** signed bearer tokens (HMAC-SHA256, access + rotating refresh), PBKDF2 password hashes, bootstrap admin account configurable by environment.
- **Authorization:** three roles (`farmer`, `extension_officer`, `admin`); farmers can only see their own farms/recommendations; admin-only routes use a dedicated dependency.
- **Validation:** Pydantic schemas reject malformed bodies (422 with a `detail` list matching the API document); services enforce domain rules (missing model inputs, duplicate email/crop, invalid date window).
- **Error mapping:** one handler for `DomainError` → 401/403/404/409/422, one for request validation → 422, one catch-all → 500 with server-side logging and a safe message.
- **Resilience:** weather-provider failure returns the last cached reading with `is_stale: true` and a warning rather than crashing.
- **Pagination:** `?page=&page_size=` with `{items, total, page, page_size}`; `?from=&to=` date filters use `YYYY-MM-DD`.
- **Route ordering:** `/recommendations/latest` and `/weather/current` are registered before dynamic `/{id}` routes.

## 5. Verification

`backend/api_service/tests/test_endpoints.py` exercises every implemented
endpoint plus the error cases. Run from `backend/`:

```bash
pytest api_service/tests -q
```

> Environment note: the development machine used to author this code has no
> Python interpreter installed (only Windows Store aliases), so the suite has
> not been executed here. Install Python 3.10+ and the `api_service`
> requirements, then run the command above before merging.
