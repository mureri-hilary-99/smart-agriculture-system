# Project Understanding — Source Document Distillation

> **Purpose.** This file is the authoritative reading notes for the two submitted documents — `Proposal 20026.docx` and `Concept Paper CORRECTION.docx`. It captures the project's abstraction, goals, requirements, design decisions, and constraints so that the codebase can be built to match the documented intent. Where the two documents disagree, both versions are recorded and the conflict is flagged.
>
> **Companion file.** [`CODEBASE_BLUEPRINT.md`](./CODEBASE_BLUEPRINT.md) translates this understanding into implementation-ready structure and audits the current code against it.

---

## 1. Project identity

| Item | Detail |
|---|---|
| **Official title** | An IoT and AI-Based Crop Recommendation System Using Real-Time Soil and Weather Data |
| **Submitting body** | Group IV |
| **Institution** | Kibabii University — Department of Information Technology, School of Computing and Informatics |
| **Qualification** | Bachelor of Science in Information Technology |
| **Submission date** | November 2026 |
| **Document types** | Concept Paper (correction) and Project Proposal |
| **Supervisor** | Blank in both documents (to be filled) |

### Group members (from the proposal declaration table)

| Course no. | Name |
|---|---|
| BIT/0005/24 | KADENGE JAYSON SIFA |
| BIT/0006/24 | MAHINDU ERNEST ASINULI |
| BIT/0074/24 | FLEVIAN MUSIMBI |
| BIT/0009/24 | KIPONDA MOSES HINZANO |
| BIT/0036/24 | PURITY CHEROTICH |
| BIT/0055/24 | PAUL IJAKAA |
| BIT/0013/24 | HILLARY MURERI |

Seven members — this matters because the methodology explicitly relies on splitting work by component across a team of seven.

---

## 2. The abstraction — what this project actually is

Stripped of academic framing, the project is a **closed-loop environmental sensing → decision-support pipeline**:

```text
Physical farm conditions
  (soil pH, moisture, air temp/humidity, rainfall)
        │
        ▼
ESP32 sensor node  ── Wi-Fi / HTTPS / JSON ──►  Application server
        │                                            │
        │                                            ├─ validate + persist raw readings
        │                                            ├─ enrich with weather API (rainfall)
        │                                            ├─ build model feature vector
        │                                            ├─ run trained classifier
        │                                            └─ persist recommendation
        │                                            │
        ▼                                            ▼
   buffered offline readings                  Web dashboard
                                          (latest readings, trends, top-3 crops)
                                                     │
                                                     ▼
                                     Farmer / Extension Officer / Admin
```

**Core abstraction in one sentence:** *Convert live, farm-specific soil and weather measurements into ranked crop suitability recommendations, delivered through a simple web interface, with history retained for later analysis.*

### Defining characteristics (what makes it distinct)

- **Farm-specific, not generalized.** Recommendations come from the conditions of *this* farm at *this* time, not from blanket regional advice.
- **Real-time sensing.** IoT sensors replace manual measurement as the primary soil data source.
- **Weather enrichment.** Rainfall/temperature context comes from an external weather API for the farm's coordinates.
- **Decision support only.** The system is explicitly *not* a yield controller, irrigation controller, or agronomic prescription tool.
- **Ranked, revisable output.** It returns the top three crops with probabilities, and re-runs as conditions change.
- **Modular by design.** Hardware, ML, backend, and dashboard are developed in parallel and joined through a fixed JSON contract.

### What the project is NOT (explicit out-of-scope list)

- Pest or disease detection
- Irrigation control
- Fertilizer application guidance
- Market pricing information
- Farm equipment automation

> The documents repeatedly qualify claims: the system supports decisions, does not directly control yield, and does not guarantee planting success. This caution should be preserved in UI copy and API responses.

---

## 3. Background, problem, and motivation

### Background
Agriculture is a major source of food, employment, and income, but crop selection commonly relies on experience, extension-officer advice, and trial and error. These break down as rainfall, temperature, and soil conditions change. Climate variability, soil degradation, and water shortages amplify the uncertainty. Small-scale African farmers — often rain-fed with limited access to decision-support tools — are most affected.

In Kenya, farmers grow maize, beans, potatoes, vegetables, and cash crops across widely varying soils and climates, usually without current data on soil moisture, temperature, humidity, pH, rainfall, or nutrients.

