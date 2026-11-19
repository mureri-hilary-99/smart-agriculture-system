-- =====================================================================
-- Smart Agriculture — Crop Recommendation System
-- MySQL database schema
--
-- Scope: supports API endpoints 1-18 from docs/API_DOCUMENTATION.md (section 3).
--        Endpoints 1-4 (/, /health, /docs, /redoc, /openapi.json) need no tables.
--        Endpoints 5-18 require the tables below.
--..
-- Target: MySQL 8.0+ (uses JSON columns and CHECK constraints).
--         For MySQL 5.7, replace CHECK constraints with application validation
--         and change JSON columns to LONGTEXT.
--
-- Run:    mysql -u root -p < database/schema.sql
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS crop_recommendation
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE crop_recommendation;

-- Drop in any order (foreign key checks are temporarily disabled).
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS recommendations;
DROP TABLE IF EXISTS weather_readings;
DROP TABLE IF EXISTS soil_readings;
DROP TABLE IF EXISTS system_params;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS farms;
DROP TABLE IF EXISTS crops;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 1. users  — endpoints 5 (register), 6 (login), 7 (refresh), 8 (me),
--            9 (update me), 10-11 (admin users)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    email         VARCHAR(255)     NOT NULL,
    password_hash VARCHAR(255)     NOT NULL COMMENT 'Argon2/bcrypt hash — never plaintext',
    full_name     VARCHAR(150)     NOT NULL,
    phone         VARCHAR(30)      NULL,
    location      VARCHAR(255)     NULL,
    county        VARCHAR(100)     NULL,
    role          ENUM('farmer', 'extension_officer', 'admin')
                                   NOT NULL DEFAULT 'farmer',
    is_active     TINYINT(1)       NOT NULL DEFAULT 1,
    created_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_role (role),
    KEY idx_users_created_at (created_at)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Accounts for farmers, extension officers and administrators';

