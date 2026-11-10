# Auditoría de código — CasaIoT

**Fecha:** 2026-11-10 · **Alcance:** backend (Node/Express/MQTT/WS), frontend (Next.js 14), configuración de broker y firmware (solo lectura).
**Resultado:** 19 hallazgos de seguridad (6 críticos/altos corregidos en la lógica del backend) y 11 fallos funcionales; buenas prácticas de React/Next (Vercel) aplicadas al frontend.

Leyenda de estado: ✅ corregido · ⚠️ mitigado parcialmente · ⏳ pendiente

---

## 1. Qué funciona

| Área | Estado |
|------|--------|
| Login con JWT + refresh, bcrypt (12 rondas), SQL siempre parametrizado | Funciona |
| CRUD de dispositivos y comandos MQTT (light, multi_sala, multi_sala_servo) | Funciona |
| Telemetría y estado en tiempo real MQTT → WebSocket → UI | Funciona |
| Calendario, recordatorios con categorías y "aprendizaje" de patrones | Funciona (ver F6) |
| Generador de firmware ESP32 desde el dashboard | Funciona en Docker (ver F7) |
| Control por voz (Web Speech API, es-MX) | Funciona |
| Gestión de usuarios para admin, cambio de contraseña | Funciona |
| Docker Compose con red interna, DB sin puerto expuesto, contenedores no-root | Funciona |

## 2. Qué no funciona (fallos funcionales)

| # | Fallo | Estado |
|---|-------|--------|
| F1 | **Las automatizaciones (schedules) nunca se ejecutan**: hay CRUD pero ningún job las dispara. El frontend tampoco tiene UI para crearlas. | ⏳ |
| F2 | **Los API tokens no sirven para autenticarse**: se crean y listan, pero `authMiddleware` solo acepta JWT. | ⏳ |
| F3 | **Dispositivos "parpadeaban" offline**: el firmware manda telemetría cada 60 s y el backend los marcaba offline a los 15 s. Ahora el umbral es 150 s (`DEVICE_OFFLINE_SECONDS`). | ✅ |
| F4 | Al expirar la sesión el frontend redirigía a `/login`, ruta que no existe (404). Ahora vuelve a la pantalla de login de la SPA. | ✅ |
| F5 | El WebSocket reconectaba indefinidamente con un token expirado. Ahora renueva el token antes de reconectar y el servidor cierra con código 4001 al expirar. | ✅ |
| F6 | `/api/reminders/learning` fallaba hasta crear el primer recordatorio (las columnas se creaban con `ALTER TABLE` en el POST). Ahora están en la migración 003. | ✅ |
| F7 | El generador de firmware solo encontraba las plantillas dentro de Docker; en local daba 404. Ahora busca en ambas rutas (o `FIRMWARE_DIR`). | ✅ |
| F8 | Solo 3 tipos de dispositivo aceptados por el backend aunque hay 7 plantillas (garage_door, blind_motor, pir_sensor, ldr_sensor sin soporte). | ⏳ |
| F9 | Cada componente con `useDevices()` hacía su propia petición y tenía su propia copia del estado: un comando por voz no se reflejaba en la página abierta. | ✅ |
| F10 | `npm run lint` no funcionaba en backend ni frontend (sin configuración de ESLint). | ✅ |
| F11 | `ControlPage.jsx` era código muerto (no se importaba en ningún sitio). Eliminado. | ✅ |

## 3. Vulnerabilidades

### Críticas / altas

