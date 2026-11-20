# Requirements & Key Details

> **Source of truth:** `Proposal 20026.docx` and `Concept Paper CORRECTION.docx` (Group IV, Kibabii University, November 2026).
> **Related notes:** [PROJECT_UNDERSTANDING.md](./PROJECT_UNDERSTANDING.md) (full document distillation) and [CODEBASE_BLUEPRINT.md](./CODEBASE_BLUEPRINT.md) (implementation plan + code audit).
> **Status key:** ✅ in current code · ⚠️ partial · ❌ not implemented.

---

## 1. Project at a glance

| Field | Detail |
|---|---|
| **Title** | An IoT and AI-Based Crop Recommendation System Using Real-Time Soil and Weather Data |
| **Institution** | Kibabii University — Dept. of Information Technology, School of Computing and Informatics |
| **Degree** | Bachelor of Science in Information Technology |
| **Team** | Group IV — 7 students (see PROJECT_UNDERSTANDING.md §1) |
| **Goal** | Convert live, farm-specific soil + weather data into ranked crop recommendations via a simple web dashboard. |
| **Users** | Smallholder farmers, agricultural extension officers, agricultural institutions/researchers |
| **Location focus** | Small-scale farms in Kenya (maize, beans, potatoes, selected vegetables) |
| **Nature** | Decision-support tool — **not** a yield guarantee or farm automation system |

### Core abstraction
```text
Sensors (pH, moisture, temp, humidity)  +  Weather API (rainfall)
        → ESP32 (average, range-check, JSON over Wi-Fi/HTTPS)
        → Server (validate, store, enrich with weather, run ML, store result)
        → Dashboard (latest readings, trends, top-3 crops)
        → Farmer / Extension Officer / Admin
```

---

## 2. Functional requirements

| ID | Requirement | Priority | Status |
|---|---|---|---|
| **FR-1** | Allow authorized users to register and log in. | Core | ❌ |
| **FR-2** | Collect soil data from connected IoT sensors. | Core | ❌ |
| **FR-3** | Transmit sensor readings from the field to the application server. | Core | ❌ |
| **FR-4** | Acquire relevant weather information from an external weather-data source. | Core | ❌ |
| **FR-5** | Store soil, weather, user and crop-recommendation data in a database. | Core | ❌ |
| **FR-6** | Pre-process and validate collected soil and weather data before analysis. | Core | ⚠️ (manual input ranges only) |
| **FR-7** | Use the trained AI model to analyse soil and weather conditions. | Core | ✅ (one variant only) |
| **FR-8** | Generate crop recommendations from analysed conditions. | Core | ✅ |
| **FR-9** | Let authorized administrators manage users, crop information, system parameters and datasets. | Core | ❌ |
| **FR-10** | Let authorized users view previously collected environmental data and recommendation records. | Core | ❌ |

### Implied functional behaviours (from Proposal Chapter 3)
| ID | Behaviour | Status |
|---|---|---|
| FR-11 | ESP32 samples every 10 minutes, averages readings, rejects out-of-range values. | ❌ |
| FR-12 | ESP32 buffers unsent readings during network outages and replays them on reconnect. | ❌ |
| FR-13 | Dashboard shows last known weather **marked as out of date** when the weather service fails. | ❌ |
| FR-14 | Return the **top 3 crops with probabilities**, not a single answer. | ✅ |
| FR-15 | Update recommendations when environmental conditions change. | ❌ |
| FR-16 | Three roles: **farmer, extension officer, administrator**. | ❌ |
| FR-17 | Provide basic historical data and reports. | ❌ |

---

## 3. Non-functional requirements

