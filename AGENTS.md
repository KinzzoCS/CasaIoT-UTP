# AGENTS.md — CasaIoT

Guía para agentes de IA (Claude Code, Codex, Cursor, etc.) que trabajen en este repositorio.
Léela completa antes de tocar código. El estado vivo del proyecto (decisiones, pendientes,
bugs conocidos, bitácora) está en [MEMORY.md](MEMORY.md): **léelo al empezar y actualízalo al terminar**.

---

## 1. Qué es el proyecto

**CasaIoT** es un proyecto escolar: una plataforma de casa inteligente 100 % local (sin nube) que
funciona como **centro de control del hogar** y como **herramienta para la vida diaria**.

Dos ejes de producto:

| Eje | Funcionalidad |
|-----|---------------|
| **Domótica** | Control en tiempo real de dispositivos ESP32 (luces, persianas, cochera, sensores PIR/LDR), historial de eventos, automatizaciones cron, generador de firmware, control por voz (Push-To-Talk). |
| **Vida diaria** | Calendario, recordatorios (pagos, mantenimiento, baterías, personalizados) con montos, repetición y "aprendizaje" de patrones. |

Idioma del proyecto: **español** (UI, comentarios, logs, mensajes de error, documentación, tópicos MQTT).
Mantén ese idioma en todo lo que escribas dentro del repo.

---

## 2. Arquitectura

```
 Navegador (Next.js 14, :3000)
     │  REST (JWT)          │  WebSocket /ws (JWT)
     ▼                      ▼
 Backend Node/Express (:3001) ── node-cron (jobs)
     │  pg (SQL directo)    │  MQTT (casa/#)
     ▼                      ▼
 PostgreSQL 16          Mosquitto 2.0 (:1883 interno, :8883 TLS)
                            │  MQTT/TLS
                            ▼
                      ESP32 (Arduino C++)
```

Todo corre con `docker-compose.yml` (servicios `broker`, `db`, `backend`, `frontend` en la red `casaiot_internal`).

### Flujos
- **Telemetría**: ESP32 → `casa/dispositivo/{id}/{estado|sensor|telemetria}` → `backend/src/mqtt/handlers.js` → PostgreSQL + broadcast WS.
- **Comandos**: UI → `POST /api/devices/:id/command` o WS `{type:'command'}` → MQTT `casa/dispositivo/{id}/comando` → ESP32.
- **Offline**: job cada 15 s (`markStaleDevicesOffline(15)` en `backend/src/index.js`).

`{id}` en los tópicos es el `mqtt_client_id` del dispositivo, **no** el UUID de la tabla.

---

## 3. Mapa del repositorio

```
backend/                 Node >= 20, CommonJS ('use strict'), Express 4
  src/index.js           Arranque, middlewares, montaje de rutas, jobs, shutdown
  src/config.js          Lectura/validación de variables de entorno (único lugar para leer process.env)
  src/api/*.js           Un router Express por recurso (devices, events, schedules, reminders,
                         calendar, auth, admin, tokens, config, firmware, setup)
  src/mqtt/client.js     Singleton MQTT (suscribe casa/#, publica comandos)
  src/mqtt/handlers.js   Ruteo por regex de tópico → lógica de negocio
  src/ws/gateway.js      Singleton WebSocket (auth JWT, broadcast, heartbeat)
  src/db/database.js     Pool pg + helper query()
  src/db/migrations/     SQL numerado (NNN_descripcion.sql), aplicado por src/db/migrate.js
  src/middleware/        auth.js (authMiddleware, requireRole), rateLimiter.js
  src/utils/             logger, metrics (Prometheus /metrics), validation
frontend/                Next.js 14 App Router, React 18, JavaScript (JSX, sin TypeScript)
  src/app/page.jsx       SPA: navegación por pestañas en estado (no hay rutas de Next por sección)
  src/components/<area>/ Una página grande por área (dashboard, devices, calendar, ptt, settings, auth)
  src/hooks/             useDevices, useWebSocket, usePushToTalk
  src/lib/api.js         Cliente HTTP único (JWT + refresh automático, tokens en localStorage)
  src/context/           AuthContext
  src/styles/globals.css Design system "Nothing Edition" con variables CSS (sin Tailwind)
firmware/
  base/base.ino          WiFi + TLS + MQTT comunes; marcadores REPLACE_*
  templates/*.ino        Lógica por tipo de dispositivo (se inyecta en base.ino)
broker/                  mosquitto.conf, acl, passwd, certs/ (PKI local)
scripts/                 Instalador Windows, generación de certificados, utilidades
```

Documentación existente: `README.md`, `QUICKSTART.md`, `PRODUCTION.md`, `PERMISOS_REMOVIDOS.md`,
`analisis_casaiot.txt` (análisis de arquitectura de julio 2026; algunos puntos están desactualizados, ver MEMORY.md).

---

## 4. Comandos

Entorno: Windows 11 + Docker Desktop. Usa PowerShell o Git Bash.

