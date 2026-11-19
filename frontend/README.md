# Frontend — Field Console

Vanilla HTML, CSS and JavaScript client for the Smart Agriculture API. No framework, no build step, no ORM-style coupling.

## Run

Serve the folder over HTTP (ES modules do not work from `file://`):

```bash
cd frontend
python -m http.server 3000
```

Open `http://localhost:3000`.

Set the API base URL and bearer token with the **Connection** button in the top bar. Defaults to `http://localhost:8000`.

## Design rules applied

- Single font family: Helvetica Neue / Helvetica / Arial
- Flat surfaces, 2px corners only, no glassmorphism or shadows except the connection popover
- No emoji, no pills, no decorative icon set
- Green-dominant palette with sand and clay as restrained secondary tones
- Scrollbars hidden globally; smooth hash-route scrolling and IntersectionObserver reveals
- Skeleton placeholders on every data view
- Local SVG placeholder illustrations in `assets/`

## Route → endpoint map

Routes correspond to rows **19–36** of `docs/API_DOCUMENTATION.md`.

| # | Route | Endpoint |
|---:|---|---|
| 19 | `#/soil-readings` | `GET /api/v1/soil-readings` |
| 20 | `#/soil-readings/latest` | `GET /api/v1/soil-readings/latest` |
| 21 | `#/weather/current` | `GET /api/v1/weather/current` |
| 22 | `#/weather` | `GET /api/v1/weather` |
| 23 | `#/weather/refresh` | `POST /api/v1/weather/refresh` |
| 24 | `#/recommendations/new` | `POST /api/v1/recommendations` |
| 25 | `#/recommendations` | `GET /api/v1/recommendations` |
| 26 | `#/recommendations/latest` | `GET /api/v1/recommendations/latest` |
| 27 | `#/recommendations/detail` | `GET /api/v1/recommendations/{id}` |
| 28 | `#/crops` | `GET /api/v1/crops` |
| 29 | `#/crops/detail` | `GET /api/v1/crops/{code}` |
| 30 | `#/crops/manage` | `POST / PATCH / DELETE /api/v1/crops` |
| 31 | `#/admin/system-params` | `GET / PATCH /api/v1/admin/system-params` |
| 32 | `#/admin/datasets` | `GET / POST /api/v1/admin/datasets` |
| 33 | `#/model/info` | `GET /api/v1/model/info` |
| 34 | `#/reports/summary` | `GET /api/v1/reports/summary` |
| 35 | `#/reports/export` | `GET /api/v1/reports/export` |
| 36 | `#/audit-logs` | `GET /api/v1/audit-logs` |

`#/overview` is a composed dashboard using routes 20, 21 and 26.

## File structure

```text
frontend/
  index.html          App shell, sidebar, connection panel
  styles.css          Design system and layout
  api.js              Fetch client, config, query builder
  components.js       Shared markup primitives and skeletons
  router.js           Hash routes and dynamic view imports
  app.js              Shell wiring
  views/              One module per endpoint page
  assets/             Local SVG placeholders
```
