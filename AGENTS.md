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
  src/ws/gateway.js      Singleton WebSocket (auth JWT + origen, broadcast, heartbeat, cierre 4001 al expirar)
  src/services/          Lógica compartida: deviceCommands.js (único punto para publicar comandos, REST y WS),
                         sessions.js (emisión/rotación/revocación de refresh tokens)
  src/db/database.js     Pool pg + helper query()
  src/db/migrations/     SQL numerado (NNN_descripcion.sql), aplicado por src/db/migrate.js
  src/middleware/        auth.js (authMiddleware, requireRole, requireAdmin, requireWriter), rateLimiter.js
  src/utils/             asyncRouter (createRouter), logger (LOG_LEVEL), metrics, validation
  scripts/smoke-test.js  Prueba de humo con BD/MQTT simulados (npm run test:smoke)
frontend/                Next.js 14 App Router, React 18, JavaScript (JSX, sin TypeScript)
  src/app/page.jsx       SPA: pestañas en estado; las secundarias se cargan con next/dynamic
  src/app/layout.jsx     Fuentes con next/font (Inter, JetBrains Mono) — sin Google Fonts en runtime
  src/components/<area>/ Una página grande por área (dashboard, devices, calendar, ptt, settings, auth)
  src/hooks/             useDevices (fachada del contexto), useWebSocket (useWebSocketStatus, useWebSocketEvent), usePushToTalk
  src/lib/api.js         Cliente HTTP único (JWT + refresh con rotación, tokens en localStorage cacheados)
  src/context/           AuthContext, DevicesContext (estado de dispositivos compartido)
  src/styles/globals.css Design system "Nothing Edition" con variables CSS (sin Tailwind)
docs/AUDITORIA.md        Auditoría de seguridad y funcionamiento (2026-11-10)
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
cd backend && npm run lint                    # ESLint 9 (eslint.config.js)
cd backend && npm run test:smoke              # seguridad/validación sin Docker (BD y MQTT simulados)

# Frontend local
cd frontend && npm install && npm run dev     # http://localhost:3000
cd frontend && npm run build                  # compila + lint (falla con errores de lint)
cd frontend && npm run lint                   # next/core-web-vitals
```

Health: `GET http://localhost:3001/health` · Métricas: `GET /metrics` (solo localhost o `Bearer $METRICS_TOKEN`).

**Verificación mínima** de un cambio: `npm run lint` + `npm run test:smoke` (backend) y `npm run build` (frontend).
Si tocas una ruta, añade su caso a `backend/scripts/smoke-test.js`. No hay tests contra PostgreSQL real todavía.

---

## 5. Convenciones de código

### Backend
- CommonJS (`require` / `module.exports`), `'use strict'` al inicio, cabecera de comentario con el propósito del archivo.
- Routers con **`createRouter()`** de `utils/asyncRouter.js`, nunca `express.Router()` directo: Express 4 no captura
  errores de handlers `async` y un `throw` tumbaba el proceso. `router.use(authMiddleware)` al inicio salvo `setup` y `auth`.
- Permisos: `requireWriter` en toda escritura (bloquea `readonly`); `requireAdmin` para usuarios, config de red y firmware.
- SQL **siempre parametrizado** (`query(sql, [params])`), sin ORM. Nunca concatenes input del usuario.
- Errores: los inesperados se dejan propagar (el error handler global responde 500 genérico y los loguea). Captura solo
  los esperados (`23505` duplicado → 409, `23503` FK → 400). Nunca devuelvas `err.message` al cliente.
- Valida **tipo y longitud** de todo input con `utils/validation.js` (`isNonEmptyString`, `isValidUUID`, `toPositiveInt`,
  `isValidMqttClientId`, `isPlainObject`...). Para `:id` usa `router.param('id', ...)`.
