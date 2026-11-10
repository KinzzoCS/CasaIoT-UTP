# CasaIoT

Plataforma Smart Home segura, minimalista y local.

## Características

*   **Arquitectura Local**: Sin depender de la nube.
*   **Seguridad**: MQTT sobre TLS mutuo (mTLS).
*   **Backend Minimalista**: Node.js + Express + MQTT + WebSocket.
*   **Frontend Moderno**: Next.js (App Router) con diseño "glassmorphism" estilo Meta.
*   **Base de datos**: PostgreSQL para persistencia de eventos, dispositivos y telemetría.
*   **Integración**: Generador automático de firmware base para ESP32 integrado en el dashboard.
*   **Funciones**: Control en tiempo real, histórico de eventos, tareas (cron), alertas, y comandos por voz mediante Push To Talk.

## Estructura del proyecto

*   `backend/`: API, WebSocket, cliente MQTT, migraciones a BD.
*   `frontend/`: SPA en Next.js.
*   `broker/`: Configuración y volumen para Mosquitto MQTT.
*   `firmware/`: Plantillas para dispositivos ESP32.
*   `scripts/`: Herramientas de generación de certificados e instalador.

## Instalación y Arranque (Windows)

El proyecto incluye un Wizard de instalación en PowerShell que realiza todos los pasos automáticamente:

1.  Asegúrate de tener **Docker Desktop** instalado y corriendo, además de **OpenSSL** (incluido en Git Bash).
2.  Abre PowerShell como administrador o en modo interactivo en la raíz del proyecto.
3.  Ejecuta:
    ```powershell
    .\scripts\install-windows.ps1
    ```
4. Sigue las instrucciones en pantalla.

El instalador:
- Creará el archivo `.env` pidiéndote las contraseñas.
- Generará los certificados TLS (CA local y certificados de servidor).
- Levantará los contenedores con `docker compose`.
- Ejecutará las migraciones SQL iniciales.
- Agregará un acceso directo a tu escritorio.

## Acceso Remoto (Fuera de casa)

> [!CAUTION]
> **No expongas el puerto MQTT ni la API directamente a Internet abriendo puertos en tu router.**

Para un despliegue seguro que permita acceso fuera de red local (LAN), se recomienda encarecidamente utilizar **WireGuard VPN**:
1. Instala WireGuard en una Raspberry Pi o en el mismo equipo donde hospedas Docker.
2. Configura los perfiles de WireGuard en tus dispositivos móviles.
3. Conéctate a la VPN y accede al dashboard ingresando la IP local del servidor (ej: `http://192.168.1.100:3000`).

Alternativas gratuitas y sin abrir puertos:
- Cloudflare Tunnels (Zero Trust).
- Tailscale.

## Despliegue Manual (Cualquier OS)

Si no usas Windows o prefieres hacerlo a mano:

1. Crea el `.env` basándote en `.env.example`.
2. Genera los certificados TLS: `bash scripts/generate-certs.sh` (Nota: este script shell lo deberás crear o ejecutar los comandos ssl a mano usando la lógica en `.ps1`).
3. Corre `docker compose up -d --build`.
4. Corre migraciones de DB: `docker compose exec backend npm run migrate`.