| ID | Theme | Requirement |
|---|---|---|
| **NFR-1** | Performance | Process incoming sensor/weather data and generate recommendations without unnecessary delay (integration target: updated recommendation within **60 seconds**). |
| **NFR-2** | Reliability | Operate consistently; minimize data loss during collection and transmission. |
| **NFR-3** | Usability | Simple, easy-to-understand UI for users with limited technical knowledge. |
| **NFR-4** | Security | Authentication, authorization and secure data handling; hashed passwords; HTTPS; farm data restricted to owner, assigned extension officers and admins. |
| **NFR-5** | Availability | Available whenever network, hardware and external data services are operational. |
| **NFR-6** | Scalability | Support additional crops, sensors, users and geographical locations. |
| **NFR-7** | Modularity / maintainability | Model, database, sensors and app components can be updated without rebuilding the system. |
| **NFR-8** | Predictive quality | Acceptable performance under selected evaluation criteria (**target ≥90% held-out accuracy**). |
| **NFR-9** | Interoperability | Interfaces/APIs for supported IoT devices and external weather services. |
| **NFR-10** | Device reach | Accessible via smartphone, tablet or computer. |
| **NFR-11** | Compliance | Kenya Data Protection Act 2019; voluntary informed consent; store only account, farm location, sensor and recommendation data. |
| **NFR-12** | Robustness | Handle missing/implausible sensor values, unavailable weather, out-of-range inputs, server/DB failure and prolonged connectivity loss without crashing. |

---

## 4. Objectives

### System-level
1. Real-time soil data (moisture, temperature, humidity, pH).
2. Real-time weather data for the farm location.
3. Crop recommendations from current soil + weather conditions.
4. Simple UI for readings and recommendations.
5. Historical soil, weather and recommendation storage.
6. Recommendations that update as conditions change.

### Developer-level
1. Design architecture: sensors → microcontroller → network → DB → AI model → UI.
2. Select and integrate appropriate sensors.
3. Program ESP32 for acquisition, processing, transmission.
4. Implement Wi-Fi (or GSM) communication to backend/cloud.
5. Develop real-time + historical database.
6. Identify and prepare agricultural datasets.
7. Pre-process and analyse datasets.
8. Develop, train and evaluate the AI model.
9. Develop the dashboard.
10. Test and validate under real or simulated farm conditions.

---

## 5. Scope boundaries

**In scope:** collect soil data → collect weather data → store → process/analyse → generate recommendations → display → basic history/reports.

**Out of scope (explicit):** pest/disease detection, irrigation control, fertilizer application guidance, market pricing, farm equipment automation.

**Limitations:** dataset availability/quality, weather-data availability, network connectivity, hardware/financial constraints, changing environmental conditions (stale recommendations).

**Key assumptions:** sensors sufficiently reliable; datasets available; relationship learnable; users have a device; parameters useful but not exhaustive; crops have documented requirements; stable network during development.

---

## 6. Technical details that constrain the code

### 6.1 Model inputs (Table 3.1) — important

| Input | Source | Standard model | Extended model |
|---|---|---|---|
| Soil pH | pH sensor | ✅ | ✅ |
| Air temperature | DHT22 | ✅ | ✅ |
| Relative humidity | DHT22 | ✅ | ✅ |
| Rainfall | Open-Meteo API | ✅ | ✅ |
| Nitrogen / Phosphorus / Potassium | User-entered soil-test report | ❌ | ✅ |
| Soil moisture | Soil moisture sensor | ❌ **display only** | ❌ **display only** |

- **Two models are required**: `standard` (4 features) and `extended` (7 features with NPK).
- Soil moisture must **never** be a training feature — the public dataset has no such column.
- Rainfall must be aggregated over a window matched to the dataset; the window must be fixed and recorded.

### 6.2 Dataset & training
- Dataset: Kaggle **Crop Recommendation Dataset** (Ingle) — 2,200 records, 22 crops, N/P/K/temperature/humidity/ph/rainfall.
- Filter to Kenya-grown crops; verify with KALRO / FAO EcoCrop + extension officer; add potato/tomato/kale only with reliable ranges and report separately.
- Clean missing/impossible values and duplicates; scale where the algorithm needs it.
- Candidates: Decision Tree, KNN, SVM, Random Forest, Gradient Boosting.
- Stratified 80/20 split + 5-fold cross-validation; compare accuracy, macro precision/recall/F1, confusion matrices.
- Save best model **per variant** with joblib; target ≥90% accuracy; validate with agronomic guidance + extension officers.

