-- =====================================================================
-- Smart Agriculture — MySQL query reference for API endpoints 1-18
-- Companion to database/schema.sql
--
-- Source: docs/API_DOCUMENTATION.md, section 3 (endpoint index) and
--         sections 4-5 (implemented/planned contracts).
--..
-- How to read this file:
--   * Endpoints 1-4 need no database access and are listed for completeness.
--   * Each section sets MySQL user variables (@name) to example values so the
--     statements can be pasted into a MySQL client after running schema.sql.
--   * Application code should replace @name with the driver's parameter
--     placeholder (e.g. %s for PyMySQL, :name for SQLAlchemy text()).
--   * LIMIT/OFFSET examples use literal integers; bind page_size and
--     (page - 1) * page_size as integers in application code.
--   * Timestamps are UTC. Passwords/device keys are stored only as hashes.
-- =====================================================================

USE crop_recommendation;

-- ---------------------------------------------------------------------
-- Endpoint -> table map (first 18 endpoints)
-- ---------------------------------------------------------------------
--  1 GET  /                          none (service banner)
--  2 GET  /health                    none (liveness)
--  3 POST /api/v1/predict            none (stateless; no persistence)
--  4 GET  /docs,/redoc,/openapi.json none (FastAPI generated)
--  5 POST /api/v1/auth/register      users, audit_logs
--  6 POST /api/v1/auth/login         users, refresh_tokens
--  7 POST /api/v1/auth/refresh       refresh_tokens, users
--  8 GET  /api/v1/auth/me            users
--  9 PATCH /api/v1/users/me          users, audit_logs
-- 10 GET  /api/v1/admin/users        users
-- 11 PATCH /api/v1/admin/users/{id}  users, audit_logs
-- 12 GET  /api/v1/farms              farms
-- 13 POST /api/v1/farms              farms
-- 14 GET  /api/v1/farms/{farm_id}    farms
-- 15 PATCH /api/v1/farms/{farm_id}   farms
-- 16 POST /api/v1/devices/ingestions devices, system_params, crops,
--                                    soil_readings, weather_readings,
--                                    recommendations, audit_logs
-- 17 GET  /api/v1/devices            devices, farms
-- 18 POST /api/v1/devices            devices, audit_logs
-- ---------------------------------------------------------------------

-- =====================================================================
-- ENDPOINT 1-4 — NO SQL REQUIRED
-- GET /           -> static JSON banner
-- GET /health     -> static JSON liveness response
-- POST /predict   -> loads model artifact, runs inference, returns result;
--                    deliberately does NOT persist (see API doc 4.3)
-- GET /docs etc.  -> FastAPI generates from /openapi.json
-- =====================================================================


-- =====================================================================
-- 5. POST /api/v1/auth/register  (public; default role = farmer)
-- =====================================================================
SET @email = 'farmer@example.com',
    @password_hash = '$2b$12$examplehashvalueplaceholder0000000000000000000000000000000000',
    @full_name = 'Mary Wanjiku',
    @phone = '+254712345678',
    @location = 'Kakamega',
    @county = 'Kakamega';

-- 5a. Reject duplicate email (409 in the API).
SELECT id, email FROM users WHERE email = @email LIMIT 1;

-- 5b. Create the account.
INSERT INTO users (email, password_hash, full_name, phone, location, county, role, is_active)
VALUES (@email, @password_hash, @full_name, @phone, @location, @county, 'farmer', 1);
SET @user_id = LAST_INSERT_ID();

-- 5c. Response body: {id, email, full_name, role, created_at}
SELECT id, email, full_name, role, created_at FROM users WHERE id = @user_id;

-- 5d. Audit the write.
INSERT INTO audit_logs (actor_user_id, action, entity, entity_id, metadata)
VALUES (@user_id, 'USER_REGISTERED', 'users', @user_id, JSON_OBJECT('email', @email));


-- =====================================================================
-- 6. POST /api/v1/auth/login
-- =====================================================================
SET @email = 'farmer@example.com';

-- 6a. Fetch the account and verify the password hash in application code.
--     is_active = 0 must return 401.
SELECT id, email, password_hash, role, is_active
FROM users
WHERE email = @email AND is_active = 1
LIMIT 1;

SET @user_id = 1,
    @refresh_token_hash = REPEAT('a', 64),               -- SHA-256 of raw token
    @refresh_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY);

-- 6b. Persist the refresh token (hash only; raw value returned once).
INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
VALUES (@user_id, @refresh_token_hash, @refresh_expires_at);

-- 6c. Optional housekeeping purge.
DELETE FROM refresh_tokens
WHERE expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY);