### Problem statement
Crop productivity depends on **soil moisture, temperature, soil pH, nutrient levels, humidity, and rainfall**, yet farmers lack timely, farm-specific measurements of these. Occasional soil tests, general forecasts, and manual observation cannot capture continuous change. The result: poor crop growth, reduced yields, higher production costs, and wasteful use of water, fertilizer, and labour.

**Formal problem statement:** the lack of an integrated, real-time, farm-specific crop recommendation system that enables small-scale farmers to make informed crop-selection decisions from actual soil and weather conditions.

### Purpose
> To develop an IoT and AI-based crop recommendation system that collects real-time soil and weather data and uses it to recommend crops suited to specific farm conditions.

### Justification
A low-cost, accessible tool is needed. Existing recommendation tools rarely combine real-time sensor data with weather information; those that do are expensive or aimed at large commercial farms. The combination of **live sensing + AI analysis + simple web interface**, with recommendations that update as conditions change, is the stated differentiator.

---

## 4. Objectives

### 4.1 System-level objectives
1. Provide real-time soil data (moisture, temperature, humidity, pH) from the farm.
2. Provide real-time weather data relevant to the farm location.
3. Recommend suitable crops based on current soil and weather conditions.
4. Present sensor readings and crop recommendations through a simple UI.
5. Store historical soil, weather, and recommendation data for monitoring and future analysis.
6. Update recommendations when environmental conditions change.

### 4.2 Developer-level objectives
1. Design the overall architecture (IoT sensors → microcontroller → communication network → database → AI model → UI).
2. Select and integrate appropriate sensors for the required soil parameters.
3. Program an ESP32 to acquire, process, and transmit readings.
4. Implement a communication mechanism (Wi-Fi or GSM) from farm to backend/cloud.
5. Develop a database for real-time and historical soil, weather, and recommendation data.
6. Identify and prepare suitable agricultural datasets.
7. Pre-process and analyse the datasets.
8. Develop, train, and evaluate the AI model.
9. Design and develop the dashboard UI.
10. Test and validate under real or simulated farm conditions.

---

## 5. Stakeholders and significance

### Beneficiaries
- **Farmers** — data-driven, farm-specific crop recommendations; less reliance on assumption.
- **Agricultural extension officers** — real-time environmental data to complement field knowledge and advisory work.
- **Institutions and researchers** — a framework for precision agriculture, crop suitability, IoT sensing, and AI decision-support research.
- **Students and future developers** — a practical reference integrating hardware, software, databases, IoT communication, and AI.

### Areas of impact
- **Agricultural productivity** — better planning through better crop selection (explicitly *not* direct yield control).
- **Information Technology** — a demonstration of integrating IoT, AI/ML, analytics, databases, and web development.

---

## 6. Scope, limitations, assumptions

### Scope
- **Domain:** Information Technology — AI, IoT, Data Analytics, Smart Agriculture.
- **Geographical:** small-scale farmers in Kenya; pilot data from a selected study area subject to sensor/data/farm availability. Crops emphasized: maize, beans, potatoes, selected vegetables.
- **Functional:** collect soil data → collect environmental/weather data → store → process/analyse → generate recommendations → display → provide basic history and reports.
- **Duration:** ⚠️ **Conflict** — Concept Paper §1.7.5 says *one month, November*; Proposal Appendix A defines a *12-week* work plan (WK2–WK12). Proposal Chapter 1 instead says "the academic project period." Treat the 12-week plan as the detailed schedule and the one-month statement as likely a concept-paper simplification.

### Limitations
- Dataset availability — model quality depends on dataset quality, size, relevance, diversity.
- Weather-data availability — dependent on external sources.
- Network connectivity — remote farms may have poor/unavailable links.
- Hardware/financial constraints — number and type of sensors limited by cost.
- Changing conditions — recommendations can go stale quickly.

### Assumptions
- Selected sensors are sufficiently reliable for their parameters.
- Relevant soil, weather, and crop datasets are obtainable.
- The soil/weather ↔ crop-suitability relationship is learnable from available data.
- Users have a smartphone, tablet, or computer.
- Selected parameters are useful but not exhaustive of crop performance factors.
- Supported crops have documented environmental/soil requirements.
- Stable network is available during development and testing.

