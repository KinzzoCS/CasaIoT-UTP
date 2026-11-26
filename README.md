# CasaIoT

Plataforma de casa inteligente **100 % local**: controla dispositivos ESP32 en tiempo real, automatiza el hogar y organiza la vida diaria sin depender de la nube.

Proyecto de la Universidad Tecnológica de Parral (UTP).

![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![MQTT](https://img.shields.io/badge/MQTT-Mosquitto_2-660066?style=flat-square&logo=eclipsemosquitto&logoColor=white)
![ESP32](https://img.shields.io/badge/ESP32-Arduino-E7352C?style=flat-square&logo=espressif&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)

## Qué hace

| Domótica | Vida diaria |
|---|---|
| Control en tiempo real de luces, persianas, cochera y sensores (PIR, LDR) | Calendario del hogar |
| Historial de eventos y telemetría | Recordatorios de pagos, mantenimiento y baterías, con montos y repetición |
| Control por voz con Push-To-Talk | Detección de patrones en los recordatorios |
| Generador de firmware para ESP32 desde el panel | |
| Estado en línea/fuera de línea de cada dispositivo | |

## Arquitectura

```
 Navegador (Next.js 14, :3000)
     │  REST (JWT)          │  WebSocket /ws (JWT)
     ▼                      ▼
 Backend Node/Express (:3001) ── node-cron (tareas)
     │  SQL parametrizado   │  MQTT (casa/#)
     ▼                      ▼
 PostgreSQL 16          Mosquitto 2.0 (:8883 TLS)
                            │  MQTT/TLS
                            ▼
                      ESP32 (Arduino C++)
```

- **Telemetría:** ESP32 → `casa/dispositivo/{id}/{estado|sensor|telemetria}` → backend → PostgreSQL y difusión por WebSocket.
- **Comandos:** interfaz → REST o WebSocket → un único servicio de comandos que valida y audita → MQTT → ESP32.
- **Sin nube:** el acceso desde fuera de casa se hace por VPN (WireGuard, Tailscale o Cloudflare Tunnel), nunca abriendo puertos.

## Seguridad

- Sesiones con JWT de 15 minutos y renovación rotativa; se revocan al cambiar contraseña, rol o desactivar la cuenta.
- Roles `admin`, `user` y `readonly`; el registro público está cerrado y las cuentas las crea un administrador.
- SQL siempre parametrizado, validación de tipo y longitud en cada entrada, límite de peticiones y errores genéricos al cliente.
- La contraseña WiFi nunca sale del servidor: el firmware se genera en el backend.
- Auditoría completa en [docs/AUDITORIA.md](docs/AUDITORIA.md).

> [!WARNING]
> El broker MQTT está en **modo desarrollo** (acceso anónimo, sin mTLS ni ACL) para no romper los ESP32 actuales, y la migración inicial crea un administrador por defecto. Antes de usarlo en una casa real, endurece el broker y cambia esa contraseña. Detalle en [docs/AUDITORIA.md](docs/AUDITORIA.md).

## Puesta en marcha

Necesitas **Docker Desktop** y **OpenSSL** (incluido en Git Bash).

### Windows (asistente)

```powershell
.\scripts\install-windows.ps1
```

El asistente crea el `.env` pidiéndote las contraseñas, genera los certificados TLS, levanta los contenedores, aplica las migraciones y crea un acceso directo.

### Manual

```bash
cp .env.example .env                       # y rellena los valores
docker compose up -d --build
docker compose exec backend npm run migrate
```

Los certificados se generan con `scripts/generate-certs.ps1`. La aplicación queda en `http://localhost:3000` y la API en `http://localhost:3001/health`.

Guía paso a paso con ejemplos de la API en [QUICKSTART.md](QUICKSTART.md) y notas de despliegue en [PRODUCTION.md](PRODUCTION.md).

## Estructura

```
backend/    API REST, WebSocket, cliente MQTT, migraciones SQL y tareas programadas
frontend/   Interfaz en Next.js 14 (App Router)
broker/     Configuración de Mosquitto y PKI local
firmware/   Base común y plantillas por tipo de dispositivo (ESP32)
scripts/    Instalador de Windows, certificados y utilidades
docs/       Auditoría de seguridad y funcionamiento
```

## Verificación

```bash
cd backend && npm run lint && npm run test:smoke   # pruebas con BD y MQTT simulados
cd frontend && npm run build                       # compila y revisa lint
```

## Estado

Versión 1.0.0. Lo pendiente (ejecutor de automatizaciones, autenticación por API tokens, más tipos de dispositivo y endurecimiento del broker) está en [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md).

## Autor

**Alan Ricardo Flores Muñoz** · [Portafolio](https://kinzzocs.github.io) · [GitHub](https://github.com/KinzzoCS)
