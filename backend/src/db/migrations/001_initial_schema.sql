-- ─────────────────────────────────────────────────────────────
--  001_initial_schema.sql — Schema inicial CasaIoT
--
--  Decisiones de diseño:
--  - UUIDs como PKs en devices (identificación global sin colisiones)
--  - SERIAL en tablas de eventos (alta frecuencia de INSERT, PK secuencial es óptima)
--  - TIMESTAMPTZ (con timezone) en lugar de TIMESTAMP simple
--  - Índices en columnas de filtro frecuente
--  - Soft delete con deleted_at en lugar de DELETE físico (auditoría)
-- ─────────────────────────────────────────────────────────────

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Dispositivos registrados ──────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100) NOT NULL,
  -- Tipos: 'light'
  type            VARCHAR(50) NOT NULL,
  -- Ubicación descriptiva: 'sala', 'cochera', 'habitacion_1'
  location        VARCHAR(100),
  -- Client ID que usa el ESP32 al conectarse al broker MQTT
  mqtt_client_id  VARCHAR(100) UNIQUE NOT NULL,
  -- Topic base del dispositivo (sin el sufijo /estado, /comando, etc.)
  mqtt_topic_base VARCHAR(200) NOT NULL,
  -- Estado actual del dispositivo
  is_online       BOOLEAN DEFAULT FALSE,
  -- Payload del último estado recibido (JSON)
  last_state      JSONB DEFAULT '{}',
  last_seen       TIMESTAMPTZ,
  firmware_version VARCHAR(20),
  -- Soft delete: no eliminamos dispositivos, solo los marcamos
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_devices_location ON devices(location) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_devices_online ON devices(is_online) WHERE deleted_at IS NULL;

-- ── Historial de eventos ──────────────────────────────────────
-- Esta tabla crece indefinidamente. Considerar particionado por mes
-- si el volumen supera 1M registros (futuro)
CREATE TABLE IF NOT EXISTS events (
  id          BIGSERIAL PRIMARY KEY,
  device_id   UUID REFERENCES devices(id) ON DELETE SET NULL,
  -- Tipos: 'state_change', 'command', 'alert', 'connect', 'disconnect'
  event_type  VARCHAR(50) NOT NULL,
  -- Payload completo del evento (JSON)
  payload     JSONB NOT NULL DEFAULT '{}',
  -- IP de origen si aplica (comandos manuales)
  source_ip   INET,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_device_id ON events(device_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);

-- ── Horarios automáticos ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedules (
  id              SERIAL PRIMARY KEY,
  device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  name            VARCHAR(100),
  -- Expresión cron: '0 22 * * *' = todos los días a las 10pm
  cron_expression VARCHAR(100) NOT NULL,
  -- Acción MQTT a ejecutar (JSON)
  action          JSONB NOT NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  -- Próxima ejecución (calculada por el backend)
  next_run        TIMESTAMPTZ,
  last_run        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedules_device ON schedules(device_id);
CREATE INDEX IF NOT EXISTS idx_schedules_active ON schedules(is_active, next_run);

-- ── Usuarios del sistema ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  username        VARCHAR(50) UNIQUE NOT NULL,
  -- Contraseña hasheada con bcrypt (nunca plain text)
  password_hash   TEXT NOT NULL,
  -- Roles: 'admin', 'user', 'readonly'
  role            VARCHAR(20) DEFAULT 'user' NOT NULL,
  -- Para futuro: email para notificaciones
  email           VARCHAR(255),
  is_active       BOOLEAN DEFAULT TRUE,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tokens de API (para ESP32, scripts, integraciones) ───────
CREATE TABLE IF NOT EXISTS api_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Hash SHA256 del token. NUNCA guardamos el token en plain text.
  -- El usuario solo ve el token una vez al crearlo.
  token_hash  TEXT UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  last_used   TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);

-- ── Refresh tokens JWT ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  -- Revocado manualmente (logout o cambio de contraseña)
  revoked     BOOLEAN DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ── Recordatorios de mantenimiento ───────────────────────────
CREATE TABLE IF NOT EXISTS reminders (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  -- Tipos: 'battery', 'firmware', 'maintenance', 'custom'
  reminder_type   VARCHAR(50) NOT NULL,
  device_id       UUID REFERENCES devices(id) ON DELETE SET NULL,
  -- Fecha programada para el recordatorio
  due_date        TIMESTAMPTZ NOT NULL,
  is_dismissed    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_date) WHERE is_dismissed = FALSE;

-- ── Configuración del sistema (clave-valor) ───────────────────
CREATE TABLE IF NOT EXISTS system_config (
  key         VARCHAR(100) PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Valores por defecto de configuración
INSERT INTO system_config (key, value, description) VALUES
  ('timezone', '"America/Mexico_City"', 'Zona horaria del sistema'),
  ('location', '{"lat": 19.4326, "lng": -99.1332, "name": "Ciudad de México"}', 'Ubicación para cálculos de amanecer/anochecer'),
  ('mqtt_topic_prefix', '"casa"', 'Prefijo base para todos los topics MQTT')
ON CONFLICT (key) DO NOTHING;