-- =====================================================================
-- 7. POST /api/v1/auth/refresh  (rotate refresh token)
-- =====================================================================
SET @old_token_hash = REPEAT('a', 64),
    @new_token_hash = REPEAT('b', 64),
    @new_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY);

-- 7a. Validate the presented token and that the account is still active.
SELECT rt.id AS token_id, rt.user_id, rt.expires_at, u.role, u.is_active
FROM refresh_tokens rt
JOIN users u ON u.id = rt.user_id
WHERE rt.token_hash = @old_token_hash
  AND rt.revoked_at IS NULL
  AND rt.expires_at > UTC_TIMESTAMP()
  AND u.is_active = 1
LIMIT 1;

SET @old_token_id = 1, @user_id = 1;

-- 7b. Issue the replacement first so the old row can point to it.
INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
VALUES (@user_id, @new_token_hash, @new_expires_at);
SET @new_token_id = LAST_INSERT_ID();

-- 7c. Revoke the old token (rotation).
UPDATE refresh_tokens
SET revoked_at = UTC_TIMESTAMP(), replaced_by_id = @new_token_id
WHERE id = @old_token_id;


-- =====================================================================
-- 8. GET /api/v1/auth/me
-- =====================================================================
SET @user_id = 1;

SELECT id, full_name, email, phone, location, county,
       role, is_active, created_at
FROM users
WHERE id = @user_id AND is_active = 1;


-- =====================================================================
-- 9. PATCH /api/v1/users/me  (cannot change own role)
-- =====================================================================
SET @user_id = 1,
    @full_name = 'Mary Wanjiku-Otieno',
    @phone = '+254712345678',
    @location = 'Mumias',
    @county = 'Kakamega';

-- Build the SET clause from the fields actually supplied by the client.
-- COALESCE keeps existing values when a field is omitted.
UPDATE users
SET full_name = COALESCE(@full_name, full_name),
    phone     = COALESCE(@phone, phone),
    location  = COALESCE(@location, location),
    county    = COALESCE(@county, county)
WHERE id = @user_id AND is_active = 1;

SELECT id, full_name, email, phone, location, county, role, updated_at
FROM users WHERE id = @user_id;

INSERT INTO audit_logs (actor_user_id, action, entity, entity_id, metadata)
VALUES (@user_id, 'USER_UPDATED', 'users', @user_id,
        JSON_OBJECT('fields', JSON_ARRAY('full_name', 'phone', 'location', 'county')));


-- =====================================================================
-- 10. GET /api/v1/admin/users  (admin only; paginated + filterable)
-- =====================================================================
SET @role = NULL,                 -- NULL = all roles
    @q = NULL,                    -- NULL = no text search
    @page_size = 50,
    @offset = 0;                  -- (page - 1) * page_size

-- 10a. Total for the Page<User> envelope.
SELECT COUNT(*) AS total
FROM users
WHERE (@role IS NULL OR role = @role)
  AND (@q IS NULL OR email LIKE CONCAT('%', @q, '%')
                  OR full_name LIKE CONCAT('%', @q, '%'));

-- 10b. Page of users (never return password_hash).
SELECT id, full_name, email, phone, location, county,
       role, is_active, created_at
FROM users
WHERE (@role IS NULL OR role = @role)
  AND (@q IS NULL OR email LIKE CONCAT('%', @q, '%')
                  OR full_name LIKE CONCAT('%', @q, '%'))
ORDER BY created_at DESC
LIMIT 50 OFFSET 0;                -- bind @page_size and @offset as integers


-- =====================================================================
-- 11. PATCH /api/v1/admin/users/{user_id}  (change role / active status)
-- =====================================================================
SET @admin_id = 1,
    @user_id = 2,
    @new_role = 'extension_officer',
    @new_active = 1;

-- 11a. Before image for the audit record.
SELECT id, email, role, is_active FROM users WHERE id = @user_id;

-- 11b. Prefer deactivation over deletion.
UPDATE users
SET role      = COALESCE(@new_role, role),
    is_active = COALESCE(@new_active, is_active)
WHERE id = @user_id;

-- 11c. Return updated row.
SELECT id, email, role, is_active, updated_at FROM users WHERE id = @user_id;

-- 11d. Audit.
INSERT INTO audit_logs (actor_user_id, action, entity, entity_id, metadata)
VALUES (@admin_id, 'USER_ADMIN_UPDATE', 'users', @user_id,
        JSON_OBJECT('role', @new_role, 'is_active', @new_active));


-- =====================================================================
-- 12. GET /api/v1/farms  (farmers see own; admin sees all)
-- =====================================================================
SET @user_id = 1, @is_admin = 0, @page_size = 50, @offset = 0;

