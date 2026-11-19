-- =====================================================================
-- Smart Agriculture - MySQL queries for API endpoints #19-#36
-- Source contract : docs/API_DOCUMENTATION.md
-- Run with        : mysql -u <user> -p smart_agriculture < database/queries.sql
--
-- These statements are the database operations behind each endpoint.
-- Values are bound through @variables for demonstration; the application
-- should use prepared statements / parameter binding, never string concat.
-- Pagination shown as page 1 with page_size 50 -> LIMIT 0, 50.
-- =====================================================================

USE smart_agriculture;

-- Example bindings (replace with values supplied by the authenticated request)
SET @farm_id   := (SELECT id FROM farms WHERE name = 'Demo Farm' LIMIT 1);
SET @user_id   := (SELECT id FROM users WHERE email = 'farmer@smartagri.local' LIMIT 1);
SET @admin_id  := (SELECT id FROM users WHERE email = 'admin@smartagri.local' LIMIT 1);
SET @device_id := (SELECT id FROM devices WHERE label = 'ESP32-001' LIMIT 1);
SET @from_date := '2026-11-01 00:00:00';
SET @to_date   := '2026-11-20 23:59:59';
SET @q         := '';
SET @crop_code := 'maize';
SET @param_key := 'min_confidence';
SET @actor_id  := NULL;
SET @recommendation_id := (SELECT id FROM recommendations LIMIT 1);
SET @soil_reading_id := (
  SELECT id FROM soil_readings WHERE farm_id = @farm_id
  ORDER BY recorded_at DESC LIMIT 1
);
SET @weather_reading_id := (
  SELECT id FROM weather_readings WHERE farm_id = @farm_id
  ORDER BY recorded_at DESC LIMIT 1
);

-- =====================================================================
-- #19  GET /api/v1/soil-readings
--      ?farm_id&from&to&page&page_size  -> Page<SoilReading>
-- =====================================================================
SELECT id, farm_id, device_id, recorded_at,
       n AS N, p AS P, k AS K,
       temperature, humidity, ph, rainfall, soil_moisture,
       source, is_valid, quality_flags
FROM soil_readings
WHERE farm_id = @farm_id
  AND recorded_at BETWEEN @from_date AND @to_date
ORDER BY recorded_at DESC
LIMIT 0, 50;

-- Total row count for the pagination envelope
SELECT COUNT(*) AS total
FROM soil_readings
WHERE farm_id = @farm_id
  AND recorded_at BETWEEN @from_date AND @to_date;

-- =====================================================================
-- #20  GET /api/v1/soil-readings/latest  -> SoilReading (dashboard card)
-- =====================================================================
SELECT id, farm_id, device_id, recorded_at,
       n AS N, p AS P, k AS K,
       temperature, humidity, ph, rainfall, soil_moisture,
       source, is_valid, quality_flags
FROM soil_readings
WHERE farm_id = @farm_id
  AND is_valid = 1
ORDER BY recorded_at DESC
LIMIT 1;

-- =====================================================================
-- #21  GET /api/v1/weather/current  -> WeatherReading
--      is_stale is exposed to the UI as "out of date".
-- =====================================================================
SELECT id, farm_id, recorded_at, temperature, humidity, rainfall,
       source, provider, is_stale AS out_of_date
FROM weather_readings
WHERE farm_id = @farm_id
ORDER BY recorded_at DESC
LIMIT 1;

-- =====================================================================
-- #22  GET /api/v1/weather  -> Page<WeatherReading>
-- =====================================================================
SELECT id, farm_id, recorded_at, temperature, humidity, rainfall,
       source, provider, is_stale
FROM weather_readings
WHERE farm_id = @farm_id
  AND recorded_at BETWEEN @from_date AND @to_date
ORDER BY recorded_at DESC
LIMIT 0, 50;

SELECT COUNT(*) AS total
FROM weather_readings
WHERE farm_id = @farm_id
  AND recorded_at BETWEEN @from_date AND @to_date;

-- =====================================================================
-- #23  POST /api/v1/weather/refresh  -> WeatherReading
--      Mark existing rows stale before storing the freshly fetched one.
-- =====================================================================
UPDATE weather_readings
SET is_stale = 1
WHERE farm_id = @farm_id AND is_stale = 0;

INSERT INTO weather_readings
  (farm_id, recorded_at, temperature, humidity, rainfall, source, provider,
   provider_payload, is_stale)
VALUES
  (@farm_id, UTC_TIMESTAMP(), 25.60, 62.00, 0.00, 'api', 'open-meteo',
   JSON_OBJECT('source', 'open-meteo', 'provider', 'fresh_fetch'), 0);