---

## 7. Requirements

### 7.1 Functional requirements
| ID | Requirement |
|---|---|
| FR-1 | Allow authorized users to register and log in. |
| FR-2 | Collect soil data from connected IoT sensors. |
| FR-3 | Transmit sensor readings from the field to the processing/application server. |
| FR-4 | Acquire relevant weather information from an appropriate weather-data source. |
| FR-5 | Store soil, weather, user, and crop-recommendation data in a database. |
| FR-6 | Pre-process and validate collected soil and weather data before analysis. |
| FR-7 | Use the trained AI model to analyse soil and weather conditions. |
| FR-8 | Generate crop recommendations from the analysed conditions. |
| FR-9 | Let authorized administrators manage users, crop information, system parameters, and datasets. |
| FR-10 | Let authorized users view previously collected environmental data and recommendation records. |

### 7.2 Non-functional requirements
| Theme | Requirement |
|---|---|
| Performance | Ingest and recommend within an acceptable period, without unnecessary delay. |
| Reliability | Consistent operation; minimize data loss during collection and transmission. |
| Usability | Simple interface for users with limited technical knowledge. |
| Security | Authentication, authorization, secure data handling for accounts and stored data. |
| Availability | Available whenever network, hardware, and external data services operate. |
| Scalability | Accommodate more crops, sensors, users, and geographical locations. |
| Modularity / maintainability | Swap or update model, database, sensors, or app components without a full rebuild. |
| Predictive quality | Acceptable performance under the study's chosen evaluation criteria. |
| Interoperability | Interfaces/APIs for supported IoT devices and external weather services. |
| Device reach | Accessible from smartphones, tablets, or computers. |

### 7.3 Documented technology choices
| Layer | Choice |
|---|---|
| AI/ML & backend language | Python |
| ML library | scikit-learn |
| Data processing | Pandas, NumPy |
| Database | MySQL |
| Weather | Weather API (proposal Chapter 3 names **Open-Meteo**) |
| Firmware | C/C++ on ESP32, Arduino IDE |
| Web UI | HTML, CSS, JavaScript |
| Editor | VS Code |
| Hardware | Laptop, ESP32, soil moisture sensor, DHT22, soil pH sensor, breadboard + jumper wires, power supply |

> ⚠️ The proposal specifies **Flask + MySQL + HTML/CSS/JS**, while the repository's `README.md` and current code use **FastAPI + PostgreSQL + Next.js/TypeScript**. See the blueprint for the decision points this creates.

---

## 8. Literature review — examined systems and the research gap

Four prior works were reviewed using a consistent framework: background, successes, failures, standing.

### 8.1 Islam et al. (2023) — ML-enabled IoT soil nutrient monitoring and crop recommendation
- **Design:** FC-28, DHT11, JXBS-3001 sensors; MQTT to a server; ML analysis; fertilizer recommendations; mobile app; field experiments; compared with traditional approaches.
- **Successes:** automated soil monitoring, data-driven recommendations, timely information, improved decisions, reduced manual effort, precision-agriculture potential, extensible foundation.
- **Failures:** sensor inaccuracies, network interruptions, limited environmental data (soil nutrients only), ML limitations from insufficient/outdated/unrepresentative data, power failures, hardware maintenance, poor geographical adaptability, risk of incorrect recommendations.
- **Standing:** a practical foundation for combining IoT sensors, ML, transmission, and a UI.

### 8.2 Cheema & Pires (2025) — IoT soil nutrient analysis and crop recommendation
- **Design:** soil moisture, temperature and (where possible) NPK sensors; external weather data; AI/ML recommendation. Inputs include pH, N, P, K, temperature, humidity, rainfall. Algorithms evaluated: Decision Tree, AdaBoost-enhanced Decision Tree, KNN, Random Forest, SVM.
- **Successes:** real-time monitoring, data-driven selection, better decisions, less manual monitoring, historical analysis, potential resource efficiency.
- **Failures (stated as failure modes):** missing/implausible sensor values, unavailable/outdated weather data, out-of-range model inputs, server/database unavailability, prolonged network loss.
- **Standing:** combines soil and weather data in an AI recommendation pipeline.

