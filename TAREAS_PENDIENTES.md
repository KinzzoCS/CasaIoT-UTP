# Tareas pendientes — CasaIoT

Lista de trabajo para quien continúe el proyecto. Última actualización: **2026-11-17**.

Antes de empezar lee [AGENTS.md](AGENTS.md) (convenciones y comandos) y [MEMORY.md](MEMORY.md) (estado y decisiones).
El detalle técnico de cada problema está en [docs/AUDITORIA.md](docs/AUDITORIA.md).

**Cómo usar este archivo:** toma una tarea, márcala con tu nombre (`[~] (Ana)`), y al terminarla cámbiala a `[x]` con la fecha.
Cuando termines, añade una línea a la bitácora de `MEMORY.md`.

---

## 0. Puesta en marcha (hazlo primero)

- [ ] Clonar el repo e instalar **Docker Desktop**, **Node 20+** y **Git** (OpenSSL viene con Git Bash).
- [ ] Copiar `.env.example` a `.env` y poner valores reales. Generar los secretos JWT con:
      `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` (uno distinto para cada variable).
      **El `.env` nunca se sube al repo.**
- [ ] Generar certificados: `.\scripts\generate-certs.ps1` (los certificados tampoco se suben; cada quien genera los suyos).
- [ ] Levantar todo: `docker compose up -d --build` y luego `docker compose exec backend npm run migrate`.
- [ ] Entrar a `http://localhost:3000` con `admin` / `admin123` y **cambiar la contraseña** en Ajustes → Seguridad.
- [ ] Comprobar que todo pasa: `cd backend && npm install && npm run lint && npm run test:smoke` y `cd frontend && npm install && npm run build`.

> ⚠️ Los cambios de seguridad de noviembre **nunca se probaron contra PostgreSQL y Mosquitto reales** (solo con BD simulada).
> Si algo falla en el paso anterior o al usar la app con Docker, esa es la primera tarea (ver T1).

---

## Prioridad alta

### T1 · Probar la app completa con Docker
- [ ] **Qué:** levantar el stack real y recorrer: login, crear dispositivo, mandar comando, calendario, crear recordatorio,
  marcarlo como hecho, Ajustes → Red (guardar SSID/clave), descargar firmware, crear usuario desde Ajustes → Seguridad,
  cerrar sesión.
- **Ojo con:** la migración `003_reminders_columns.sql` (debe aplicarse sin error), que los dispositivos ya no salgan
  "desconectados" cada pocos segundos, y que tras 15 min de sesión la app siga funcionando (renovación de token).
- **Listo cuando:** todo el recorrido funciona; los errores encontrados se corrigen o se anotan aquí como tareas nuevas.

### T2 · Hacer que las automatizaciones funcionen
- [ ] **Problema:** en la base se guardan horarios (`schedules`), pero **nada los ejecuta** y no hay pantalla para crearlos.
- **Backend:** crear `backend/src/services/scheduler.js` que al arrancar lea los `schedules` activos y programe cada uno con
  `node-cron` (`cron_expression`). Al dispararse debe llamar a `sendDeviceCommand()` de `services/deviceCommands.js`
  con `action.action` y `action.params` (no publicar MQTT a mano), y actualizar `last_run`. Recargar la programación al
  crear, borrar o activar/desactivar un horario en `api/schedules.js`. Usar `timezone` de `system_config`.
- **Frontend:** sección para listar, crear, activar/desactivar y borrar horarios (p. ej. en Dispositivos o una pestaña nueva).
  Añadir las funciones a `src/lib/api.js`.
- **Listo cuando:** un horario `*/1 * * * *` que enciende una luz se ve en el historial de eventos cada minuto, y deja de
  ejecutarse al desactivarlo. Añadir un caso a `backend/scripts/smoke-test.js`.

### T3 · Cerrar el broker MQTT
- [ ] **Problema:** `broker/mosquitto.conf` acepta conexiones anónimas. Cualquiera en la red puede mandar comandos a los
  ESP32 o falsear su estado sin pasar por el backend.
- **Qué hacer:** activar `password_file` y `acl_file` (el ACL de ejemplo ya está en `broker/acl`), crear un usuario por
  dispositivo y añadir usuario/contraseña MQTT al firmware generado (nuevo marcador en `firmware/base/base.ino` y en
  `api/firmware.js`, escapado con `escapeCString`).
- **Cuidado:** esto **desconecta los ESP32 actuales** hasta que se les cargue el firmware nuevo. Coordinarlo con el equipo.
- **Listo cuando:** `mosquitto_pub` sin credenciales es rechazado y los ESP32 con firmware nuevo siguen funcionando.

### T4 · Que el ESP32 verifique al broker (TLS)
- [ ] **Problema:** `firmware/base/base.ino` usa `secureClient.setInsecure()`: cifra pero no comprueba con quién habla.
- **Qué hacer:** usar `secureClient.setCACert(CA_CERT)` cuando haya CA y asegurar que el certificado del servidor incluye
  la IP del broker (parámetro `-ServerIP` de `scripts/generate-certs.ps1`).