### 6.3 Hardware / firmware
- ESP32 + capacitive soil moisture sensor + soil pH sensor + DHT22.
- Analog sensors on **ADC1 pins** (ADC2 unavailable while Wi-Fi active).
- 10-minute sampling interval; JSON over HTTPS; offline buffer + replay.
- Calibration: pH buffers 4.01 & 6.86; moisture dry/wet references; DHT22 vs reference thermometer.

### 6.4 Documented technology stack
- Python (backend + ML), scikit-learn, Pandas, NumPy, MySQL, Weather API (Open-Meteo).
- C/C++ + Arduino IDE for ESP32; HTML/CSS/JS for web UI; VS Code.
- ⚠️ Existing repo uses **FastAPI + PostgreSQL + Next.js/TypeScript** — see conflict list below.

### 6.5 Data entities
`users`, `farms`, `devices`, `sensor_readings`, `weather_readings`, `crops`, `recommendations` (+ `recommendation_crops` for top-3 ranking).

---

## 7. Testing & acceptance criteria

- **Calibration:** pH, moisture, DHT22 errors recorded.
- **pytest:** validation functions, DB queries, endpoints; invalid/missing/out-of-range inputs.
- **Integration:** sensor → dashboard update within 60 seconds.
- **Resilience:** simulate Wi-Fi outage, weather-service failure, faulty sensor — no crash, no stale-as-current.
- **Pilot:** ≥2 weeks on a pilot plot or simulated setting; farmer/extension-officer usability questionnaire; recommendations compared with local knowledge.

**Built system must satisfy:**
- [ ] Standard recommendation works without NPK; extended works with NPK entered.
- [ ] Soil moisture shown on dashboard but absent from both feature lists.
- [ ] Top-3 crops with probabilities returned; low confidence → safety message.
- [ ] Stale weather explicitly flagged.
- [ ] Buffered readings replay after outage without duplicates.
- [ ] Role-based access enforced; history viewable.
- [ ] Both models report CV + held-out metrics; ≥90% target checked.
- [ ] Passwords hashed, HTTPS used, Data Protection Act 2019 respected.

---

## 8. Budget & schedule (from appendices)

| Item | Cost (KES) |
|---|---|
| 2× ESP32 boards | 3,000 |
| 2× capacitive soil moisture sensors | 1,000 |
| Soil pH sensor + probe + signal board | 6,500 |
| 2× DHT22 sensors | 1,600 |
| pH buffer solution set | 800 |
| Breadboard, jumper wires, resistors | 700 |
| 5 V power supply / power bank | 1,500 |
| Weatherproof enclosure + cable glands | 1,500 |
| Web hosting (6 months) | 3,000 |
| Internet data bundles | 3,000 |
| Printing, binding, stationery | 3,500 |
| Transport for pilot testing | 5,000 |
| **Subtotal** | **31,100** |
| **Contingency (10%)** | **3,110** |
| **Total** | **34,210** |

- Work plan: 10 tasks across **WK2–WK12** (requirements → design → dataset/model → hardware → backend → dashboard → integration → pilot → documentation → presentation).
- ⚠️ Concept paper says duration = **one month, November**; proposal appendix defines 12 weeks. Needs confirmation.

---

## 9. Open decisions to confirm

| # | Conflict | Action |
|---|---|---|
| 1 | Proposal: **Flask** / Repo: **FastAPI** | Choose one framework. |
| 2 | Proposal: **MySQL** / Repo: **PostgreSQL** | Choose one database. |
| 3 | Proposal: **HTML/CSS/JS** / Repo: **Next.js + TypeScript** | Choose one frontend. |
| 4 | Proposal: 2 models, 5 algorithms, CV, ≥90% / Repo: one RF, single split | Implement documented ML strategy. |
| 5 | Weather, ingestion, history, roles, resilience documented but absent in code | Treat as core work (FR-2…FR-5, FR-9, FR-10). |
| 6 | 1 month vs 12 weeks | Confirm schedule. |
| 7 | `backend/requirements.txt` empty | Populate pinned dependencies. |

> **Guidance:** treat the **proposal Chapter 3** as the functional/architectural specification and the **concept paper** as the context and requirements source. The existing FastAPI/PostgreSQL/Next.js scaffold can be retained, but every documented behaviour above must still be implemented.