### 8.3 Kagucia (2017) — Data-mining crop-yield prediction in Kenya
- **Design:** historical agricultural data (rainfall, temperature, soil, varieties, seasons, yields); decision trees/regression/ML; yield estimates; reports and comparisons.
- **Successes:** yield prediction, better planning/resource management, early risk identification, food-security planning, trend discovery, reduced guesswork.
- **Failures:** poor data quality, historical-data dependence, weather variability, limited regional applicability, model error, limited real-time data, high data-collection cost, farming practices under-represented, accessibility/skills barriers, climate change eroding accuracy.
- **Standing:** demonstrates agricultural prediction and planning support.

### 8.4 FAO CropSuit (2026)
- **Design:** web-based geospatial suitability assessment under FAO's Soil FER programme, built on GAEZ (FAO + IIASA). Uses soil, climate, topography, land cover. Map-based interface, crop comparison, constraint identification, decision support.
- **Success / standing:** structured multi-factor suitability assessment across locations.
- **Gap:** it is geospatial, and does **not** represent the ESP32-based live sensor acquisition plus integrated web-backend architecture proposed here.

### Research gap (combined)
No examined system delivers the specific combination proposed here: **low-cost live ESP32 soil sensing + external weather enrichment + a trained local crop-suitability model + a simple integrated web dashboard with role-based access and retained history**, validated for Kenyan smallholder conditions. Existing work is either sensor-focused, historical/yield-focused, or geospatial — not this integrated, real-time, farm-specific pipeline.

---

## 9. Methodology and system design (Proposal Chapter 3)

### 9.1 Development approach
Agile, iterative, incremental. **Two-week sprints**, each delivering a testable slice reviewed with the supervisor. Hardware, ML model, backend, and dashboard are built in parallel and joined through a **fixed JSON data format**, allowing independent testing.

### 9.2 Six phases
1. **Requirements & planning** — review literature, confirm Chapter 1 requirements, agree the supported crop list with an extension officer, prepare the work plan (Appendix A).
2. **System design** — architecture (Figure 3.1), MySQL database design (users, farms, devices, sensor readings, weather readings, crops, recommendations), REST API, dashboard wireframes.
3. **Data & model development** — prepare dataset, train and compare candidate models, persist the best model for backend use.
4. **Hardware & firmware** — breadboard sensor node, calibrate sensors, program ESP32 in C/C++ (Arduino IDE) to read, check, and send.
5. **Backend & dashboard** — Flask service that receives readings, retrieves weather, runs the model, stores results; HTML/CSS/JS dashboard.
6. **Integration, testing & documentation** — connect all parts, end-to-end test, fix defects, write final report.

### 9.3 Architecture detail
**Field node:** soil moisture sensor, soil pH sensor, DHT22 connected to ESP32. Takes several readings at a set interval (**every 10 minutes by default**), averages them, rejects values outside valid ranges, and sends JSON over Wi-Fi via **HTTPS** to the application server. Analog sensors use **ADC1 pins** because ADC2 is unavailable while Wi-Fi is active.

**Server:** validates each message → stores in MySQL → retrieves current weather and recent rainfall for the farm's coordinates from the **Open-Meteo API** → builds model input → runs trained model → stores recommendation.

**Dashboard:** sign-in; latest readings, trends, recommended crops. **Three roles: farmer, extension officer, administrator.**

**Resilience behaviour:**
- Network down → ESP32 keeps recent unsent readings and forwards them when connectivity returns.
- Weather service unavailable → dashboard shows the last known weather **explicitly marked as out of date**.

### 9.4 Data and model development

**Dataset:** public Crop Recommendation Dataset (Ingle, n.d.) — **2,200 records, 22 crops**, with N, P, K, temperature, humidity, pH, rainfall. Because it was compiled from Indian data:
- Reduce the crop list to crops grown in Kenya.
- Cross-check remaining crops against published agronomic guidance (KALRO, FAO EcoCrop) and an extension officer.
- Add crops such as potatoes, tomatoes, or kale only where reliable requirement ranges exist; report those results separately.

**Two-model strategy (Table 3.1):**

