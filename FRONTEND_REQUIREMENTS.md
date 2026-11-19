# Frontend Requirements & Project Notes

> Working notes for the **frontend** portion of the Smart Agriculture project.
> Sources: `Proposal.docx`, `README.md`, and the current `backend/` code (branch `Musah`).

---

## 1. Project overview

**Title:** An IoT and AI-Based Crop Recommendation System Using Real-Time Soil and Weather Data
**Team:** Group IV, Department of Information Technology, Kibabii University
**Purpose:** Help Kenyan smallholder farmers choose crops suited to their actual soil and weather conditions, instead of relying on experience, general advice, or trial and error.

**How the system works (proposed architecture):**

```text
ESP32 + soil moisture / pH / DHT22 sensors
        ↓ (JSON over Wi-Fi / HTTPS)
Flask/FastAPI server ──→ Open-Meteo weather API
        ↓
MySQL/Postgres DB  ←→  trained ML model
        ↓
Web dashboard (farmers, extension officers, admins)
```

**Target users:**
- Farmers (primary) — need simple, farm-specific recommendations.
- Agricultural extension officers — use it to support advice given to farmers.
- Administrators — manage users, crops, system parameters and datasets.

---

## 2. Frontend-relevant requirements (from the proposal)

### 2.1 Functional requirements

| # | Requirement | Source | Backend ready? |
|---|-------------|--------|----------------|
| F1 | Allow authorized users to register and log in | §1.10.1 | ❌ No auth endpoints yet |
| F2 | Present sensor/readings **through a simple user interface** | §1.4.1 | ❌ No readings endpoint yet |
| F3 | Display crop recommendations to the user | §1.7.2 | ✅ `/api/v1/predict` |
| F4 | Show real-time weather data relevant to farm location | §1.4.1 | ❌ No weather endpoint yet |
| F5 | Show historical environmental data and recommendation records | §1.10.1, §1.7.2 | ❌ No history endpoint yet |
| F6 | Update recommendations when environmental conditions change | §1.4.1 | ⚠️ Only via new prediction calls |
| F7 | Provide basic reports | §1.7.2 | ❌ No reports endpoint yet |
| F8 | Admin screens: manage users, crop info, system parameters, datasets | §1.10.1 | ❌ No admin endpoints yet |
| F9 | Alerts when monitored conditions exceed limits / sensor problems | §2.3.1.2 (existing systems) | ❌ Not implemented |
| F10 | Output three most suitable crops with probabilities | §3.1.3 | ✅ `top_recommendations` |

### 2.2 Non-functional requirements (from §1.10.2, §2.3.2)

- **Usability:** simple and easy to understand, especially for users with limited technical knowledge. This is stated repeatedly — it is the top UI priority.
- **Accessibility:** usable on commonly available devices — smartphones, tablets and computers (responsive design is a must).
- **Performance:** pages and recommendations should appear without unnecessary delay; end-to-end reading → recommendation within one minute (§3.1.4).
- **Security:** protect accounts and stored data through authentication/authorization and secure handling; passwords hashed; HTTPS (§3.1.5).
- **Reliability / robustness:** handle missing, invalid and out-of-range data gracefully; never show stale data as current.
- **Scalability & maintainability:** modular UI so crops, sensors, users and locations can be added later.

### 2.3 Roles (§3.1.2)

`farmer` · `extension officer` · `administrator`. No role model exists in the backend yet.

---

## 3. Tech stack

| Layer | Proposal says | Current repo actually uses |
|-------|---------------|----------------------------|
| Frontend | HTML, CSS, JavaScript web dashboard | Next.js + TypeScript (per README — **not yet implemented**) |
| Backend | Python / Flask | Python / **FastAPI** |
| Database | MySQL | Postgres connection string in config (no DB code yet) |
| ML | scikit-learn, multiple candidate models | Random Forest (joblib artifact) |
| Hardware | ESP32, soil moisture, pH, DHT22 | Not in this repo |
| Weather | Open-Meteo API | Not wired up yet |
| Dev tools | VS Code, Arduino IDE | — |

⚠️ **Mismatch to resolve with the team:** the written proposal and the implemented backend disagree on the framework and database. Build the frontend against the **actual API**, not the proposal's assumed one.

---