- Texto que va a código C (firmware): `escapeCString`. `sanitizeString` NO basta.
- Comandos a dispositivos: siempre vía `services/deviceCommands.js` (valida dispositivo, acción y params, y audita).
- Usa `logger`, no `console.log`. Nada de logs `[DEBUG]` con `logger.info`.
- Configuración nueva → `src/config.js` + `.env.example` + `docker-compose.yml`.

### Base de datos
- Cambios de esquema **solo** con un archivo nuevo en `backend/src/db/migrations/` (`003_...sql`, `004_...sql`), idempotente (`IF NOT EXISTS`).
- **Nunca** edites migraciones ya aplicadas y **nunca** hagas `ALTER TABLE` dentro de un endpoint.
- Convenciones: UUID para entidades, `TIMESTAMPTZ`, `JSONB` para payloads flexibles, soft delete con `deleted_at` en `devices`.

### MQTT / Firmware
- Tópicos bajo `casa/` en español: `casa/dispositivo/{clientId}/{estado|comando|sensor|telemetria|ota}`, `casa/sistema/backend-status`.
- Payloads JSON. Un nuevo tipo de dispositivo requiere: template en `firmware/templates/`, soporte en `api/firmware.js`,
  validación de comandos en el backend y UI en `DevicesPage`/`DashboardPage`.
- Los templates usan marcadores `REPLACE_WIFI_SSID`, `REPLACE_BROKER_IP`, `REPLACE_WIFI_PASSWORD`, `REPLACE_DEVICE_ID`, `REPLACE_CA_CERT`.

### Frontend
- Componentes funcionales `.jsx`, `'use client'` donde haga falta (casi todo es cliente).
- Sigue la skill **vercel-react-best-practices** (`.claude/skills/`) al escribir o revisar React/Next.
- Llamadas HTTP **solo** a través de `src/lib/api.js` (nunca `fetch` + `localStorage` a mano). Sin llamadas a servicios
  de terceros sin que el usuario lo pida (la app es local; el clima de open-meteo es la única excepción actual).
- Dispositivos: `useDevices()` (contexto compartido). Tiempo real: `useWebSocketStatus()` para el estado de conexión y
  `useWebSocketEvent(tipo, cb)` para mensajes. No crees otra conexión ni otro fetch de dispositivos.
- Estado que cambia muy seguido (relojes, contadores) va en su propio componente pequeño, no en la página.
- Páginas o modales pesados que no se ven al cargar → `next/dynamic`.
- Condicionales con números: ternario (`x != null ? … : null`), no `x && …`.
- Estilos: usa las variables de `globals.css` (`var(--color-red)`, `var(--bg-card)`, ...). Hay muchos `style={{}}` inline:
  al crear UI nueva prefiere clases en `globals.css` reutilizando tokens existentes.
- Iconos: `lucide-react`. Estética: blanco/negro con acento rojo, tipografía Inter + JetBrains Mono.
- Para añadir una sección nueva: componente en `src/components/<area>/`, registrarlo en `TABS` de `src/app/page.jsx` y en `Navigation.jsx`.

---

## 6. Seguridad — reglas para agentes

- **Nunca** leas, imprimas, copies ni subas el contenido de `.env`, `broker/passwd` ni `broker/certs/*.key`. Usa `.env.example` como referencia.
- El repo es **privado** en GitHub. Antes de cada commit revisa `git status`: nunca fuerces (`git add -f`) archivos ignorados
  como `.env`, `broker/passwd` o `broker/certs/*`. Si un secreto llega a un commit, avisa al usuario para rotarlo.
- No expongas puertos nuevos en `docker-compose.yml` sin justificarlo (la DB no se expone a propósito).
- La contraseña WiFi nunca sale del servidor: `GET /api/config` solo devuelve `wifi_password_set`, y el firmware se
  genera por `POST` con la clave inyectada en el backend. No reintroduzcas secretos en URLs ni en respuestas.
- El registro público está cerrado (`ALLOW_REGISTRATION=false`). No lo abras por defecto.
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