| Input | Source | Standard model | Extended model |
|---|---|---|---|
| Soil pH | Soil pH sensor | Yes | Yes |
| Air temperature | DHT22 | Yes | Yes |
| Relative humidity | DHT22 | Yes | Yes |
| Rainfall | Open-Meteo API | Yes | Yes |
| N, P, K | User-entered from soil-test report | No | Yes |
| Soil moisture | Soil moisture sensor | **No — dashboard display only** | **No — dashboard display only** |

Rationale: NPK is not measured by the hardware; soil moisture is not in the public training dataset, so it is stored and visualized but never used as a training feature.

**Preparation:** check missing/impossible values and duplicates; scale features where the algorithm requires it; sum weather-service rainfall over a period matched to the dataset (period fixed during preparation).

**Training and selection:** Decision Tree, KNN, SVM, Random Forest, Gradient Boosting — all in scikit-learn. **Stratified 80/20 split, five-fold cross-validation.** Compare on accuracy, macro-averaged precision/recall/F1, and confusion matrices. Save the best model **for each of the two input sets** with joblib; backend loads them. **Target: ≥90% accuracy on the held-out test set.** Public-dataset accuracy is not treated as proof of Kenyan performance — recommendations are also checked against agronomic guidance and extension-officer judgement.

**Output:** the **three most suitable crops with predicted probabilities**, giving the farmer alternatives rather than a single answer.

### 9.5 Testing and validation
- **Sensor calibration:** pH with buffers 4.01 and 6.86; moisture with dry/wet references; DHT22 against a reference thermometer; record each sensor's error.
- **Unit & API testing:** `pytest`, covering validation functions, DB queries, endpoints, plus invalid, missing, and out-of-range inputs.
- **Model evaluation:** cross-validation and held-out test results as above.
- **Integration & resilience testing:** full sensor→dashboard path must produce an updated recommendation within **one minute**; simulate Wi-Fi outage, weather-service outage, and faulty sensor; system must not crash or present stale data as current.
- **Pilot & user testing:** at least **two weeks** on a pilot plot (or simulated setting); farmers and extension officers complete a short usability questionnaire; recommendations compared with local knowledge.

### 9.6 Ethics and data protection
Voluntary participation with informed consent. Store only account details, farm location, sensor and recommendation data. **Passwords hashed**, **HTTPS** for server communication, access to a farm's data limited to its owner, assigned extension officers, and administrators. Comply with Kenya's **Data Protection Act, 2019**, and departmental procedures for human-participant work.

### 9.7 Methodology justification (stated)
- Agile suits a four-component system whose main risks (noisy sensors, unreliable connectivity, local model performance) only surface when parts are integrated; short sprints expose risk early versus waterfall.
- A team of seven can split by component and merge each sprint.
- Supervisor/user feedback feeds the next sprint — important for a farmer-facing UI.
- ESP32: built-in Wi-Fi and analog inputs at low cost.
- Open-Meteo: free for non-commercial use, global coordinates, attribution only.
- Flask and MySQL: lightweight, documented, familiar to the team.
- scikit-learn: compare several classifiers with one code path; tree-based ensembles are candidates because a tree-based AdaBoost model performed best in earlier work, but final choice rests on this project's own results.
- Realistic scope: core prototype (sensor node, server, model, dashboard) is the priority; GSM connectivity and additional crops are optional and droppable.

---

## 10. Work plan and budget

### Work plan (Appendix A — 12-week schedule)

| Task | Window |
|---|---|
| Requirements and planning | early |
| System design | early |
| Dataset preparation and model training | early–middle |
| Hardware assembly, firmware and sensor calibration | early–middle |
| Backend and database development | middle |
| Dashboard development | middle |
| Integration and system testing | late |
| Pilot run and user feedback | late |
| Documentation and final report | late |
| Presentation and submission | final |

(The source table marks activity with shaded cells at WK2, WK4, WK6, WK8, WK10, WK12; exact shading was not recoverable from the extracted text — re-check the original table if precise scheduling is required.)

### Budget (Appendix B)