-- ---------------------------------------------------------------------
-- 2. refresh_tokens — endpoints 6 (login issues token), 7 (refresh rotates)
--    Store only a SHA-256 hash of the refresh token; return the raw token once.
-- ---------------------------------------------------------------------
CREATE TABLE refresh_tokens (
    id             BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id        INT UNSIGNED     NOT NULL,
    token_hash     CHAR(64)         NOT NULL COMMENT 'SHA-256 of the refresh token',
    expires_at     DATETIME         NOT NULL COMMENT 'UTC',
    revoked_at     DATETIME         NULL     COMMENT 'UTC; set on rotation/logout',
    replaced_by_id BIGINT UNSIGNED  NULL,
    created_at     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_refresh_token_hash (token_hash),
    KEY idx_refresh_user (user_id),
    KEY idx_refresh_expires (expires_at),
    CONSTRAINT fk_refresh_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_refresh_replaced_by
        FOREIGN KEY (replaced_by_id) REFERENCES refresh_tokens (id) ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Rotating refresh tokens issued by /auth/login and /auth/refresh';

-- ---------------------------------------------------------------------
-- 3. farms — endpoints 12 (list), 13 (create), 14 (detail), 15 (update),
--            and location used by ingestion (16) for weather lookup
-- ---------------------------------------------------------------------
CREATE TABLE farms (
    id             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    owner_user_id  INT UNSIGNED     NOT NULL,
    name           VARCHAR(150)     NOT NULL,
    latitude       DECIMAL(10, 7)   NOT NULL,
    longitude      DECIMAL(10, 7)   NOT NULL,
    county         VARCHAR(100)     NULL,
    created_at     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_farms_owner (owner_user_id),
    CONSTRAINT fk_farms_owner FOREIGN KEY (owner_user_id) REFERENCES users (id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_farms_latitude  CHECK (latitude  BETWEEN -90.0000000 AND 90.0000000),
    CONSTRAINT chk_farms_longitude CHECK (longitude BETWEEN -180.0000000 AND 180.0000000)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Farms owned by users; coordinates drive Open-Meteo weather lookup';

-- ---------------------------------------------------------------------
-- 4. devices — endpoints 16 (ingestion auth + last_seen_at),
--             17 (list devices), 18 (register device / issue key)
-- ---------------------------------------------------------------------
CREATE TABLE devices (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    farm_id         INT UNSIGNED    NOT NULL,
    label           VARCHAR(100)    NOT NULL,
    type            ENUM('esp32', 'simulator', 'other')
                                    NOT NULL DEFAULT 'esp32',
    device_key_hash CHAR(64)        NOT NULL COMMENT 'SHA-256 of X-Device-Key; raw key returned once',
    status          ENUM('active', 'inactive', 'maintenance')
                                    NOT NULL DEFAULT 'active',
    last_seen_at    DATETIME        NULL COMMENT 'UTC; updated on each successful ingestion',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_devices_key_hash (device_key_hash),
    KEY idx_devices_farm (farm_id),
    CONSTRAINT fk_devices_farm FOREIGN KEY (farm_id) REFERENCES farms (id)
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Registered ESP32 sensor nodes';

-- ---------------------------------------------------------------------
-- 5. crops — reference catalogue seeded from the trained model's classes_.
--    Catalogue CRUD endpoints (28-30) are outside the first-18 scope, but
--    the table is needed to interpret recommendation labels consistently.
-- ---------------------------------------------------------------------
CREATE TABLE crops (
    id         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    code       VARCHAR(100)    NOT NULL COMMENT 'Matches a model class label, e.g. maize',
    name       VARCHAR(150)    NOT NULL,
    local_name VARCHAR(150)    NULL,
    optimal    JSON            NULL COMMENT 'Agronomic ranges, e.g. {"ph": [5.5, 7.5]}',
    is_active  TINYINT(1)      NOT NULL DEFAULT 1,
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_crops_code (code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Crop catalogue; seed from model.classes_ after training';

-- ---------------------------------------------------------------------
-- 6. system_params — endpoint 16 reads min_confidence (0.60 gate).
--    Admin parameter endpoints (31) are outside the first-18 scope.
-- ---------------------------------------------------------------------
CREATE TABLE system_params (
    `key`       VARCHAR(100)   NOT NULL,
    value       JSON           NOT NULL,
    updated_by  INT UNSIGNED   NULL,
    updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`key`),
    CONSTRAINT fk_system_params_user FOREIGN KEY (updated_by) REFERENCES users (id)
        ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Runtime configuration such as min_confidence and sampling interval';

-- ---------------------------------------------------------------------
-- 7. soil_readings — endpoint 16 (ingestion insert) and source of the
--    latest readings used by the dashboard. Reading endpoints 19-20 are
--    outside scope but read from this table.
--
--    API -> DB name mapping: N->n, P->p, K->k; all other names identical.
--    n/p/k are nullable because the standard model does not use NPK.
--    Soil moisture is stored/displayed only; it is NOT a model feature.
-- ---------------------------------------------------------------------
CREATE TABLE soil_readings (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    farm_id        INT UNSIGNED    NOT NULL,
    device_id      INT UNSIGNED    NULL COMMENT 'NULL for manual readings',
    recorded_at    DATETIME        NOT NULL COMMENT 'UTC, from ESP32 payload',
    n              DECIMAL(10, 4)  NULL COMMENT 'API field N; dataset-scaled',
    p              DECIMAL(10, 4)  NULL COMMENT 'API field P; dataset-scaled',
    k              DECIMAL(10, 4)  NULL COMMENT 'API field K; dataset-scaled',
    temperature    DECIMAL(6, 2)   NULL COMMENT 'Air temperature, degrees C (DHT22)',
    humidity       DECIMAL(5, 2)   NULL COMMENT 'Relative humidity, percent',
    ph             DECIMAL(4, 2)   NULL COMMENT 'Soil pH',
    rainfall       DECIMAL(10, 2)  NULL COMMENT 'mm; from weather service',
    soil_moisture  DECIMAL(5, 2)   NULL COMMENT 'Percent; display only, not a model input',
    source         ENUM('sensor', 'manual')
                                   NOT NULL DEFAULT 'sensor',
    is_valid       TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '0 when values fail validation',
    quality_flags  JSON            NULL COMMENT 'e.g. ["ph_out_of_range"]',
    created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_soil_device_recorded (device_id, recorded_at) COMMENT 'Ingestion retry dedupe',
    KEY idx_soil_farm_recorded (farm_id, recorded_at DESC),
    KEY idx_soil_valid (is_valid),
    CONSTRAINT fk_soil_farm FOREIGN KEY (farm_id) REFERENCES farms (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_soil_device FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE SET NULL,
    CONSTRAINT chk_soil_n CHECK (n IS NULL OR n >= 0),
    CONSTRAINT chk_soil_p CHECK (p IS NULL OR p >= 0),
    CONSTRAINT chk_soil_k CHECK (k IS NULL OR k >= 0),
    CONSTRAINT chk_soil_humidity CHECK (humidity IS NULL OR humidity BETWEEN 0 AND 100),
    CONSTRAINT chk_soil_ph CHECK (ph IS NULL OR ph BETWEEN 0 AND 14),
    CONSTRAINT chk_soil_rainfall CHECK (rainfall IS NULL OR rainfall >= 0),
    CONSTRAINT chk_soil_moisture CHECK (soil_moisture IS NULL OR soil_moisture BETWEEN 0 AND 100)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Sensor and manual soil/environment readings';

-- ---------------------------------------------------------------------
-- 8. weather_readings — endpoint 16 (server-side weather enrichment).
--    Weather endpoints 21-23 are outside scope but read from this table.
-- ---------------------------------------------------------------------
CREATE TABLE weather_readings (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    farm_id          INT UNSIGNED    NOT NULL,
    recorded_at      DATETIME        NOT NULL COMMENT 'UTC observation time',
    temperature      DECIMAL(6, 2)   NULL COMMENT 'degrees C',
    humidity         DECIMAL(5, 2)   NULL COMMENT 'percent',
    rainfall         DECIMAL(10, 2)  NOT NULL DEFAULT 0.00 COMMENT 'mm, summed over prepared window',
    source           ENUM('provider', 'sensor', 'cache', 'manual')
                                     NOT NULL DEFAULT 'provider',
    provider         VARCHAR(50)     NULL COMMENT 'e.g. open-meteo',
    provider_payload JSON           NULL COMMENT 'Raw provider response for debugging',
    is_stale         TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'True when provider unavailable',
    created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_weather_farm_recorded_source (farm_id, recorded_at, source),
    KEY idx_weather_farm_recorded (farm_id, recorded_at DESC),
    CONSTRAINT fk_weather_farm FOREIGN KEY (farm_id) REFERENCES farms (id)
        ON DELETE CASCADE,
    CONSTRAINT chk_weather_humidity CHECK (humidity IS NULL OR humidity BETWEEN 0 AND 100),
    CONSTRAINT chk_weather_rainfall CHECK (rainfall >= 0)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Weather from Open-Meteo (or sensor/cache fallback) per farm';

-- ---------------------------------------------------------------------
-- 9. recommendations — endpoint 16 (inference result persisted).
--    History endpoints 24-27 are outside scope but read from this table.
--
--    recommended_crop intentionally has no FK to crops.code so it can also
--    hold the low-confidence sentinel string used by POST /api/v1/predict:
--    'No reliable crop recommendation—collect more local soil and climate data'
-- ---------------------------------------------------------------------
CREATE TABLE recommendations (
    id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    farm_id               INT UNSIGNED    NOT NULL,
    soil_reading_id       BIGINT UNSIGNED NULL,
    weather_reading_id    BIGINT UNSIGNED NULL,
    requested_by_user_id  INT UNSIGNED    NULL,
    recommended_crop      VARCHAR(150)    NOT NULL,
    confidence            DECIMAL(5, 4)   NOT NULL,
    alternatives          JSON            NOT NULL COMMENT 'top_recommendations array',
    status                ENUM('ok', 'low_confidence')
                                          NOT NULL DEFAULT 'ok',
    advice                TEXT            NULL,
    model_version         VARCHAR(50)     NULL COMMENT 'e.g. rf-2026-11-v1',
    created_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_rec_farm_created (farm_id, created_at DESC),
    KEY idx_rec_status (status),
    CONSTRAINT fk_rec_farm FOREIGN KEY (farm_id) REFERENCES farms (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_rec_soil FOREIGN KEY (soil_reading_id) REFERENCES soil_readings (id)
        ON DELETE SET NULL,
    CONSTRAINT fk_rec_weather FOREIGN KEY (weather_reading_id) REFERENCES weather_readings (id)
        ON DELETE SET NULL,
    CONSTRAINT fk_rec_user FOREIGN KEY (requested_by_user_id) REFERENCES users (id)
        ON DELETE SET NULL,
    CONSTRAINT chk_rec_confidence CHECK (confidence BETWEEN 0 AND 1)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Persisted crop recommendations with confidence and alternatives';

-- ---------------------------------------------------------------------
-- 10. audit_logs — records writes from endpoints 5, 11, 16 and 18.
--     The read endpoint (36) is outside the first-18 scope.
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_user_id INT UNSIGNED    NULL,
    action        VARCHAR(100)    NOT NULL COMMENT 'e.g. USER_REGISTERED, DEVICE_CREATED',
    entity        VARCHAR(100)    NOT NULL COMMENT 'e.g. users, devices',
    entity_id     VARCHAR(100)    NULL,
    metadata      JSON            NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_audit_created (created_at),
    KEY idx_audit_actor (actor_user_id),
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users (id)
        ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Audit trail for account, admin and device changes';

-- =====================================================================
-- Seed data (operational defaults only — no user/crop data invented)
-- =====================================================================

INSERT INTO system_params (`key`, value) VALUES
    ('min_confidence',             JSON_OBJECT('value', 0.60, 'unit', 'probability',
        'description', 'Confidence gate used by /predict and ingestion')),
    ('sensor_sample_interval_min', JSON_OBJECT('value', 10, 'unit', 'minutes',
        'description', 'ESP32 sampling interval before averaging')),
    ('weather_cache_ttl_min',      JSON_OBJECT('value', 30, 'unit', 'minutes',
        'description', 'Reuse cached weather before calling the provider again')),
    ('stale_weather_after_min',    JSON_OBJECT('value', 120, 'unit', 'minutes',
        'description', 'Mark weather as out of date beyond this age'))
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

-- Crops must be seeded from the trained model's classes_ list after training:
--   INSERT INTO crops (code, name, is_active) VALUES ('maize', 'Maize', 1)
--     ON DUPLICATE KEY UPDATE name = VALUES(name);
-- Keep codes identical to model class labels so recommendation records
-- can be joined reliably. The Kenya-specific list needs extension-officer
-- sign-off per the proposal (section 3.1.3). See database/queries.sql.

-- =====================================================================
-- End of schema.sql
-- Companion query reference: database/queries.sql
-- =====================================================================