SELECT LAST_INSERT_ID() AS weather_reading_id;

-- =====================================================================
-- #24  POST /api/v1/recommendations  -> Recommendation
--      Persist the inference result together with its model version.
--      Use the exact low-confidence sentinel when confidence < min_confidence.
-- =====================================================================
INSERT INTO recommendations
  (farm_id, soil_reading_id, weather_reading_id, requested_by_user_id,
   recommended_crop, confidence, alternatives, status, advice, model_version)
VALUES
  (@farm_id, @soil_reading_id, @weather_reading_id, @user_id,
   'maize', 0.8841,
   JSON_ARRAY(
     JSON_OBJECT('crop', 'maize', 'confidence', 0.8841),
     JSON_OBJECT('crop', 'rice',  'confidence', 0.0712),
     JSON_OBJECT('crop', 'mango', 'confidence', 0.0210)
   ),
   'ok', NULL, 'rf-2026-11-v1');

SELECT LAST_INSERT_ID() AS recommendation_id;

-- =====================================================================
-- #25  GET /api/v1/recommendations  -> Page<Recommendation>
-- =====================================================================
SELECT id, farm_id, soil_reading_id, weather_reading_id,
       recommended_crop, confidence, alternatives, status, advice,
       model_version, created_at
FROM recommendations
WHERE farm_id = @farm_id
  AND created_at BETWEEN @from_date AND @to_date
ORDER BY created_at DESC
LIMIT 0, 50;

SELECT COUNT(*) AS total
FROM recommendations
WHERE farm_id = @farm_id
  AND created_at BETWEEN @from_date AND @to_date;

-- =====================================================================
-- #26  GET /api/v1/recommendations/latest  -> Recommendation (dashboard card)
-- =====================================================================
SELECT id, farm_id, recommended_crop, confidence, alternatives,
       status, advice, model_version, created_at
FROM recommendations
WHERE farm_id = @farm_id
ORDER BY created_at DESC
LIMIT 1;

-- =====================================================================
-- #27  GET /api/v1/recommendations/{id}  -> Recommendation
-- =====================================================================
SELECT id, farm_id, soil_reading_id, weather_reading_id,
       requested_by_user_id, recommended_crop, confidence, alternatives,
       status, advice, model_version, created_at
FROM recommendations
WHERE id = @recommendation_id;

-- Override @recommendation_id when testing a specific record.

-- =====================================================================
-- #28  GET /api/v1/crops  -> Page<Crop>
--      q filters code/name; is_active comes from the query string.
-- =====================================================================
SELECT id, code, name, local_name, optimal, is_active
FROM crops
WHERE is_active = 1
  AND (@q = '' OR code LIKE CONCAT('%', @q, '%')
               OR name LIKE CONCAT('%', @q, '%'))
ORDER BY name
LIMIT 0, 50;

SELECT COUNT(*) AS total
FROM crops
WHERE is_active = 1
  AND (@q = '' OR code LIKE CONCAT('%', @q, '%')
               OR name LIKE CONCAT('%', @q, '%'));

-- =====================================================================
-- #29  GET /api/v1/crops/{code}  -> Crop
-- =====================================================================
SELECT id, code, name, local_name, optimal, is_active
FROM crops
WHERE code = @crop_code;

-- =====================================================================
-- #30  POST / PATCH / DELETE /api/v1/crops[/{code}]  (admin)
--      Prefer deactivation over physical deletion to preserve history.
-- =====================================================================
-- POST - create
INSERT IGNORE INTO crops (code, name, local_name, optimal, is_active)
VALUES ('potato', 'Potato', 'Viazi', '{}', 1);

-- PATCH - update catalogue entry / suitability ranges
UPDATE crops
SET name = 'Maize (Corn)',
    local_name = 'Mahindi',
    optimal = JSON_OBJECT('ph', JSON_ARRAY(5.5, 7.5),
                          'temperature', JSON_ARRAY(18, 32))
WHERE code = @crop_code;

-- DELETE - preferred: deactivate
UPDATE crops SET is_active = 0 WHERE code = @crop_code;

-- Hard delete only if no recommendations reference the crop by code
-- DELETE FROM crops WHERE code = @crop_code AND is_active = 0;

-- Re-enable for later demo queries
UPDATE crops SET is_active = 1 WHERE code = @crop_code;

-- =====================================================================
-- #31  GET / PATCH /api/v1/admin/system-params
--      The 0.60 confidence gate lives here; no rebuild needed to change it.
-- =====================================================================
SELECT `key`, `value`, description, updated_by, updated_at
FROM system_params
ORDER BY `key`;

