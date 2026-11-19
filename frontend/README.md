# Frontend — Smart Agriculture

Vanilla HTML, CSS and JavaScript dashboard. No build step, no framework, one stylesheet, one typeface.

## Run locally

From this folder, start any static server. For example:

```cmd
python -m http.server 3000
```

Then open `http://localhost:3000`. Keep port 3000: the backend currently allows only `http://localhost:3000` through CORS.

The API base URL defaults to `http://localhost:8000`. Change it at runtime on the **API** page, or edit `assets/js/config.js`.

> Pages for planned endpoints will show an API error until the backend implements them. `GET /`, `GET /health` and `POST /api/v1/predict` work once the backend has its trained model and dataset.

## Pages and endpoint coverage

Endpoints 1–18 of `../docs/API_DOCUMENTATION.md` are covered here. Endpoints 19–36 are owned by another teammate and are not part of this frontend.

| # | Endpoint | Page |
|---|----------|------|
| 01 | `GET /` | `system.html`, `index.html` |
| 02 | `GET /health` | `system.html`, `index.html` |
| 03 | `POST /api/v1/predict` | `predict.html` |
| 04 | `GET /docs`, `/redoc`, `/openapi.json` | `api-reference.html` |
| 05 | `POST /api/v1/auth/register` | `register.html` |
| 06 | `POST /api/v1/auth/login` | `login.html` |
| 07 | `POST /api/v1/auth/refresh` | `profile.html` |
| 08 | `GET /api/v1/auth/me` | `profile.html` |
| 09 | `PATCH /api/v1/users/me` | `profile.html` |
| 10 | `GET /api/v1/admin/users` | `admin-users.html` |
| 11 | `PATCH /api/v1/admin/users/{user_id}` | `admin-users.html` |
| 12 | `GET /api/v1/farms` | `farms.html` |
| 13 | `POST /api/v1/farms` | `farms.html` |
| 14 | `GET /api/v1/farms/{farm_id}` | `farm-detail.html` |
| 15 | `PATCH /api/v1/farms/{farm_id}` | `farm-detail.html` |
| 16 | `POST /api/v1/devices/ingestions` | `device-ingest.html` |
| 17 | `GET /api/v1/devices` | `devices.html` |
| 18 | `POST /api/v1/devices` | `devices.html` |

## Structure

```text
index.html            overview and dashboard entry
system.html           service banner and health checks
predict.html          manual crop recommendation
login.html            sign in
register.html         account creation
profile.html          account details, refresh, sign out
admin-users.html      user list, role and status changes
farms.html            farm list and creation
farm-detail.html      farm detail and edit
devices.html          device list and registration
device-ingest.html    ESP32 batch submission
api-reference.html    generated docs links, base URL, coverage table
assets/
  css/styles.css      the entire design system
  js/config.js        runtime API base URL
  js/session.js       token and profile storage
  js/api.js           fetch client with refresh handling
  js/auth.js          login, register, profile, session helpers
  js/ui.js            DOM, validation and skeleton helpers
  js/shell.js         shared header and footer
  js/app.js           scroll progress, reveal and parallax
  js/pages/*.js       one script per page
  img/*.svg           flat placeholder illustrations
```

## Design rules applied

- Green-led palette (`#0e2e22` → `#359466`) with paper, ink and a restrained sage/amber/red for states only. No gradients or skeuomorphic depth.
- One typeface: Helvetica Neue / Helvetica / Arial. No emoji, no pill-shaped controls, no rounded cards.
- Scrollbars are hidden; scrolling still works. Navigation is a plain text row.
- Flat borders and thin rules, strong grid, generous whitespace, numbered sections — modern Swiss influence.
- Scroll progress bar, intersection-based reveal and restrained hero parallax. All motion respects `prefers-reduced-motion`.
- Skeleton shimmer on every data-fetching surface; explicit empty, loading, error and low-confidence states.
- Placeholder artwork is local SVG, so there are no external image or font dependencies.

## Behaviour notes

- Tokens are stored in `localStorage`. A 401 on an authenticated request triggers one refresh attempt via `POST /api/v1/auth/refresh` before the error is shown.
- Ingestion uses only the device key header, matching the documented contract.
- The low-confidence sentinel string from `POST /predict` is detected by prefix so the UI shows a warning instead of presenting unreliable advice as a recommendation.
- All request bodies use the exact field names from the API documentation (`N`, `P`, `K`, `ph`, `temperature`, `humidity`, `rainfall`).