| # | Vulnerabilidad | Impacto | Corrección | Estado |
|---|----------------|---------|------------|--------|
| V1 | **Cualquier request podía tumbar el backend.** Express 4 no captura errores de handlers `async`; `index.js` hacía `process.exit(1)` en `unhandledRejection`. Ej.: `POST /api/auth/register {"username": 1}` → `username.toLowerCase` lanza → proceso muerto. | DoS de toda la casa con una sola petición | `utils/asyncRouter.js` envuelve todos los handlers; `unhandledRejection` ya no mata el proceso; validación de tipos en todos los inputs | ✅ |
| V2 | **Registro público abierto + roles desactivados.** Cualquiera en la red podía crearse una cuenta en `/api/auth/register` y controlar dispositivos, leer la clave WiFi y generar firmware. | Toma de control por cualquier persona en la LAN | Registro cerrado por defecto (`ALLOW_REGISTRATION=false`); la UI lo oculta; las cuentas las crea un admin | ✅ |
| V3 | **Secretos JWT con valor por defecto conocido** (`dev-jwt-secret-change-in-production`) si faltaba la variable. | Cualquiera podía firmar tokens de admin | En producción no arranca sin secreto real; en desarrollo se genera uno aleatorio. Algoritmo fijado a HS256 | ✅ |
| V4 | **Contraseña WiFi expuesta**: `GET /api/config` la devolvía a cualquier usuario y el firmware se pedía por `GET ...&password=...` (queda en logs e historial). | Robo de la clave WiFi | `GET /config` devuelve solo `wifi_password_set`; firmware por `POST` y la clave la inyecta el servidor; config de red y firmware solo admin | ✅ |
| V5 | **Inyección de código en el firmware**: `sanitizeString` solo quitaba `<` y `>`; un SSID con `"` insertaba C++ arbitrario en el `.ino`. | Firmware malicioso compilado en el ESP32 | `escapeCString()` + validación estricta de `deviceId` y broker | ✅ |
| V6 | **WebSocket publicaba comandos sin validar**: `casa/dispositivo/${deviceId}/comando` con cualquier `deviceId`, sin comprobar dispositivo, acción ni rol, sin auditoría; `maxPayload` de 100 MB. | Comandos arbitrarios, DoS de memoria | Servicio único `services/deviceCommands.js` para REST y WS; `maxPayload` 16 KB; verificación de origen; cierre al expirar el token | ✅ |

### Medias

| # | Vulnerabilidad | Corrección | Estado |
|---|----------------|------------|--------|
| V7 | `params.accion` sobrescribía la acción validada (`{...params}` después de `accion`). | Params saneados (claves/valores simples, sin claves reservadas) | ✅ |
| V8 | Inyección de tópicos MQTT vía `mqttClientId` (`#`, `+`, `/`). | Regex `^[A-Za-z0-9_-]{1,64}$` | ✅ |
| V9 | Rate limiting desactivado (`max: 999999`). | Login: 10 fallos/15 min por IP+usuario; API: 2000/15 min; configurable | ✅ |
| V10 | Refresh tokens sin rotación y sin revocación al cambiar contraseña, rol o desactivar usuario. | Rotación atómica en `/refresh`; revocación en esos tres casos | ✅ |
| V11 | Protección anti-timing rota: comparaba contra un hash bcrypt inválido (retorno inmediato). | Hash real precalculado | ✅ |
| V12 | `/metrics` público. | Solo localhost o `Authorization: Bearer $METRICS_TOKEN` | ✅ |
| V13 | Logs de depuración en producción (cuerpos completos de peticiones, consultas SQL). | `LOG_LEVEL` (info en producción); eliminados los `[DEBUG]` | ✅ |
| V14 | `ALTER TABLE` en tiempo de ejecución (la app necesitaba permisos DDL). | Migración `003_reminders_columns.sql` | ✅ |
| V15 | Admin sembrado `admin / admin123` (migración 002) y `update-admin-pw.js` reseteaba a `admin123`. | Aviso en los logs al arrancar si sigue activa; el script exige `NEW_PASSWORD` | ⚠️ |
| V16 | Detalles internos en respuestas de error (`detail: err.message`). | Errores genéricos; JSON malformado → 400 | ✅ |
| V17 | El frontend enviaba la IP pública del hogar a `ipapi.co` sin aviso, y cargaba fuentes desde Google. | Eliminado `ipapi.co`; fuentes autoalojadas con `next/font` | ✅ |

### Infraestructura (no tocadas: requieren coordinarse con el hardware)

| # | Vulnerabilidad | Estado |
|---|----------------|--------|
| V18 | **Broker en modo desarrollo**: `allow_anonymous true`, sin `require_certificate`, sin ACL. Cualquier equipo de la LAN puede publicar estados falsos o comandos directamente en MQTT, saltándose el backend. | ⏳ |
| V19 | **El ESP32 no verifica al broker**: `secureClient.setInsecure()` aunque se inyecta la CA → posible MITM en la red local. | ⏳ |