-- PATCH (upsert)
INSERT INTO system_params (`key`, `value`, description, updated_by)
VALUES (@param_key, '0.65', 'Raised confidence gate', @admin_id)
ON DUPLICATE KEY UPDATE
  `value` = VALUES(`value`),
  description = VALUES(description),
  updated_by = VALUES(updated_by);

-- Restore the documented default
UPDATE system_params SET `value` = '0.60' WHERE `key` = 'min_confidence';

-- =====================================================================
-- #32  GET / POST /api/v1/admin/datasets
-- =====================================================================
SELECT id, name, file_uri, rows_count, status, uploaded_by, created_at
FROM datasets
ORDER BY created_at DESC
LIMIT 0, 50;

INSERT INTO datasets (name, file_uri, rows_count, status, uploaded_by)
VALUES ('Kenya Crop Dataset - pilot', 'backend/data/kenya_crops.csv',
        NULL, 'uploaded', @admin_id);

-- Validation step performed by the admin action, never auto-retraining:
-- UPDATE datasets SET status = 'validated', rows_count = 2200 WHERE id = LAST_INSERT_ID();

-- =====================================================================
-- #33  GET /api/v1/model/info
--      DB-backed equivalent of models/model_metrics.json.
-- =====================================================================
SELECT version, features, classes, test_accuracy, trained_at, artifact_path
FROM model_info
WHERE is_active = 1
LIMIT 1;

-- =====================================================================
-- #34  GET /api/v1/reports/summary  -> aggregated readings + recommendations
-- =====================================================================
-- Daily reading aggregates (avg_moisture, avg_ph, timeline)
SELECT DATE(sr.recorded_at) AS day,
       COUNT(*)              AS readings_count,
       ROUND(AVG(sr.soil_moisture), 2) AS avg_moisture,
       ROUND(AVG(sr.ph), 2)            AS avg_ph,
       ROUND(AVG(sr.temperature), 2)    AS avg_temperature,
       ROUND(SUM(sr.rainfall), 2)       AS total_rainfall
FROM soil_readings sr
WHERE sr.farm_id = @farm_id
  AND sr.is_valid = 1
  AND sr.recorded_at BETWEEN @from_date AND @to_date
GROUP BY DATE(sr.recorded_at)
ORDER BY day;

-- Recommendation distribution
SELECT recommended_crop,
       status,
       COUNT(*) AS recommendation_count,
       ROUND(AVG(confidence), 4) AS avg_confidence
FROM recommendations
WHERE farm_id = @farm_id
  AND created_at BETWEEN @from_date AND @to_date
GROUP BY recommended_crop, status
ORDER BY recommendation_count DESC;

-- Combined timeline for the dashboard chart
SELECT 'soil_reading' AS event_type,
       sr.recorded_at AS event_at,
       NULL           AS recommended_crop,
       NULL           AS confidence
FROM soil_readings sr
WHERE sr.farm_id = @farm_id
  AND sr.recorded_at BETWEEN @from_date AND @to_date
UNION ALL
SELECT 'recommendation' AS event_type,
       r.created_at     AS event_at,
       r.recommended_crop,
       r.confidence
FROM recommendations r
WHERE r.farm_id = @farm_id
  AND r.created_at BETWEEN @from_date AND @to_date
ORDER BY event_at DESC;

-- =====================================================================
-- #35  GET /api/v1/reports/export  -> text/csv
--      Same filter as /reports/summary; the app serialises rows to CSV.
--      (SELECT ... INTO OUTFILE requires FILE privilege and a server path,
--       so it is intentionally avoided here.)
-- =====================================================================
SELECT sr.recorded_at,
       n AS N, p AS P, k AS K,
       sr.temperature, sr.humidity, sr.ph, sr.rainfall, sr.soil_moisture,
       r.recommended_crop, r.confidence, r.status, r.model_version
FROM soil_readings sr
LEFT JOIN recommendations r
       ON r.soil_reading_id = sr.id
      AND r.farm_id = sr.farm_id
WHERE sr.farm_id = @farm_id
  AND sr.recorded_at BETWEEN @from_date AND @to_date
ORDER BY sr.recorded_at DESC;

-- =====================================================================
-- #36  GET /api/v1/audit-logs  -> Page<AuditLog> (admin)
-- =====================================================================
SELECT id, actor_user_id, action, entity, entity_id, metadata, created_at
FROM audit_logs
WHERE (@actor_id IS NULL OR actor_user_id = @actor_id)
  AND created_at BETWEEN @from_date AND @to_date
ORDER BY created_at DESC
LIMIT 0, 50;

SELECT COUNT(*) AS total
FROM audit_logs
WHERE (@actor_id IS NULL OR actor_user_id = @actor_id)
  AND created_at BETWEEN @from_date AND @to_date;