```bash
# Todo el stack
docker compose up -d --build
docker compose ps
docker compose logs backend -f
docker compose exec backend npm run migrate

# Backend local (necesita DB y broker accesibles + .env)
cd backend && npm install && npm run dev      # node --watch
cd backend && npm run lint

# Frontend local
cd frontend && npm install && npm run dev     # http://localhost:3000
cd frontend && npm run build                  # verificación de que compila
cd frontend && npm run lint
```

Health: `GET http://localhost:3001/health` · Métricas: `GET /metrics`.

**No hay tests automatizados.** Para verificar un cambio: `npm run build` (frontend), arrancar el backend sin
errores, y probar el endpoint/pantalla afectada. Si agregas tests, documenta el comando aquí.

---

## 5. Convenciones de código

### Backend
- CommonJS (`require` / `module.exports`), `'use strict'` al inicio, cabecera de comentario con el propósito del archivo.
- Un `express.Router()` por recurso; `router.use(authMiddleware)` al inicio salvo `setup` y `auth`.
- SQL **siempre parametrizado** (`query(sql, [params])`), sin ORM. Nunca concatenes input del usuario.
- Errores: `try/catch` por handler → `logger.error('mensaje', { error: err.message })` → `res.status(...).json({ error: 'Mensaje en español' })`.
- Valida input con `utils/validation.js` (`isValidUUID`, `sanitizeString`, `isValidCronExpression`, ...).
- Usa `logger`, no `console.log`.
- Configuración nueva → `src/config.js` + `.env.example` + `docker-compose.yml`.

### Base de datos
- Cambios de esquema **solo** con un archivo nuevo en `backend/src/db/migrations/` (`003_...sql`, `004_...sql`), idempotente (`IF NOT EXISTS`).
- **Nunca** edites migraciones ya aplicadas y **nunca** hagas `ALTER TABLE` dentro de un endpoint (hay deuda de esto en `reminders.js`, ver MEMORY.md).
- Convenciones: UUID para entidades, `TIMESTAMPTZ`, `JSONB` para payloads flexibles, soft delete con `deleted_at` en `devices`.

### MQTT / Firmware
- Tópicos bajo `casa/` en español: `casa/dispositivo/{clientId}/{estado|comando|sensor|telemetria|ota}`, `casa/sistema/backend-status`.
- Payloads JSON. Un nuevo tipo de dispositivo requiere: template en `firmware/templates/`, soporte en `api/firmware.js`,
  validación de comandos en el backend y UI en `DevicesPage`/`DashboardPage`.
- Los templates usan marcadores `REPLACE_WIFI_SSID`, `REPLACE_BROKER_IP`, `REPLACE_WIFI_PASSWORD`, `REPLACE_DEVICE_ID`, `REPLACE_CA_CERT`.

### Frontend
- Componentes funcionales `.jsx`, `'use client'` donde haga falta (casi todo es cliente).
- Llamadas HTTP **solo** a través de `src/lib/api.js`; tiempo real vía `useWebSocket`.
- Estilos: usa las variables de `globals.css` (`var(--color-red)`, `var(--bg-card)`, ...). Hay muchos `style={{}}` inline:
  al crear UI nueva prefiere clases en `globals.css` reutilizando tokens existentes.
- Iconos: `lucide-react`. Estética: blanco/negro con acento rojo, tipografía Inter + JetBrains Mono.
- Para añadir una sección nueva: componente en `src/components/<area>/`, registrarlo en `pages` y `pageTitles` de `src/app/page.jsx` y en `Navigation.jsx`.

---

## 6. Seguridad — reglas para agentes

- **Nunca** leas, imprimas, copies ni subas el contenido de `.env`, `broker/passwd` ni `broker/certs/*.key`. Usa `.env.example` como referencia.
- El repo es **privado** en GitHub. Antes de cada commit revisa `git status`: nunca fuerces (`git add -f`) archivos ignorados
  como `.env`, `broker/passwd` o `broker/certs/*`. Si un secreto llega a un commit, avisa al usuario para rotarlo.
- No expongas puertos nuevos en `docker-compose.yml` sin justificarlo (la DB no se expone a propósito).
- Los modos "TEMP: Disabled for development" de `mosquitto.conf` (anónimo, sin mTLS, sin ACL) son conocidos; no los "arregles"
  sin coordinar, porque romperían los ESP32 actuales.

---

## 7. Cómo trabajar (flujo para agentes)

1. Lee `MEMORY.md` (estado, decisiones, pendientes).
2. Localiza el código afectado con la sección 3; sigue los patrones del archivo vecino más parecido.
3. Haz cambios pequeños y enfocados; no reformatees archivos completos.
4. Verifica (sección 4). Si no pudiste verificar algo, dilo explícitamente.
5. Actualiza `MEMORY.md`: añade una línea a la bitácora y mueve/actualiza pendientes, decisiones o bugs.
6. Si cambias comandos, estructura o convenciones, actualiza también este `AGENTS.md`.
