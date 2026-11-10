-- ─────────────────────────────────────────────────────────────
--  seed-devices.sql — Dispositivos de ejemplo
--
--  Ejecutar con:
--  psql -U casaiot -d casaiot -f scripts/seed-devices.sql
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
--  seed-devices.sql — Dispositivos de ejemplo solo para luces
--
--  Ejecutar con:
--  psql -U casaiot -d casaiot -f scripts/seed-devices.sql
-- ─────────────────────────────────────────────────────────────

-- Eliminar cualquier dispositivo de tipo distinto a light
DELETE FROM devices WHERE type <> 'light';

-- Dispositivo 1: ESP32 con LED en la sala
INSERT INTO devices (
  id, name, type, location, 
  mqtt_client_id, mqtt_topic_base,
  is_online, last_state, firmware_version, created_at
) VALUES (
  uuid_generate_v4(),
  'Luz Sala',
  'light',
  'sala',
  'esp32_sala_led',
  'casa/dispositivo/esp32_sala_led',
  false,
  '{"state": "off"}'::jsonb,
  '1.0.0',
  NOW()
) ON CONFLICT (mqtt_client_id) DO NOTHING;

-- Dispositivo 2: ESP32 con LED en la cocina
INSERT INTO devices (
  id, name, type, location,
  mqtt_client_id, mqtt_topic_base,
  is_online, last_state, firmware_version, created_at
) VALUES (
  uuid_generate_v4(),
  'Luz Cocina',
  'light',
  'cocina',
  'esp32_cocina_led',
  'casa/dispositivo/esp32_cocina_led',
  false,
  '{"state": "off"}'::jsonb,
  '1.0.0',
  NOW()
) ON CONFLICT (mqtt_client_id) DO NOTHING;

-- Dispositivo 3: ESP32 con LED en la habitación
INSERT INTO devices (
  id, name, type, location,
  mqtt_client_id, mqtt_topic_base,
  is_online, last_state, firmware_version, created_at
) VALUES (
  uuid_generate_v4(),
  'Luz Habitación',
  'light',
  'habitacion',
  'esp32_habit_led',
  'casa/dispositivo/esp32_habit_led',
  false,
  '{"state": "off"}'::jsonb,
  '1.0.0',
  NOW()
) ON CONFLICT (mqtt_client_id) DO NOTHING;

SELECT * FROM devices WHERE mqtt_client_id LIKE 'esp32_%' ORDER BY name;