## 4. Cambios de comportamiento a tener en cuenta

- **Hay que ejecutar la migración 003**: `docker compose exec backend npm run migrate`.
- El registro desde la pantalla de login queda **oculto**. Para reabrirlo: `ALLOW_REGISTRATION=true`.
- **Solo un admin** puede cambiar la configuración de red y descargar firmware (el `.ino` contiene la clave WiFi). Revierte parcialmente `PERMISOS_REMOVIDOS.md`; el resto sigue abierto a cualquier usuario autenticado.
- El rol `readonly` ya funciona: puede ver todo pero no modificar nada.
- `GET /api/firmware/generate` ya no existe: ahora es `POST` con body JSON.
- Al cambiar la contraseña se cierran las sesiones de los demás dispositivos.
- Variables nuevas (en `.env.example` y `docker-compose.yml`): `LOG_LEVEL`, `ALLOW_REGISTRATION`, `AUTH_RATE_LIMIT_MAX`, `RATE_LIMIT_MAX`, `METRICS_TOKEN`, `DEVICE_OFFLINE_SECONDS`.

## 5. Buenas prácticas de React/Next aplicadas (skill de Vercel)

| Regla | Dónde | Efecto |
|-------|-------|--------|
| `client-swr-dedup`, `client-event-listeners` | `context/DevicesContext.jsx` | Una sola petición y una sola suscripción WS para toda la app (antes una por componente) |
| `rerender-defer-reads` | `useWebSocketStatus()` con `useSyncExternalStore` | Navegación y Dashboard ya no se re-renderizan con cada mensaje MQTT, solo cuando cambia la conexión |
| `rerender-memo` / aislar estado | `LiveClock` en el Dashboard | El reloj ya no re-renderiza toda la página cada segundo |
| `bundle-dynamic-imports` | `app/page.jsx`, `DevicesPage.jsx` | Dispositivos, Calendario, Voz y Ajustes (y el modal de firmware) se cargan al abrirlos |
| `rerender-lazy-state-init` | pestaña guardada en `page.jsx` | `localStorage` se lee una vez |
| `js-cache-storage` | `lib/api.js` | Tokens cacheados en memoria, sincronizados entre pestañas |
| `js-cache-function-results`, `js-hoist-regexp` | `Intl.DateTimeFormat` y regex a nivel de módulo | Sin recrear objetos en cada render |
| `rendering-conditional-render` | Calendario, Dashboard | `amount && …` → ternario (evita pintar un `0`) |
| Contexto con valor estable | `AuthContext` con `useMemo` | Los consumidores no se re-renderizan sin cambios de usuario |
| Fuentes | `next/font` en `layout.jsx` | Sin `@import` bloqueante ni peticiones a Google |

## 6. Cómo se verificó

- **Backend**: `node --check` en todos los archivos; ESLint sin errores; prueba de humo con BD/MQTT simulados (18/18 casos):
  registro cerrado, tipos inválidos, JSON malformado, ids inválidos, comodines MQTT, rol `readonly`, `params.accion`,
  payload publicado, permisos de config, clave WiFi oculta, firmware solo admin y con escape, error de BD controlado y
  el servidor sigue vivo.
- **Frontend**: `next lint` y `next build` correctos. Prueba en navegador contra el backend real (BD en memoria): login, registro oculto,
  WebSocket conectado, comando → estado actualizado, descarga de firmware por POST, contraseña WiFi no visible, sin peticiones a `ipapi.co`
  ni a Google Fonts, sin errores en consola.
- **No verificado**: contra PostgreSQL y Mosquitto reales (Docker no estaba en ejecución) ni con un ESP32 físico.

## 7. Siguientes pasos recomendados

1. Ejecutor de schedules (F1).
2. Endurecer el broker: mTLS, `password_file` y ACL por dispositivo (V18), y `setCACert` en el firmware (V19).
3. Autenticación con API tokens o eliminar la funcionalidad (F2).
4. Soporte de backend para los 4 tipos de dispositivo restantes (F8).
5. Tests automatizados de API (convertir la prueba de humo en `node --test`).
