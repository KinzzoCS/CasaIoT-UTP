# MEMORY.md — Memoria compartida de CasaIoT

Memoria viva del proyecto para humanos y agentes. Las reglas y convenciones estables están en
[AGENTS.md](AGENTS.md); aquí va lo que **cambia**: estado actual, decisiones, deuda conocida y bitácora.

**Reglas de uso**
- Léelo al empezar una sesión; actualízalo al terminar (al menos una línea en la bitácora).
- Fechas absolutas (`AAAA-MM-DD`), nunca "ayer" o "la semana pasada".
- Una idea por viñeta. Si algo deja de ser cierto, bórralo o márcalo ~~tachado~~ con fecha, no lo dejes contradictorio.
- No guardes secretos (contraseñas, tokens, IPs privadas reales, contenido de `.env`).

---

## Estado actual (2026-11-10)

- Versión 1.0.0. Stack funcionando con Docker Compose: Mosquitto + PostgreSQL 16 + backend Node/Express + frontend Next.js 14.
- Secciones de la UI: Inicio (dashboard), Dispositivos, Calendario, Push To Talk, Ajustes.
- Repositorio git (rama `main`) con remoto **privado** en GitHub `KinzzoCS/CasaIoT`. `.gitignore` excluye `.env`, `broker/passwd`,
  todo `broker/certs/` (solo se versiona `.gitkeep`), `*.key/*.crt/*.pem`, `node_modules/`, `.next/` y `*.log`.
  Tras clonar hay que regenerar certificados (`scripts/generate-certs.ps1`) y crear `.env` desde `.env.example`.
- Skills de agentes instaladas en `.claude/skills/` y `.agents/skills/` (lock en `skills-lock.json`): find-skills, frontend-design,
  ios-design, ui-taste, vercel-react-best-practices.
- Sin tests, sin CI, sin documentación OpenAPI.

## Decisiones vigentes

- **Operación 100 % local**, sin servicios en la nube. Acceso remoto solo vía VPN (WireGuard/Tailscale/Cloudflare Tunnel), nunca abriendo puertos.
- **Sin ORM**: SQL parametrizado con `pg`.
- **Roles desactivados** (2026-07-11): cualquier usuario autenticado puede crear/editar/borrar dispositivos, schedules, recordatorios
  y generar firmware. Solo `/api/admin/*` exige `admin`. Ver `PERMISOS_REMOVIDOS.md`.
- **Broker en modo desarrollo**: `allow_anonymous true`, `require_certificate` y `acl_file` comentados en `broker/mosquitto.conf`.
- **Frontend como SPA por pestañas** en `src/app/page.jsx` (pestaña activa en `localStorage` `casaiot_tab`), no rutas de Next.
- **Diseño "Nothing Edition"**: blanco/negro + rojo `#e41e3f`, Inter + JetBrains Mono, tokens CSS en `globals.css`.

## Deuda técnica y bugs conocidos

Verificados en el código el 2026-11-10:

- [ ] **Las automatizaciones (schedules) no se ejecutan.** `api/schedules.js` hace CRUD, pero ningún job lee la tabla `schedules`
      ni publica sus acciones; el único cron del backend es el de dispositivos offline. (`analisis_casaiot.txt` §2.3d lo da por hecho: es incorrecto.)
- [ ] **Tipos de dispositivo limitados en el backend**: `api/devices.js:67` y `api/firmware.js:28` solo aceptan
      `light`, `multi_sala`, `multi_sala_servo`, aunque existen templates para `garage_door`, `blind_motor`, `pir_sensor`, `ldr_sensor`, `light_switch`.
- [ ] **DDL en tiempo de ejecución**: `api/reminders.js` hace `ALTER TABLE reminders ADD COLUMN ...` (category, amount, repeat_type,
      repeat_interval, details, completed_at) en cada request. Mover a una migración `003_...sql` y quitar los `ALTER`.
- [ ] **Rate limiting efectivamente desactivado**: `config.js` usa `max: 999999`.
- [ ] **Logs de depuración** `[DEBUG]` con `logger.info` en `api/devices.js` (comando) y `api/firmware.js`.
- [ ] **Umbral offline hardcodeado** a 15 s en `index.js`.
- [ ] `/metrics` sin autenticación ni restricción de IP.
- [ ] Contraseña de admin por defecto `admin123`: en `.env.example`, como hash bcrypt en `migrations/002_insert_default_admin.sql`
      y en `db/update-admin-pw.js`. Cambiarla tras instalar; idealmente quitar el admin sembrado.
- [ ] Muchos estilos inline (`style={{}}`, ~400 usos) en componentes del frontend; páginas muy grandes (Settings ~875 líneas, Dashboard ~755, Devices ~747).
- [ ] No existe `scripts/generate-certs.sh` (README lo menciona; solo hay la versión `.ps1`).

## Ideas / roadmap (sin compromiso)

- Ejecutor de schedules (node-cron por fila activa, recargar al crear/editar/borrar).
- Ampliar la parte "vida diaria": notificaciones de recordatorios en tiempo real por WS, lista de compras/tareas del hogar,
  consumo/energía, escenas ("Buenas noches", "Salir de casa").
- Reactivar roles (`requireRole`) y endurecer el broker (mTLS + ACL + passwd) para la entrega final.
- Tests mínimos de API (p. ej. `node --test` + supertest).

## Bitácora

| Fecha | Quién | Qué |
|-------|-------|-----|
| 2026-07-11 | — | Se eliminan restricciones de rol en endpoints (`PERMISOS_REMOVIDOS.md`). |
| 2026-07-16 | — | Se redacta `analisis_casaiot.txt` (análisis de arquitectura). |
| 2026-11-10 | Claude (agente) | Análisis del proyecto; se crean `AGENTS.md`, `MEMORY.md` y `CLAUDE.md`. Se detectan schedules sin ejecutor y tipos de dispositivo limitados. |
| 2026-11-10 | Claude (agente) | `.gitignore`, `git init` y repo privado `KinzzoCS/CasaIoT` en GitHub. Revisión de secretos antes del primer commit: sin `.env`, claves ni certificados. |
