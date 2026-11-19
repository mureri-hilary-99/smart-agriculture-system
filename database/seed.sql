-- =====================================================================
-- Smart Agriculture - reference and demo data
-- Run with : mysql -u <user> -p smart_agriculture < database/seed.sql
--
-- Sections:
--   1. System parameters (includes the 0.60 confidence gate)
--   2. Crop catalogue (the 22 classes of the public Kaggle dataset)
--   3. Demo users / farm / device so the example queries in queries.sql run
--   4. Demo soil, weather and recommendation records
--   5. Datasets registry, model info and one audit entry
--
-- IMPORTANT: replace the password_hash placeholders with real hashes before
-- using these accounts. Seed data is safe to load once; the guards below
-- make re-running it mostly idempotent.
-- =====================================================================

USE smart_agriculture;

-- ---------------------------------------------------------------------
-- 1. System parameters (endpoint #31)
-- ---------------------------------------------------------------------
INSERT INTO system_params (`key`, `value`, description) VALUES
  ('min_confidence',             '0.60', 'Predictions below this confidence return the low-confidence sentinel'),
  ('sensor_interval_minutes',    '10',   'ESP32 sampling interval in minutes'),
  ('weather_cache_ttl_minutes',  '30',   'How long a weather response may be reused'),
  ('stale_weather_max_minutes',  '60',   'Older weather is shown in the UI as out of date'),
  ('dashboard_poll_seconds',     '45',   'Recommended dashboard refresh interval'),
  ('default_page_size',          '50',   'Default pagination size'),
  ('max_page_size',              '100',  'Maximum pagination size')
ON DUPLICATE KEY UPDATE
  `value` = VALUES(`value`),
  description = VALUES(description);

-- ---------------------------------------------------------------------
-- 2. Crop catalogue (endpoints #28-#30)
-- 'optimal' is intentionally empty: populate from KALRO / FAO EcoCrop
-- guidance and the extension officer's review, as required by the proposal.
-- ---------------------------------------------------------------------
INSERT IGNORE INTO crops (code, name, local_name, optimal, is_active) VALUES
  ('apple',       'Apple',       'Tofaa',       '{}', 1),
  ('banana',      'Banana',      'Ndizi',       '{}', 1),
  ('blackgram',   'Black Gram',  NULL,          '{}', 1),
  ('chickpea',    'Chickpea',    NULL,          '{}', 1),
  ('coconut',     'Coconut',     'Nazi',        '{}', 1),
  ('coffee',      'Coffee',      'Kahawa',      '{}', 1),
  ('cotton',      'Cotton',      'Pamba',       '{}', 1),
  ('grapes',      'Grapes',      'Zabibu',      '{}', 1),
  ('groundnut',   'Groundnut',   'Karanga',     '{}', 1),
  ('jute',        'Jute',        NULL,          '{}', 1),
  ('kidneybeans', 'Kidney Beans', NULL,         '{}', 1),
  ('lentil',      'Lentil',      NULL,          '{}', 1),
  ('maize',       'Maize',       'Mahindi',     '{}', 1),
  ('mango',       'Mango',       'Embe',        '{}', 1),
  ('mothbeans',   'Moth Beans',  NULL,          '{}', 1),
  ('mungbean',    'Mung Bean',   NULL,          '{}', 1),
  ('muskmelon',   'Muskmelon',   NULL,          '{}', 1),
  ('orange',      'Orange',      'Machungwa',   '{}', 1),
  ('papaya',      'Papaya',      'Mapapai',     '{}', 1),
  ('pigeonpeas',  'Pigeon Peas', NULL,          '{}', 1),
  ('rice',        'Rice',        'Mpunga',      '{}', 1),
  ('watermelon',  'Watermelon',  'Tikitimaji',  '{}', 1);

-- ---------------------------------------------------------------------
-- 3. Demo identity and field site
-- ---------------------------------------------------------------------
INSERT IGNORE INTO users (full_name, email, password_hash, role, county) VALUES
  ('Demo Administrator', 'admin@smartagri.local', 'REPLACE_WITH_BCRYPT_HASH', 'admin',  'Nairobi'),
  ('Demo Farmer',        'farmer@smartagri.local','REPLACE_WITH_BCRYPT_HASH', 'farmer', 'Bungoma');

INSERT IGNORE INTO farms (owner_user_id, name, latitude, longitude, county)
SELECT id, 'Demo Farm', 0.5143, 34.7460, 'Bungoma'
FROM users WHERE email = 'farmer@smartagri.local';

INSERT IGNORE INTO devices (farm_id, label, type, device_key_hash, status)
SELECT id, 'ESP32-001', 'esp32', SHA2('demo-device-key', 256), 'active'
FROM farms WHERE name = 'Demo Farm';

-- ---------------------------------------------------------------------
-- 4. Demo readings and recommendations
-- ---------------------------------------------------------------------

-- Valid sensor reading.
INSERT INTO soil_readings
  (farm_id, device_id, recorded_at, n, p, k, temperature, humidity, ph,
   rainfall, soil_moisture, source, is_valid, quality_flags)
SELECT f.id, d.id, '2026-11-20 09:30:00', 90.0000, 40.0000, 40.0000,
       24.50, 61.00, 6.70, 0.00, 32.50, 'sensor', 1, JSON_ARRAY()
FROM farms f
JOIN devices d ON d.farm_id = f.id
WHERE f.name = 'Demo Farm'
ON DUPLICATE KEY UPDATE is_valid = VALUES(is_valid), quality_flags = VALUES(quality_flags);

-- Implausible reading stored with a flag instead of being silently dropped.
INSERT INTO soil_readings
  (farm_id, device_id, recorded_at, n, p, k, temperature, humidity, ph,
   rainfall, soil_moisture, source, is_valid, quality_flags)
SELECT f.id, d.id, '2026-11-20 09:40:00', 90.0000, 40.0000, 40.0000,
       24.80, 60.50, 15.50, 0.00, 33.10, 'sensor', 0,
       JSON_ARRAY('ph_out_of_range')
FROM farms f
JOIN devices d ON d.farm_id = f.id
WHERE f.name = 'Demo Farm'
ON DUPLICATE KEY UPDATE is_valid = VALUES(is_valid), quality_flags = VALUES(quality_flags);

-- Older weather marked stale; newest weather current.
INSERT INTO weather_readings
  (farm_id, recorded_at, temperature, humidity, rainfall, source, provider,
   provider_payload, is_stale)
SELECT f.id, '2026-11-20 09:20:00', 24.00, 63.00, 0.00, 'api', 'open-meteo',
       JSON_OBJECT('source', 'open-meteo', 'stale', TRUE), 1
FROM farms f
WHERE f.name = 'Demo Farm'
  AND NOT EXISTS (
    SELECT 1 FROM weather_readings w
    WHERE w.farm_id = f.id AND w.recorded_at = '2026-11-20 09:20:00'
  );

INSERT INTO weather_readings
  (farm_id, recorded_at, temperature, humidity, rainfall, source, provider,
   provider_payload, is_stale)
SELECT f.id, '2026-11-20 09:30:00', 25.00, 60.00, 0.00, 'api', 'open-meteo',
       JSON_OBJECT('source', 'open-meteo'), 0
FROM farms f
WHERE f.name = 'Demo Farm'
  AND NOT EXISTS (
    SELECT 1 FROM weather_readings w
    WHERE w.farm_id = f.id AND w.recorded_at = '2026-11-20 09:30:00'
  );

-- Successful recommendation (status = ok).
INSERT INTO recommendations
  (farm_id, soil_reading_id, weather_reading_id, requested_by_user_id,
   recommended_crop, confidence, alternatives, status, advice, model_version)
SELECT f.id,
       (SELECT id FROM soil_readings WHERE farm_id = f.id AND is_valid = 1
         ORDER BY recorded_at DESC LIMIT 1),
       (SELECT id FROM weather_readings WHERE farm_id = f.id
         ORDER BY recorded_at DESC LIMIT 1),
       u.id,
       'maize', 0.8841,
       JSON_ARRAY(
         JSON_OBJECT('crop', 'maize', 'confidence', 0.8841),
         JSON_OBJECT('crop', 'rice',  'confidence', 0.0712),
         JSON_OBJECT('crop', 'mango', 'confidence', 0.0210)
       ),
       'ok', NULL, 'rf-2026-11-v1'
FROM farms f
JOIN users u ON u.email = 'farmer@smartagri.local'
WHERE f.name = 'Demo Farm'
  AND NOT EXISTS (
    SELECT 1 FROM recommendations r
    WHERE r.farm_id = f.id AND r.recommended_crop = 'maize'
  );

-- Low-confidence recommendation using the exact sentinel string from the API doc.
INSERT INTO recommendations
  (farm_id, soil_reading_id, weather_reading_id, requested_by_user_id,
   recommended_crop, confidence, alternatives, status, advice, model_version)
SELECT f.id,
       (SELECT id FROM soil_readings WHERE farm_id = f.id AND is_valid = 0
         ORDER BY recorded_at DESC LIMIT 1),
       (SELECT id FROM weather_readings WHERE farm_id = f.id
         ORDER BY recorded_at DESC LIMIT 1),
       u.id,
       'No reliable crop recommendation—collect more local soil and climate data',
       0.4127,
       JSON_ARRAY(
         JSON_OBJECT('crop', 'rice',  'confidence', 0.4127),
         JSON_OBJECT('crop', 'maize', 'confidence', 0.2205)
       ),
       'low_confidence',
       'Input conditions fall outside reliable model coverage. Collect more local data or consult an extension officer.',
       'rf-2026-11-v1'
FROM farms f
JOIN users u ON u.email = 'farmer@smartagri.local'
WHERE f.name = 'Demo Farm'
  AND NOT EXISTS (
    SELECT 1 FROM recommendations r
    WHERE r.farm_id = f.id AND r.status = 'low_confidence'
  );

-- ---------------------------------------------------------------------
-- 5. Dataset registry, model metadata and audit entry
-- ---------------------------------------------------------------------
INSERT INTO datasets (name, file_uri, rows_count, status, uploaded_by)
SELECT 'Crop Recommendation Dataset', 'backend/data/Crop_recommendation.csv',
       2200, 'validated', u.id
FROM users u WHERE u.email = 'admin@smartagri.local'
  AND NOT EXISTS (
    SELECT 1 FROM datasets d WHERE d.name = 'Crop Recommendation Dataset'
  );

INSERT INTO model_info
  (version, features, classes, test_accuracy, trained_at, artifact_path, is_active)
VALUES
  ('rf-2026-11-v1',
   JSON_ARRAY('N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall'),
   (SELECT JSON_ARRAYAGG(code) FROM crops WHERE is_active = 1),
   0.9841, '2026-11-20 08:00:00',
   'backend/models/crop_random_forest.joblib', 1)
ON DUPLICATE KEY UPDATE
  is_active = VALUES(is_active),
  test_accuracy = VALUES(test_accuracy);

INSERT INTO audit_logs (actor_user_id, action, entity, entity_id, metadata)
SELECT u.id, 'system.seed', 'system_params', 'min_confidence',
       JSON_OBJECT('value', 0.60, 'reason', 'initial setup')
FROM users u WHERE u.email = 'admin@smartagri.local';
