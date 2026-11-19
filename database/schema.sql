-- =====================================================================
-- Smart Agriculture - MySQL database schema
-- Database : smart_agriculture
-- Scope    : API endpoints #19-#36 of docs/API_DOCUMENTATION.md
-- Target   : MySQL 8.0 (JSON columns, descending indexes)
-- Run with : mysql -u <user> -p < database/schema.sql
--
-- NOTE: This is the database layer only. Authentication, token handling,
-- validation, inference and HTTP behaviour remain in the FastAPI app.
-- Out-of-range sensor readings are NOT rejected here: they are stored with
-- is_valid = 0 and a quality_flags entry so the API can flag, not lose, them.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS smart_agriculture
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smart_agriculture;

-- ---------------------------------------------------------------------
-- Parent tables (needed as foreign-key targets for endpoints 19-36)
-- ---------------------------------------------------------------------

-- Users: role values match the three roles in the proposal/API contract.
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name     VARCHAR(120)  NOT NULL,
  email         VARCHAR(191)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL COMMENT 'bcrypt/argon2 hash - never plaintext',
  phone         VARCHAR(30)   NULL,
  location      VARCHAR(150)  NULL,
  county        VARCHAR(100)  NULL,
  role          ENUM('farmer', 'extension_officer', 'admin') NOT NULL DEFAULT 'farmer',
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Farms: latitude/longitude drive the weather lookup for endpoints 21/23.
CREATE TABLE IF NOT EXISTS farms (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(150)  NOT NULL,
  latitude      DECIMAL(10,7) NOT NULL,
  longitude     DECIMAL(10,7) NOT NULL,
  county        VARCHAR(100)  NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_farms_owner (owner_user_id),
  CONSTRAINT fk_farms_owner FOREIGN KEY (owner_user_id)
    REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Devices: ESP32 nodes. The raw device key is returned once at creation;
-- only its SHA-256 hash is stored here.
CREATE TABLE IF NOT EXISTS devices (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  farm_id        BIGINT UNSIGNED NOT NULL,
  label          VARCHAR(100)   NOT NULL,
  type           VARCHAR(50)    NOT NULL DEFAULT 'esp32',
  device_key_hash CHAR(64)      NULL COMMENT 'SHA-256 of the device key',
  status         ENUM('active', 'inactive', 'maintenance') NOT NULL DEFAULT 'active',
  last_seen_at   DATETIME       NULL,
  created_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_devices_key (device_key_hash),
  KEY idx_devices_farm (farm_id),
  CONSTRAINT fk_devices_farm FOREIGN KEY (farm_id)
    REFERENCES farms (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Endpoints #19-#20 : soil readings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS soil_readings (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  farm_id       BIGINT UNSIGNED NOT NULL,
  device_id     BIGINT UNSIGNED NULL,
  recorded_at   DATETIME       NOT NULL,
  -- API fields are N, P, K, ph; DB columns are lowercase. Map in the
  -- service/repository layer - do not rename the API fields.
  n             DECIMAL(10,4)  NOT NULL,
  p             DECIMAL(10,4)  NOT NULL,
  k             DECIMAL(10,4)  NOT NULL,
  temperature   DECIMAL(6,2)   NOT NULL COMMENT 'air temperature, degrees C',
  humidity      DECIMAL(6,2)   NOT NULL COMMENT 'relative humidity, percent',
  ph            DECIMAL(4,2)   NOT NULL COMMENT 'soil pH',
  rainfall      DECIMAL(10,2)  NOT NULL DEFAULT 0 COMMENT 'mm',
  soil_moisture DECIMAL(6,2)   NULL COMMENT 'percent; stored/displayed, NOT a model input',
  source        ENUM('sensor', 'manual') NOT NULL DEFAULT 'sensor',
  is_valid      TINYINT(1)     NOT NULL DEFAULT 1,
  quality_flags JSON           NULL COMMENT 'e.g. ["ph_out_of_range"]',
  created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Dedupe retries from the same device; MySQL permits multiple NULL device_id rows.
  UNIQUE KEY uq_soil_device_time (device_id, recorded_at),
  KEY idx_soil_farm_time (farm_id, recorded_at DESC),
  KEY idx_soil_valid (is_valid),
  CONSTRAINT fk_soil_farm FOREIGN KEY (farm_id)
    REFERENCES farms (id) ON DELETE CASCADE,
  CONSTRAINT fk_soil_device FOREIGN KEY (device_id)
    REFERENCES devices (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Endpoints #21-#23 : weather readings
-- is_stale supports the proposal requirement to show last-known weather
-- marked as out of date when the provider is unavailable.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weather_readings (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  farm_id          BIGINT UNSIGNED NOT NULL,
  recorded_at      DATETIME       NOT NULL,
  temperature      DECIMAL(6,2)   NOT NULL,
  humidity         DECIMAL(6,2)   NOT NULL,
  rainfall         DECIMAL(10,2)  NOT NULL DEFAULT 0,
  source           ENUM('api', 'sensor', 'manual') NOT NULL DEFAULT 'api',
  provider         VARCHAR(50)    NULL COMMENT 'e.g. open-meteo',
  provider_payload JSON           NULL,
  is_stale         TINYINT(1)     NOT NULL DEFAULT 0,
  created_at       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_weather_farm_time (farm_id, recorded_at DESC),
  KEY idx_weather_stale (is_stale),
  CONSTRAINT fk_weather_farm FOREIGN KEY (farm_id)
    REFERENCES farms (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Endpoints #24-#27 : recommendations
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendations (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  farm_id             BIGINT UNSIGNED NOT NULL,
  soil_reading_id     BIGINT UNSIGNED NULL,
  weather_reading_id  BIGINT UNSIGNED NULL,
  requested_by_user_id BIGINT UNSIGNED NULL,
  recommended_crop    VARCHAR(100)  NOT NULL COMMENT 'or the low-confidence sentinel string',
  confidence          DECIMAL(5,4)  NOT NULL,
  alternatives        JSON          NULL COMMENT 'top_recommendations: [{crop, confidence}, ...]',
  status              ENUM('ok', 'low_confidence') NOT NULL DEFAULT 'ok',
  advice              TEXT          NULL,
  model_version       VARCHAR(50)   NULL COMMENT 'e.g. rf-2026-11-v1',
  created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reco_farm_time (farm_id, created_at DESC),
  KEY idx_reco_status (status),
  CONSTRAINT fk_reco_farm FOREIGN KEY (farm_id)
    REFERENCES farms (id) ON DELETE CASCADE,
  CONSTRAINT fk_reco_soil FOREIGN KEY (soil_reading_id)
    REFERENCES soil_readings (id) ON DELETE SET NULL,
  CONSTRAINT fk_reco_weather FOREIGN KEY (weather_reading_id)
    REFERENCES weather_readings (id) ON DELETE SET NULL,
  CONSTRAINT fk_reco_user FOREIGN KEY (requested_by_user_id)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Endpoints #28-#30 : crop catalogue
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crops (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code       VARCHAR(100)   NOT NULL UNIQUE COMMENT 'model class label, e.g. maize',
  name       VARCHAR(150)   NOT NULL,
  local_name VARCHAR(150)   NULL,
  optimal    JSON           NULL COMMENT '{"N":[min,max],"ph":[min,max],...}',
  is_active  TINYINT(1)     NOT NULL DEFAULT 1,
  created_at TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_crops_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Endpoint #31 : system parameters
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_params (
  `key`        VARCHAR(100) NOT NULL,
  `value`      JSON         NOT NULL COMMENT 'number, string or object',
  description  VARCHAR(255) NULL,
  updated_by   BIGINT UNSIGNED NULL,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`),
  CONSTRAINT fk_params_user FOREIGN KEY (updated_by)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Endpoint #32 : datasets registry (metadata only, no binary blobs)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS datasets (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(150)   NOT NULL,
  file_uri    VARCHAR(500)   NOT NULL,
  rows_count  INT            NULL,
  status      ENUM('uploaded', 'validated', 'rejected', 'archived') NOT NULL DEFAULT 'uploaded',
  uploaded_by BIGINT UNSIGNED NULL,
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_datasets_status (status),
  CONSTRAINT fk_datasets_user FOREIGN KEY (uploaded_by)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Endpoint #33 : model info
-- The reference implementation reads models/model_metrics.json; this table
-- is the DB-backed equivalent so /model/info can run without local files.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS model_info (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  version       VARCHAR(50)  NOT NULL UNIQUE COMMENT 'e.g. rf-2026-11-v1',
  features      JSON         NOT NULL COMMENT '["N","P","K","temperature","humidity","ph","rainfall"]',
  classes       JSON         NOT NULL COMMENT 'model.classes_',
  test_accuracy DECIMAL(5,4) NULL,
  trained_at    DATETIME     NULL,
  artifact_path VARCHAR(500) NOT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_model_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Endpoint #36 : audit log
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NULL,
  action        VARCHAR(100)  NOT NULL COMMENT 'e.g. crop.update, param.patch',
  entity        VARCHAR(100)  NOT NULL COMMENT 'e.g. crops, system_params',
  entity_id     VARCHAR(100)  NULL COMMENT 'string to also fit system_params.key',
  metadata      JSON          NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_created (created_at),
  KEY idx_audit_actor (actor_user_id),
  CONSTRAINT fk_audit_user FOREIGN KEY (actor_user_id)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