- **Listo cuando:** el ESP32 conecta con la CA correcta y **no** conecta si se cambia el certificado del broker.

---

## Prioridad media

### T5 · Soportar los 4 tipos de dispositivo que faltan
- [ ] Hay plantillas de firmware sin soporte en el backend ni en la UI. Para cada tipo hay que añadirlo en
  `VALID_ACTIONS` (`backend/src/services/deviceCommands.js`), en `TEMPLATES` (`backend/src/api/firmware.js`) y en
  `DevicesPage.jsx` / `DashboardPage.jsx`:

  | Tipo | Plantilla | Acciones que entiende el firmware |
  |------|-----------|-----------------------------------|
  | `garage_door` | `garage_door.ino` | `abrir`, `cerrar`, `toggle` |
  | `blind_motor` | `blind_motor.ino` | `subir`, `bajar`, `parar`, `posicion` (param `posicion` 0-100; el cálculo de tiempo está como TODO) |
  | `pir_sensor` | `pir_sensor.ino` | `calibrar` (es sensor, casi no recibe comandos) |
  | `ldr_sensor` | `ldr_sensor.ino` | `set_threshold` (param `threshold` 0-1000) |

- **Bug relacionado:** `pir_sensor.ino` publica en `/estado`, pero el backend solo genera la alerta "Movimiento detectado"
  cuando llega por `/sensor` con `tipo: "pir"` (`backend/src/mqtt/handlers.js`). Unificar uno de los dos lados.
- **Listo cuando:** se puede crear cada tipo desde la UI, descargar su firmware y controlarlo.

### T6 · API tokens: hacerlos funcionar o quitarlos
- [ ] **Problema:** en Ajustes → Seguridad se crean tokens `casaiot_...`, pero el backend no los acepta para autenticarse.
- **Opción A:** en `backend/src/middleware/auth.js`, si el token empieza por `casaiot_`, buscar su SHA-256 en `api_tokens`
  (no expirado), cargar el usuario y actualizar `last_used`.
- **Opción B:** quitar la sección de la UI y las rutas `api/tokens.js`.
- **Listo cuando:** un token sirve para `curl -H "Authorization: Bearer casaiot_..." /api/devices`, o la función ya no existe.

### T7 · Quitar el admin sembrado `admin/admin123`
- [ ] **Problema:** la migración `002_insert_default_admin.sql` crea ese usuario en cada instalación nueva.
- **Qué hacer:** **no editar la 002** (ya aplicada en otras bases). Opciones: obligar a cambiar la contraseña en el primer
  login (columna `must_change_password` en una migración nueva) o que el instalador cree el admin con
  `scripts/create-admin.js` y una migración nueva desactive al admin sembrado si sigue con la contraseña por defecto.

### T8 · Pruebas contra PostgreSQL real y CI
- [ ] Convertir `backend/scripts/smoke-test.js` en tests con `node --test` que usen una base PostgreSQL de prueba
  (contenedor aparte en `docker-compose`), y añadir un workflow de GitHub Actions que corra lint, tests y `next build`.

---

## Prioridad baja / mejoras

- [ ] **T9 · Estilos inline:** hay ~400 `style={{}}` en los componentes. Pasar los repetidos a clases en
  `frontend/src/styles/globals.css` usando los tokens existentes. Empezar por `SettingsPage.jsx` (~880 líneas).
- [ ] **T10 · Partir páginas grandes:** `SettingsPage`, `DashboardPage` y `DevicesPage` tienen 700-900 líneas. Separar
  subcomponentes en archivos propios dentro de su carpeta.
- [ ] **T11 · Aviso de lint:** dependencia faltante en el `useCallback` de `frontend/src/hooks/usePushToTalk.js:230`.
- [ ] **T12 · Script de certificados para Linux/Mac:** el README menciona `scripts/generate-certs.sh`, que no existe.
  Traducir `generate-certs.ps1`.
- [ ] **T13 · Documentar la API** (OpenAPI/Swagger o una tabla en `docs/`).

## Ideas para la parte de "vida diaria" (si sobra tiempo)

- Avisos de recordatorios en tiempo real por WebSocket (p. ej. "mañana vence la luz").
- Lista de compras / tareas del hogar compartida.
- Escenas: "Buenas noches", "Salir de casa" (varios comandos a la vez, reutilizando el scheduler de T2).
- Consumo de energía por dispositivo.

---

## Reglas rápidas (resumen de AGENTS.md)

- Todo en **español**: código, comentarios, UI y commits.
- Nunca subir `.env`, `broker/passwd` ni `broker/certs/*`. Revisar `git status` antes de cada commit.
- Cambios de base de datos **solo** con una migración nueva (`004_...sql`, `005_...sql`), nunca editando las viejas.
- Backend: rutas con `createRouter()`, validar todos los inputs, comandos siempre por `services/deviceCommands.js`.
- Frontend: llamadas HTTP solo por `src/lib/api.js`; dispositivos con `useDevices()`.
- Commits pequeños y descriptivos. Antes de subir: `npm run lint` + `npm run test:smoke` (backend) y `npm run build` (frontend).
