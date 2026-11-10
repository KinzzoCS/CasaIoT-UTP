-- ─────────────────────────────────────────────────────────────
--  003_reminders_columns.sql — Columnas de recordatorios
--
--  Antes estas columnas se creaban con ALTER TABLE dentro de los
--  endpoints de api/reminders.js en cada petición (requería permisos
--  DDL para el usuario de la app y /learning fallaba hasta el primer
--  POST). Idempotente: no falla en bases donde ya existen.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS category        VARCHAR(50) DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS amount          DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS repeat_type     VARCHAR(20) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS repeat_interval INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS details         JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS completed_at    TIMESTAMPTZ DEFAULT NULL;

-- Índice para revocar sesiones por usuario (services/sessions.js)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active
  ON refresh_tokens(user_id) WHERE revoked = FALSE;
