# Project Requirements & Key Details

> Source: `C:\Users\DAVID\Desktop\Concept Paper.docx` (proposal only — code base not yet reviewed)

## 1. Project Identity

- **Title:** *An IoT and AI-Based Crop Recommendation System Using Real-Time Soil and Weather Data*
- **Submitted by:** Group IV — Department of Information Technology, School of Computing and Informatics, Kibabii University
- **Degree:** Bachelor of Science in Information Technology
- **Date:** November 2026
- **Members:**
  - BIT/0005/24 — Kadenge Jayson Sifa
  - BIT/0006/24 — Mahindu Ernest Asinuli
  - BIT/0074/24 — Flevian Musimbi
  - BIT/0009/24 — Kiponda Moses Hinzano
  - BIT/0036/24 — Purity Cherotich
  - BIT/0055/24 — Paul Ijakaa
  - BIT/0013/24 — Hillary Mureri

## 2. Purpose

Develop an IoT + AI system that collects real-time soil and weather data and recommends crops suited to specific farm conditions.

> **The system is a decision-support tool, not an automation/control system.**

## 3. Problem Statement

- Smallholder farmers in Kenya rely on **experience, tradition, trial-and-error, and generalised advice** rather than current, farm-specific data.
- Crop performance depends on **soil moisture, temperature, pH, nutrients, humidity, and rainfall** — conditions that change over time.
- Poor choices cause **low yields, wasted water/fertiliser/labour, and financial loss**.
- Gap: **no integrated, low-cost, accessible solution combining real-time soil sensing + weather data + AI recommendation** for small farms.
- Existing tools are either expensive, designed for large commercial farms, or rely on manually entered/historical data.

## 4. Objectives

### 4.1 System-Level Objectives

1. Provide real-time **soil data** (moisture, temperature, humidity, pH) from the farm.
2. Provide real-time **weather data** relevant to the farm location.
3. **Recommend suitable crops** based on current soil and weather conditions.
4. Present sensor readings and recommendations through a **simple user interface**.
5. **Store historical** soil, weather, and recommendation data for monitoring and future analysis.
6. **Update recommendations** when environmental conditions change.

### 4.2 Developer-Level Objectives

1. Design overall **architecture** (sensors → microcontroller → network → database → AI model → user interface).
2. Select and integrate appropriate sensors for required soil parameters.
3. Program an **ESP32** microcontroller to acquire, process, and transmit readings.
4. Implement communication (**Wi-Fi or GSM**) from farm to backend server/cloud.
5. Develop a **database** for real-time and historical soil, weather, and recommendation data.
6. Identify and prepare suitable agricultural **datasets** for training/testing.
7. **Pre-process and analyse** datasets.
8. **Develop, train, and evaluate an AI model** for crop recommendation.
9. Design and develop a **web dashboard** for readings and recommendations.
10. Test and validate under real or simulated farm conditions.

## 5. Justification & Significance

- Justified by need for a **low-cost, accessible, farm-specific** tool.
- Uses **live sensor data** (not just manual/historical input) and **updates recommendations as conditions change** — the key differentiator.

### Beneficiaries

- **Farmers** — data-driven, farm-specific crop-selection advice.
- **Agricultural extension officers** — supporting tool complementing field assessments.
- **Institutions and researchers** — framework for precision agriculture research.
- **Students and future developers** — reference example of integrated hardware/software/AI system.

### Area of Impact

- **Agricultural productivity** — supports better planning (decision-support only; does not directly control yield).
- **Information Technology** — demonstrates integration of IoT, AI, ML, data analytics, databases, and web development.

## 6. Scope

- **Domain:** IT — Artificial Intelligence, IoT, Data Analytics, Smart Agriculture.
- **Geographical scope:** Small-scale farmers in **Kenya**; local conditions; data from a selected study area; crops include **maize, beans, potatoes, and selected vegetables**.
- **Functionalities:**
  - Collect soil data using sensors
  - Collect environmental/weather data
  - Store collected data
  - Process and analyse data
  - Generate crop recommendations
  - Display recommendations to user
  - Provide basic historical data and reports