## 4. Current backend API contract (verified from code)

**Base URL:** `http://localhost:8000` · **API docs:** `http://localhost:8000/docs`

### `GET /`
```json
{ "message": "Smart Agriculture API is running!", "status": "healthy" }
```

### `GET /health`
```json
{ "status": "healthy" }
```

### `POST /api/v1/predict`

**Request body** (`CropInput`, all fields required):

| Field | Type | Validation | Meaning |
|-------|------|------------|---------|
| `N` | float | ≥ 0 | Nitrogen content in soil |
| `P` | float | ≥ 0 | Phosphorus content in soil |
| `K` | float | ≥ 0 | Potassium content in soil |
| `temperature` | float | — | Air temperature (°C) |
| `humidity` | float | 0–100 | Relative humidity (%) |
| `ph` | float | 0–14 | Soil pH |
| `rainfall` | float | ≥ 0 | Rainfall (mm) |

**Response** (`CropPrediction`):
```json
{
  "recommended_crop": "maize",
  "confidence": 0.92,
  "top_recommendations": [
    { "crop": "maize", "confidence": 0.92 },
    { "crop": "beans", "confidence": 0.05 },
    { "crop": "potato", "confidence": 0.02 }
  ]
}
```

**Special rule:** if `confidence < 0.60`, the backend replaces `recommended_crop` with:
> `No reliable crop recommendation—collect more local soil and climate data`

Errors return HTTP 500 with `{"detail": "Could not generate crop recommendation: ..."}`.

**CORS:** only `http://localhost:3000` is allowed — the Next.js dev server default port. Keep that in mind if you change the frontend port.

---

## 5. Current repo state (audit)

- `backend/` — implemented: FastAPI app, routers, Pydantic schemas, prediction service, training script, config.
- `frontend/` — **only `.env.example`** (`NEXT_PUBLIC_API_URL=http://localhost:8000`). No app code at all, despite the README describing a Next.js dashboard.
- `backend/models/crop_random_forest.joblib` — **missing**.
- `backend/data/Crop_recommendation.csv` — **missing**.
- Because `crop_service` loads the model at import time, the backend currently **fails to start** until the ML teammate trains and saves the model. Use mocked responses during frontend development.
- `commands.txt` is an untracked binary file in the repo root — not part of the app.

---

## 6. First frontend deliverable (recommended scope)

Since only `/api/v1/predict` exists, the first shippable slice should be:

1. **Layout** — responsive dashboard shell (header, card-based content, mobile-first), green/earth palette, simple language.
2. **Prediction form** — the seven fields above with client-side validation matching the API constraints; numeric inputs, units and helpful hints.
3. **Results panel** — recommended crop, confidence meter/percentage, and the top-3 alternatives with bars; clear handling of the low-confidence message.
4. **States** — loading spinner, API error banner, empty state before first prediction.
5. **API layer** — typed fetch client using `NEXT_PUBLIC_API_URL`, with a local mock fallback so the UI can be developed before the model is ready.
6. **Disclaimer** — visible note that recommendations are decision support, not a planting guarantee (§"Important notice" in README).

**Defer until backend endpoints exist:** login/roles, live sensor readings, historical tables, reports and alerts.

---

## 7. Coordination questions for the team

- Confirm the framework: Next.js + TypeScript (README) or plain HTML/CSS/JS (proposal)?
- Who is supplying `Crop_recommendation.csv` and the trained `.joblib` artifact, and when?
- Will auth, readings, history and weather endpoints be added to this backend, or is this frontend demo-only for presentation?
- Are there design mockups/wireframes (§3.1.1 mentions dashboard wireframes)?
- Should the frontend consume sensor/weather data directly from another service, or only via the backend?

---

## 8. Key references

- `Proposal.docx` — §1.4 objectives, §1.7 scope, §1.10 requirements, §3.1.2 architecture, §3.1.3 model inputs/output, §3.1.4 testing, §3.1.5 ethics.
- `README.md` — setup commands and important notice.
- `backend/app/routers/prediction.py` — endpoint logic and confidence threshold.
- `backend/app/schemas/crop.py` — request/response schemas.
- `backend/app/services/crop_service.py` — model loading and top-3 logic.
- `backend/app/main.py` — CORS and app setup.
