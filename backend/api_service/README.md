# Smart Agriculture — Extended FastAPI Backend

Layered FastAPI service covering every endpoint in `docs/API_DOCUMENTATION.md`
**except** the already-implemented endpoints and the sensor/IoT endpoints.

## Run

```bash
cd backend
pip install -r api_service/requirements.txt
uvicorn api_service.main:app --reload --port 8001
```

Interactive docs: `http://localhost:8001/docs`

## Test

```bash
cd backend
pytest api_service/tests -q
```

## Scope

### Implemented here (31 endpoints)
- Auth/users: register, login, refresh, me, profile update, admin user list/update
- Farms: list, create, detail, update
- Weather: current, history, refresh
- Recommendations: create, list, latest, detail
- Crops: list, detail, admin create/update/delete
- Admin: system params, datasets, audit logs
- Model info, reports summary, CSV export

### Deliberately excluded
- `GET /`, `GET /health`, `POST /api/v1/predict`, generated docs — already implemented in `backend/app/`
- `POST /api/v1/devices/ingestions`, `GET|POST /api/v1/devices`, `GET /api/v1/soil-readings`, `/latest` — owned by the IoT/sensor team
- All database ORM and frontend code — owned by other teams

## Layering

```
interfaces/     FastAPI routers, Pydantic schemas, dependencies, error handlers
application/    Use-case services (authorization, orchestration, business rules)
infrastructure/ Token/password providers, weather client, model provider, composition root
repositories/   Storage contracts + in-memory adapters (swap point for the DB team)
domain/         Framework-neutral entities and exceptions
```

`main.py` only wires routers and middleware; no business logic lives there.

## Swapping in the other teams' work

| Team | Replace | Where |
|---|---|---|
| Database | `InMemory*Repository` classes with ORM-backed implementations of `repositories/contracts.py` | `infrastructure/container.py` → `Container.__init__` |
| AI/ML | `StubModelProvider` with an artifact-loading `ModelProvider` | `infrastructure/container.py` |
| IoT | Add device ingestion / soil-reading routers to this app (or keep a separate service) | `interfaces/routers/` |

No service, router or schema needs to change for those swaps.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `SECRET_KEY` | dev-only key | Signs access/refresh tokens |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | `admin@agri.local` / `AdminPass123!` | First administrator |
| `MIN_CONFIDENCE` | `0.60` | Low-confidence threshold (overridable via admin system params) |
| `WEATHER_PROVIDER` | `stub` | `stub` (offline) or `open_meteo` |
| `OPEN_METEO_URL` | Open-Meteo forecast URL | Weather endpoint |
| `WEATHER_CACHE_TTL_SECONDS` | `600` | Cache lifetime for current weather |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |

## Error responses

Every error uses `{"detail": ..., "code": ...}`:

| Status | Code | Meaning |
|---|---|---|
| 401 | `unauthorized` | Missing/invalid/expired token |
| 403 | `forbidden` | Role or ownership check failed |
| 404 | `not_found` | Resource does not exist |
| 409 | `conflict` | Duplicate email or crop code |
| 422 | `validation_error` | Pydantic validation or business-rule validation failure |
| 500 | `internal_error` | Unexpected failure (logged server-side) |

Weather-provider failures are handled gracefully: the last cached reading is
returned with `is_stale: true` and a warning instead of a 500.