SELECT COUNT(*) AS total
FROM farms
WHERE (@is_admin = 1 OR owner_user_id = @user_id);

SELECT id, owner_user_id, name, latitude, longitude, county, created_at
FROM farms
WHERE (@is_admin = 1 OR owner_user_id = @user_id)
ORDER BY created_at DESC
LIMIT 50 OFFSET 0;                -- bind @page_size and @offset


-- =====================================================================
-- 13. POST /api/v1/farms
-- =====================================================================
SET @user_id = 1,
    @farm_name = 'Shamba A',
    @latitude = 0.0512000,
    @longitude = 34.7521000,
    @county = 'Kakamega';

INSERT INTO farms (owner_user_id, name, latitude, longitude, county)
VALUES (@user_id, @farm_name, @latitude, @longitude, @county);
SET @farm_id = LAST_INSERT_ID();

SELECT id, owner_user_id, name, latitude, longitude, county, created_at
FROM farms WHERE id = @farm_id;


-- =====================================================================
-- 14. GET /api/v1/farms/{farm_id}  (ownership enforced)
-- =====================================================================
SET @farm_id = 1, @user_id = 1, @is_admin = 0;

SELECT id, owner_user_id, name, latitude, longitude, county, created_at
FROM farms
WHERE id = @farm_id
  AND (@is_admin = 1 OR owner_user_id = @user_id);


-- =====================================================================
-- 15. PATCH /api/v1/farms/{farm_id}  (ownership enforced)
-- =====================================================================
SET @farm_id = 1, @user_id = 1,
    @farm_name = 'Shamba A (north)',
    @county = 'Kakamega';

UPDATE farms
SET name    = COALESCE(@farm_name, name),
    county  = COALESCE(@county, county)
    -- latitude/longitude would be added here only when supplied
WHERE id = @farm_id AND owner_user_id = @user_id;

SELECT id, owner_user_id, name, latitude, longitude, county
FROM farms WHERE id = @farm_id;


-- =====================================================================
-- 16. POST /api/v1/devices/ingestions  (ESP32 batch upload)
--     Validate -> dedupe -> persist soil + weather -> infer -> persist
--     recommendation -> update device -> return response.
-- =====================================================================
SET @device_key_hash = REPEAT('c', 64),             -- SHA-256 of X-Device-Key
    @recorded_at = '2026-11-20 09:30:00',           -- from payload (UTC)
    @n = 90.0000, @p = 40.0000, @k = 40.0000,
    @soil_temperature = 24.50, @humidity = 61.00,
    @ph = 6.70, @rainfall = 12.50, @soil_moisture = 32.50,
    @weather_temperature = 25.00, @weather_rainfall = 12.50,
    @weather_source = 'provider', @provider = 'open-meteo',
    @recommended_crop = 'maize', @confidence = 0.8841,
    @alternatives = JSON_ARRAY(
        JSON_OBJECT('crop', 'maize',  'confidence', 0.8841),
        JSON_OBJECT('crop', 'rice',   'confidence', 0.0521),
        JSON_OBJECT('crop', 'cotton', 'confidence', 0.0180)
    ),
    @model_version = 'rf-2026-11-v1';

-- 16a. Authenticate the device and obtain its farm.
SELECT id, farm_id, status
FROM devices
WHERE device_key_hash = @device_key_hash AND status = 'active'
LIMIT 1;
SET @device_id = 1, @farm_id = 1, @user_id = 1;

-- 16b. Idempotency: a retry must not insert a second reading.
SELECT id FROM soil_readings
WHERE device_id = @device_id AND recorded_at = @recorded_at
LIMIT 1;

-- 16c. Read the confidence gate (0.60); application may keep a code default.
SELECT CAST(`value` AS DECIMAL(5,4)) AS min_confidence
FROM system_params WHERE `key` = 'min_confidence';

-- 16d. Optional: confirm the predicted label is in the active catalogue.
SELECT code, name FROM crops WHERE code = @recommended_crop AND is_active = 1 LIMIT 1;

-- 16e. Atomic write of the ingestion result.
START TRANSACTION;

INSERT INTO soil_readings
    (farm_id, device_id, recorded_at, n, p, k, temperature, humidity,
     ph, rainfall, soil_moisture, source, is_valid, quality_flags)
VALUES
    (@farm_id, @device_id, @recorded_at, @n, @p, @k, @soil_temperature, @humidity,
     @ph, @rainfall, @soil_moisture, 'sensor', 1, NULL);
SET @soil_reading_id = LAST_INSERT_ID();

-- When the provider is unavailable, reuse the last known weather row and
-- set is_stale = 1; the dashboard must display it as out of date.
INSERT INTO weather_readings
    (farm_id, recorded_at, temperature, humidity, rainfall,
     source, provider, provider_payload, is_stale)
