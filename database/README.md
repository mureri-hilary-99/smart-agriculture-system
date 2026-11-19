# Database (MySQL)

MySQL layer for the crop recommendation system, covering API endpoints **#19–#36** in [`docs/API_DOCUMENTATION.md`](../docs/API_DOCUMENTATION.md).

## Files

| File | Contents |
|---|---|
| `schema.sql` | `CREATE DATABASE`, all 11 tables, keys, indexes and foreign keys |
| `seed.sql` | System parameters (including the `0.60` confidence gate), 22-crop catalogue, demo farm/device, sample readings, recommendations, dataset registry, model info and audit entry |
| `queries.sql` | The SQL behind each endpoint #19–#36, grouped and labelled by endpoint number |

## Run order

```bash
mysql -u <user> -p < database/schema.sql
mysql -u <user> -p smart_agriculture < database/seed.sql
mysql -u <user> -p smart_agriculture < database/queries.sql   # example queries
```

Requires MySQL 8.0 for `JSON` columns and descending indexes (schema uses `utf8mb4`).

## Endpoint coverage

| # | Endpoint | Table(s) |
|---:|---|---|
| 19 | `GET /soil-readings` | `soil_readings` |
| 20 | `GET /soil-readings/latest` | `soil_readings` |
| 21 | `GET /weather/current` | `weather_readings` |
| 22 | `GET /weather` | `weather_readings` |
| 23 | `POST /weather/refresh` | `weather_readings` |
| 24 | `POST /recommendations` | `recommendations` |
| 25 | `GET /recommendations` | `recommendations` |
| 26 | `GET /recommendations/latest` | `recommendations` |
| 27 | `GET /recommendations/{id}` | `recommendations` |
| 28 | `GET /crops` | `crops` |
| 29 | `GET /crops/{code}` | `crops` |
| 30 | `POST/PATCH/DELETE /crops` | `crops` |
| 31 | `GET/PATCH /admin/system-params` | `system_params` |
| 32 | `GET/POST /admin/datasets` | `datasets` |
| 33 | `GET /model/info` | `model_info` |
| 34 | `GET /reports/summary` | `soil_readings`, `recommendations` |
| 35 | `GET /reports/export` | `soil_readings`, `recommendations` |
| 36 | `GET /audit-logs` | `audit_logs` |

`users`, `farms` and `devices` exist as parent tables because the above tables reference them by foreign key.

## Design notes

- **Database engine:** MySQL, as required by the proposal. The current backend config defaults to PostgreSQL and must be changed to match before wiring `database.py`.
- **Field mapping:** API sends `N`, `P`, `K`, `ph`; the DB stores lowercase `n`, `p`, `k`, `ph`. Map in the service layer — do not rename API fields, because `CropInput` and the training artifact depend on them.
- **Soil moisture:** stored and displayed only; it is **not** a model input and is excluded from inference.
- **Data quality:** implausible readings are stored with `is_valid = 0` and `quality_flags`, never silently dropped.
- **Weather fallback:** `weather_readings.is_stale` lets the dashboard mark last-known weather as out of date when the provider is unavailable.
- **Low confidence:** `system_params.min_confidence` defaults to `0.60`; below it, use the exact sentinel string from the API doc and set `status = 'low_confidence'`.
- **Passwords:** `seed.sql` contains placeholder hashes — replace them before any real use.
- **Unfinished reference data:** `crops.optimal` is seeded empty. Populate ranges from KALRO / FAO EcoCrop guidance and the extension officer's review, as the proposal requires.
- **Model info:** the reference app reads `models/model_metrics.json`; `model_info` is the DB-backed alternative so `/model/info` does not depend on a local file.
