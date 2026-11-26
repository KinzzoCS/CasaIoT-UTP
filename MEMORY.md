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
- Repositorio git (rama `main`). Repo de trabajo del equipo: **privado** en GitHub `KinzzoCS/CasaIoT-UTP` (remoto `origin`,
  desde 2026-11-17). El repo anterior `KinzzoCS/CasaIoT` queda como remoto `anterior` y ya no se actualiza.
  Flujo del equipo: commits directos a `main`, sin pull requests. `.gitignore` excluye `.env`, `broker/passwd`,
  todo `broker/certs/` (solo se versiona `.gitkeep`), `*.key/*.crt/*.pem`, `node_modules/`, `.next/` y `*.log`.
  Tras clonar hay que regenerar certificados (`scripts/generate-certs.ps1`) y crear `.env` desde `.env.example`.
- Skills de agentes instaladas en `.claude/skills/` y `.agents/skills/` (lock en `skills-lock.json`): find-skills, frontend-design,
  ios-design, ui-taste, ui-ux-pro-max, vercel-react-best-practices.
- Auditoría completa en [docs/AUDITORIA.md](docs/AUDITORIA.md) (2026-11-10): 17 vulnerabilidades de lógica corregidas, 2 de
  infraestructura pendientes (broker y TLS del ESP32).
- Pruebas: `npm run test:smoke` en backend (BD/MQTT simulados, 18 casos). Sin tests contra PostgreSQL real, sin CI, sin OpenAPI.
- **Pendiente de desplegar**: tras actualizar hay que correr `docker compose exec backend npm run migrate` (migración 003).
- Trabajo pendiente repartible en [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md) (T1-T13). Esa es la lista que se mantiene;
  la sección "Deuda técnica" de abajo es el resumen.

## Decisiones vigentes

- **Operación 100 % local**, sin servicios en la nube. Acceso remoto solo vía VPN (WireGuard/Tailscale/Cloudflare Tunnel), nunca abriendo puertos.
  Única llamada externa del navegador: clima de open-meteo. Fuentes autoalojadas con `next/font`.
- **Sin ORM**: SQL parametrizado con `pg`.
- **Permisos** (2026-11-10, revierte en parte `PERMISOS_REMOVIDOS.md`): cualquier usuario autenticado (`user`) puede gestionar
  dispositivos, recordatorios y schedules; `readonly` solo lee; **solo `admin`** gestiona usuarios, cambia la config de red y
  descarga firmware (porque el `.ino` lleva la clave WiFi).
- **Registro público cerrado** (`ALLOW_REGISTRATION=false`): las cuentas las crea un admin.
- **Sesiones**: access JWT 15 min (HS256) + refresh rotado en cada uso; se revocan todas al cambiar contraseña, rol o desactivar.
- **Broker en modo desarrollo**: `allow_anonymous true`, `require_certificate` y `acl_file` comentados en `broker/mosquitto.conf`.
- **Frontend como SPA por pestañas** en `src/app/page.jsx` (pestaña activa en `localStorage` `casaiot_tab`), no rutas de Next;
  pestañas secundarias con `next/dynamic`; dispositivos en `DevicesContext` (una sola fuente de verdad).
- **Diseño "Nothing Edition"**: blanco/negro + rojo `#e41e3f`, Inter + JetBrains Mono, tokens CSS en `globals.css`.

## Deuda técnica y bugs conocidos

Revisados el 2026-11-10 (detalle en docs/AUDITORIA.md):

- [ ] **Las automatizaciones (schedules) no se ejecutan.** `api/schedules.js` hace CRUD validado, pero ningún job lee la tabla
      `schedules`; tampoco hay UI para crearlas. (`analisis_casaiot.txt` §2.3d lo da por hecho: es incorrecto.)
- [ ] **Los API tokens no autentican**: se crean en Ajustes pero `authMiddleware` solo acepta JWT.
- [ ] **Tipos de dispositivo limitados en el backend**: `VALID_ACTIONS` en `services/deviceCommands.js` y `TEMPLATES` en
      `api/firmware.js` solo cubren `light`, `multi_sala`, `multi_sala_servo`; hay plantillas sin soporte para `garage_door`,
      `blind_motor`, `pir_sensor`, `ldr_sensor`.