VALUES
    (@farm_id, @recorded_at, @weather_temperature, @humidity, @weather_rainfall,
     @weather_source, @provider,
     JSON_OBJECT('temperature', @weather_temperature, 'rainfall', @weather_rainfall),
     0);
SET @weather_reading_id = LAST_INSERT_ID();

SET @status = IF(@confidence >= 0.60, 'ok', 'low_confidence');
SET @advice = IF(@confidence >= 0.60, NULL,
    'No reliable crop recommendation—collect more local soil and climate data');

INSERT INTO recommendations
    (farm_id, soil_reading_id, weather_reading_id, requested_by_user_id,
     recommended_crop, confidence, alternatives, status, advice, model_version)
VALUES
    (@farm_id, @soil_reading_id, @weather_reading_id, @user_id,
     IF(@confidence >= 0.60, @recommended_crop,
        'No reliable crop recommendation—collect more local soil and climate data'),
     @confidence, @alternatives, @status, @advice, @model_version);
SET @recommendation_id = LAST_INSERT_ID();

UPDATE devices SET last_seen_at = UTC_TIMESTAMP() WHERE id = @device_id;

INSERT INTO audit_logs (actor_user_id, action, entity, entity_id, metadata)
VALUES (@user_id, 'INGESTION_RECORDED', 'recommendations', @recommendation_id,
        JSON_OBJECT('device_id', @device_id, 'farm_id', @farm_id));

COMMIT;

-- 16f. Build the 201 response body.
SELECT r.id AS recommendation_id,
       r.recommended_crop, r.confidence, r.status, r.alternatives,
       r.soil_reading_id, r.weather_reading_id, r.model_version,
       s.recorded_at, s.ph, s.soil_moisture,
       w.temperature AS weather_temperature, w.rainfall AS weather_rainfall,
       w.is_stale
FROM recommendations r
JOIN soil_readings    s ON s.id = r.soil_reading_id
JOIN weather_readings w ON w.id = r.weather_reading_id
WHERE r.id = @recommendation_id;

-- 16g. Faulty sensor example: keep the row but flag it instead of dropping it.
-- UPDATE soil_readings
-- SET is_valid = 0,
--     quality_flags = JSON_ARRAY('ph_out_of_range')
-- WHERE id = @soil_reading_id;


-- =====================================================================
-- 17. GET /api/v1/devices  (optionally filtered by farm_id)
-- =====================================================================
SET @farm_id = NULL, @user_id = 1, @is_admin = 0;

SELECT d.id, d.farm_id, d.label, d.type, d.status, d.last_seen_at, d.created_at
FROM devices d
JOIN farms f ON f.id = d.farm_id
WHERE (@farm_id IS NULL OR d.farm_id = @farm_id)
  AND (@is_admin = 1 OR f.owner_user_id = @user_id)
ORDER BY d.id;


-- =====================================================================
-- 18. POST /api/v1/devices  (admin registers node and issues key)
-- =====================================================================
SET @admin_id = 1,
    @farm_id = 1,
    @label = 'esp32-001',
    @type = 'esp32',
    @device_key_hash = REPEAT('d', 64);   -- SHA-256 of generated key

INSERT INTO devices (farm_id, label, type, device_key_hash, status)
VALUES (@farm_id, @label, @type, @device_key_hash, 'active');
SET @device_id = LAST_INSERT_ID();

-- Return the raw generated key ONCE in the API response; store only its hash.
SELECT id, farm_id, label, type, status, created_at
FROM devices WHERE id = @device_id;

INSERT INTO audit_logs (actor_user_id, action, entity, entity_id, metadata)
VALUES (@admin_id, 'DEVICE_CREATED', 'devices', @device_id,
        JSON_OBJECT('farm_id', @farm_id, 'label', @label));


-- =====================================================================
-- Seed template — run after model training (one row per model.classes_)
-- =====================================================================
-- INSERT INTO crops (code, name, is_active) VALUES
--   ('maize',   'Maize',   1),
--   ('rice',    'Rice',    1),
--   ('potato',  'Potato',  1),
--   ('tomato',  'Tomato',  1),
--   ('coffee',  'Coffee',  1)
-- ON DUPLICATE KEY UPDATE name = VALUES(name);
-- The Kenya-specific active list needs extension-officer sign-off.


-- =====================================================================
-- Verification / operational checks
-- =====================================================================
SELECT TABLE_NAME, TABLE_ROWS, ENGINE
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'crop_recommendation'
ORDER BY TABLE_NAME;

SHOW INDEX FROM soil_readings;
SHOW INDEX FROM recommendations;

-- End of queries.sql