- **Out of scope:** pest/disease detection, irrigation control, fertiliser application guidance, market pricing, farm equipment automation.
- **Duration:** Academic project period — requirements analysis, design, implementation, testing, documentation.

## 7. Limitations

- **Dataset availability** — model performance depends on quality, size, relevance, diversity of data.
- **Weather-data availability** — access to reliable real-time/historical weather data may be limited.
- **Internet/network connectivity** — transmission affected by poor connectivity in remote areas.
- **Hardware and financial constraints** — number/scope of sensors limited by cost and availability.
- **Changing environmental conditions** — recommendations may not remain suitable long-term.

## 8. Assumptions

- Selected soil sensors provide sufficiently reliable measurements.
- Relevant soil, weather, and crop datasets are available.
- Crop–condition relationships are learnable from available data.
- Users have a smartphone, tablet, or computer.
- Selected parameters are useful though not exhaustive.
- Supported crops have documented environmental/soil requirements.
- Stable network connection during development and testing.

## 9. System Requirements

### 9.1 Functional Requirements

The proposed system shall:

1. Allow authorised users to **register and log in**.
2. **Collect soil data** from connected IoT sensors.
3. **Transmit sensor readings** from field to processing/application server.
4. **Acquire weather information** from an appropriate weather-data source.
5. **Store soil, weather, user, and crop-recommendation data** in a database.
6. **Pre-process and validate** collected soil and weather data before analysis.
7. Use the **trained AI model** to analyse soil and weather conditions.
8. **Generate crop recommendations** based on analysed environmental conditions.
9. Provide **administrators** with functionality for managing users, crop information, system parameters, and datasets.
10. Allow authorised users to **view historical** environmental data and recommendation records.

### 9.2 Non-Functional Requirements

The proposed system shall:

- Process incoming data and generate recommendations within an acceptable time.
- Operate consistently and minimise data loss during collection/transmission.
- Have a **simple, easy-to-understand UI** for users with limited technical knowledge.
- **Protect accounts and data** via authentication, authorisation, and secure data handling.
- Be available whenever required network, hardware, and external data services are operational.
- Be **scalable** — additional crops, sensors, users, and locations can be added.
- Be **modular** — AI model, database, sensors, or application components can be updated without full rebuild.
- Achieve an **acceptable level of predictive performance**.
- Communicate with IoT devices and weather services via appropriate interfaces/APIs.
- Be accessible through smartphones, tablets, or computers.

## 10. Technology Stack

| Area | Tools / Technologies |
|------|----------------------|
| AI/ML, data processing, backend | Python |
| Machine learning | Scikit-learn |
| Data processing | Pandas |
| Numerical computation | NumPy |
| Database | MySQL |
| Weather data | Weather API |
| Code development | VS Code |
| ESP32 programming | Arduino IDE |
| IoT hardware | ESP32, soil moisture sensor, DHT22 (temp/humidity), soil pH sensor, breadboard, jumper wires, power supply |
| Programming languages | Python (AI/ML, backend), C/C++ (ESP32), HTML, CSS, JavaScript (web interface) |
| Development hardware | Laptop |

## 11. Citations

- Herrero et al. (2010) — climate variability and changing environmental conditions in agriculture.
- Islam et al. (2023) — IoT sensors for real-time soil information; ML algorithms generate crop recommendations.
- Cheema & Pires (2025) — integrating soil nutrient analysis, environmental data, and ML supports informed crop selection.

## 12. Groundwork — Underlined Takeaways for Development

1. **Architecture is fixed at a high level:** ESP32/sensors → Wi-Fi/GSM → backend (Python + MySQL + Weather API) → ML model → web dashboard.
2. **Core data pipeline:** acquire → validate/pre-process → store → infer → recommend → display → archive history.
3. **ML is central but bounded:** must be trained/evaluated on agricultural data; predictive performance is an explicit requirement.
4. **Auth + roles (user/admin) are required**, not optional.
5. **Keep it modular and simple:** low-cost, accessible, simple UI, swappable components.
6. **Do not build out-of-scope features:** pest detection, irrigation control, fertiliser, market prices, automation.