| # | Item | Qty | Unit (KES) | Total (KES) |
|---|---|---|---|---|
| 1 | ESP32 development board | 2 | 1,500 | 3,000 |
| 2 | Capacitive soil moisture sensor | 2 | 500 | 1,000 |
| 3 | Soil pH sensor with probe and signal board | 1 | 6,500 | 6,500 |
| 4 | DHT22 temperature and humidity sensor | 2 | 800 | 1,600 |
| 5 | pH buffer solution set | 1 | 800 | 800 |
| 6 | Breadboard, jumper wires and resistors | 1 | 700 | 700 |
| 7 | 5 V power supply or power bank | 1 | 1,500 | 1,500 |
| 8 | Weatherproof enclosure and cable glands | 1 | 1,500 | 1,500 |
| 9 | Web hosting for the backend (6 months) | 1 | 3,000 | 3,000 |
| 10 | Internet data bundles | 1 | 3,000 | 3,000 |
| 11 | Printing, binding and stationery | 1 | 3,500 | 3,500 |
| 12 | Transport for pilot testing | 1 | 5,000 | 5,000 |
| | **Subtotal** | | | **31,100** |
| | **Contingency (10%)** | | | **3,110** |
| | **Total** | | | **34,210** |

Team laptops are assumed available and are not costed. Prices are estimates pending supplier confirmation.

---

## 11. References (as cited)

- Cheema, S. M., & Pires, I. M. (2025). A IoT based soil nutrient analysis and recommendation system for crops using machine learning. *Smart Agricultural Technology, 11*, 100924.
- FAO. (2026). FAO launches CropSuit app to help farmers grow the right crops in the right places.
- Ingle, A. (n.d.). *Crop recommendation dataset* [Kaggle data set].
- Islam, M. R., Oliullah, K., Kabir, M. M., Alom, M., & Mridha, M. F. (2023). Machine learning enabled IoT system for soil nutrients monitoring and crop recommendation. *Journal of Agriculture and Food Research, 14*, 100880.
- Kagucia, B. M. (2017). *Data mining approach for building predictive model for crop yield data* [KCA University].
- Pedregosa, F., et al. (2011). Scikit-learn: Machine learning in Python. *JMLR, 12*, 2825–2830.
- Republic of Kenya. (2015). Statement at the 39th session of the FAO Conference.
- Republic of Kenya. (2019). *Data Protection Act, No. 24 of 2019.*
- Situational analysis of the agriculture sector NDC in Kenya. (2024). AGRIS/FAO.
- Zippenfenig, P. (2023). *Open-Meteo.com weather API* (Zenodo, doi:10.5281/zenodo.7970649).

---

## 12. Open conflicts and decisions to confirm

These are genuine contradictions between the submitted documents and/or the existing repository. They need an explicit decision before implementation proceeds.

| # | Conflict | Sources | Needed decision |
|---|---|---|---|
| 1 | **Flask** (proposal Ch.3) vs **FastAPI** (README, code) | Proposal §3.1.1/3.1.2 vs `backend/app/main.py` | Which backend framework is authoritative? |
| 2 | **MySQL** (proposal) vs **PostgreSQL** (`DATABASE_URL`, README deps) | Proposal §3.1.1 vs `config.py` / `.env.example` | Which database? |
| 3 | **HTML/CSS/JS** (proposal tools) vs **Next.js + TypeScript** (README, `NEXT_PUBLIC_API_URL`) | Proposal §1.10.3 vs `frontend/.env.example` | Which frontend stack? |
| 4 | **Two models / 5 algorithms / CV / ≥90%** (proposal) vs **one 7-feature Random Forest, single split** (code) | Proposal §3.1.3 vs `train_model.py` | Implement the documented two-model strategy? |
| 5 | **Weather enrichment, sensor ingestion, history, auth/roles, resilience** documented — none in code | Proposal §3.1.2 vs current repo | Build these (they are core functional requirements, not optional). |
| 6 | **1 month** vs **12 weeks** | Concept §1.7.5 vs Proposal Appendix A | Confirm realistic schedule. |
| 7 | `backend/requirements.txt` is **empty**, yet code imports fastapi, pydantic-settings, joblib, pandas, sklearn, uvicorn | repo state | Populate pinned dependencies. |

> **Recommendation:** treat the **proposal (Chapter 3)** as the functional/architectural specification and the **concept paper** as the context and requirements source. Resolve items 1–3 by choosing one coherent stack and updating the losing document at the next revision; the blueprint below assumes the existing FastAPI/PostgreSQL/Next.js stack is retained unless told otherwise, because it is already scaffolded and more capable, but flags every place the proposal's intent must still be met.