- [ ] **Broker sin autenticación** (V18): cualquiera en la LAN puede publicar en `casa/#` saltándose el backend.
- [ ] **ESP32 sin verificar al broker** (V19): `secureClient.setInsecure()` en `firmware/base/base.ino`.
- [ ] Admin sembrado `admin/admin123` por la migración 002: el backend avisa en logs si sigue activo; cambiarlo tras instalar.
- [ ] Muchos estilos inline (`style={{}}`, ~400 usos) en componentes del frontend; páginas muy grandes (Settings ~880 líneas, Dashboard ~770, Devices ~730).
- [ ] Aviso de lint antiguo: dependencia faltante en `useCallback` de `hooks/usePushToTalk.js:230`.
- [ ] No existe `scripts/generate-certs.sh` (README lo menciona; solo hay la versión `.ps1`).
- [x] ~~DDL en endpoints de reminders~~ → migración 003 (2026-11-10).
- [x] ~~Rate limiting desactivado, logs `[DEBUG]`, umbral offline de 15 s, `/metrics` público~~ (2026-11-10).

## Ideas / roadmap (sin compromiso)

- Ejecutor de schedules (node-cron por fila activa, recargar al crear/editar/borrar) + UI en el frontend.
- Ampliar la parte "vida diaria": notificaciones de recordatorios en tiempo real por WS, lista de compras/tareas del hogar,
  consumo/energía, escenas ("Buenas noches", "Salir de casa").
- Endurecer el broker (mTLS + ACL + passwd) y `setCACert` en el firmware para la entrega final.
- Tests de API contra PostgreSQL real (`node --test` + contenedor de pruebas) y CI.

## Bitácora

| Fecha | Quién | Qué |
|-------|-------|-----|
| 2026-07-11 | — | Se eliminan restricciones de rol en endpoints (`PERMISOS_REMOVIDOS.md`). |
| 2026-07-16 | — | Se redacta `analisis_casaiot.txt` (análisis de arquitectura). |
| 2026-11-10 | Claude (agente) | Análisis del proyecto; se crean `AGENTS.md`, `MEMORY.md` y `CLAUDE.md`. Se detectan schedules sin ejecutor y tipos de dispositivo limitados. |
| 2026-11-10 | Claude (agente) | `.gitignore`, `git init` y repo privado `KinzzoCS/CasaIoT` en GitHub. Revisión de secretos antes del primer commit: sin `.env`, claves ni certificados. |
| 2026-11-10 | Claude (agente) | Auditoría (`docs/AUDITORIA.md`). Backend: router async seguro, secretos JWT obligatorios, registro cerrado, rotación de refresh, rate limiting, clave WiFi fuera de respuestas/URLs, firmware por POST con escape C, servicio único de comandos (REST+WS), validación de inputs, roles admin/readonly, migración 003, ESLint y `test:smoke`. Frontend (skill Vercel): DevicesContext, `useWebSocketStatus`, reloj aislado, pestañas con `next/dynamic`, `next/font`, sin `ipapi.co`. Verificado con smoke test, `next build` y navegador contra backend con BD simulada; **no** probado con PostgreSQL/Mosquitto reales. |
| 2026-11-17 | Claude (agente) | Auditoría integrada en `main` (sin PR). Nuevo repo privado `KinzzoCS/CasaIoT-UTP` como `origin`. Se crea `TAREAS_PENDIENTES.md` para traspasar el trabajo a un compañero. Detectado: `pir_sensor.ino` publica en `/estado` y la alerta de movimiento del backend espera `/sensor` (T5). |
| 2026-11-26 | Claude (agente) | README reescrito para el portafolio (qué hace, arquitectura, seguridad con aviso del broker en modo desarrollo, puesta en marcha). Revisión del historial antes de hacer público el repo: sin `.env`, claves ni certificados; solo contraseñas de ejemplo en `QUICKSTART.md`. El repo pasa a **público** a pedido del dueño. |
