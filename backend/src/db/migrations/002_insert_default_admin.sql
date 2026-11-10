-- 002_insert_default_admin.sql — Inserta usuario admin por defecto
--
-- Username: admin
-- Password: admin123
-- Role: admin

DELETE FROM users WHERE username='admin';

-- Hash válido de bcrypt para "admin123"
-- Generado con: bcrypt.hash('admin123', 12)
INSERT INTO users (username, password_hash, role, is_active)
VALUES (
  'admin',
  '$2b$12$8LNXOahPEKnUmxlQpRS9uuSEKPWDtneZily/eC/NIM5hCIrDVs.2e',
  'admin',
  TRUE
)
ON CONFLICT (username) DO NOTHING;
