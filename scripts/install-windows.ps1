# ─────────────────────────────────────────────────────────────
#  CasaIoT — Instalador para Windows (Wizard)
#
#  Verifica dependencias (Docker Desktop), genera credenciales,
#  configura el archivo .env, inicializa servicios, ejecuta
#  migraciones y crea un acceso directo en el escritorio.
# ─────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$ProjectDir = (Get-Item ".\").FullName

function Print-Header {
    Clear-Host
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host "                CasaIoT Setup Wizard                  " -ForegroundColor White
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host ""
}

Print-Header

# ── 1. Verificar Docker Desktop ────────────────────────────────
Write-Host "[1/6] Verificando Docker Desktop..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    Write-Host "  OK: $dockerVersion" -ForegroundColor Green
    
    $dockerComposeVersion = docker compose version 2>&1
    Write-Host "  OK: $dockerComposeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Docker no encontrado." -ForegroundColor Red
    Write-Host "  Por favor instala Docker Desktop: https://www.docker.com/products/docker-desktop"
    Write-Host "  Asegúrate de que el servicio de Docker esté corriendo."
    Read-Host "Presiona Enter para salir..."
    exit 1
}

# ── 2. Crear y configurar .env ────────────────────────────────
Print-Header
Write-Host "[2/6] Configuración de variables de entorno..." -ForegroundColor Yellow
$EnvPath = "$ProjectDir\.env"

if (-not (Test-Path $EnvPath)) {
    Write-Host "  Generando $EnvPath ..."
    
    $CryptoParams = @{
        Length = 64
        NonAlphanumericCharacters = 0
    }
    
    # Simular generación segura local sin dependencias extrañas
    $RandomBytes = New-Object byte[] 64
    (New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes($RandomBytes)
    $JwtSecret = [System.BitConverter]::ToString($RandomBytes) -replace '-'
    
    (New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes($RandomBytes)
    $JwtRefresh = [System.BitConverter]::ToString($RandomBytes) -replace '-'
    
    $DbPassword = Read-Host "  Ingresa una contraseña segura para PostgreSQL (min 8 chars)"
    $MqttPassword = Read-Host "  Ingresa una contraseña para el backend MQTT"
    
    # Determinar IP Local para acceso desde red local
    $LocalIP = (Test-Connection -ComputerName (hostname) -Count 1).IPV4Address.IPAddressToString
    $ApiUrl = Read-Host "  URL del Backend [http://$LocalIP:3001]"
    if ([string]::IsNullOrWhiteSpace($ApiUrl)) { $ApiUrl = "http://$LocalIP:3001" }
    
    $WsUrl = $ApiUrl -replace "http", "ws"
    
    $EnvTemplate = @"
POSTGRES_DB=casaiot
POSTGRES_USER=casaiot
POSTGRES_PASSWORD=$DbPassword

JWT_SECRET=$JwtSecret
JWT_REFRESH_SECRET=$JwtRefresh

MQTT_BACKEND_USER=backend
MQTT_BACKEND_PASSWORD=$MqttPassword

NEXT_PUBLIC_API_URL=$ApiUrl
NEXT_PUBLIC_WS_URL=$WsUrl

ALLOWED_ORIGINS=http://localhost:3000,http://$LocalIP:3000

NODE_ENV=production
"@
    $EnvTemplate | Out-File -FilePath $EnvPath -Encoding UTF8
    Write-Host "  OK: Archivo .env creado exitosamente." -ForegroundColor Green
} else {
    Write-Host "  Archivo .env ya existe. Omitiendo." -ForegroundColor Gray
}

# ── 3. Generar Certificados (PKI) ─────────────────────────────
Print-Header
Write-Host "[3/6] Generando Certificados de Seguridad (mTLS)..." -ForegroundColor Yellow

$CertsDir = "$ProjectDir\broker\certs"
if (-not (Test-Path "$CertsDir\ca.crt")) {
    Write-Host "  Ejecutando script generate-certs.ps1 ..."
    try {
        & .\scripts\generate-certs.ps1 -ServerIP $LocalIP
        Write-Host "  OK: Certificados generados." -ForegroundColor Green
    } catch {
        Write-Host "  ERROR: Fallo al generar certificados. Revisa dependencias como OpenSSL." -ForegroundColor Red
        Read-Host "Presiona Enter para salir..."
        exit 1
    }
} else {
    Write-Host "  Certificados ya existen. Omitiendo." -ForegroundColor Gray
}

# ── 4. Levantar Servicios Docker ──────────────────────────────
Print-Header
Write-Host "[4/6] Levantando servicios (Broker, DB, Backend, Frontend)..." -ForegroundColor Yellow
Write-Host "  Esto puede tomar unos minutos la primera vez (descarga y build de imágenes)." -ForegroundColor Gray

try {
    docker compose up -d --build
    Write-Host "  OK: Servicios iniciados." -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Fallo al levantar docker compose." -ForegroundColor Red
    Read-Host "Presiona Enter para salir..."
    exit 1
}

# ── 5. Ejecutar Migraciones BD ────────────────────────────────
Write-Host "[5/6] Ejecutando migraciones de Base de Datos..." -ForegroundColor Yellow
Write-Host "  Esperando a que la DB esté lista (10 segundos)..."
Start-Sleep -Seconds 10

try {
    # Ejecutamos el script de migración dentro del contenedor del backend
    docker compose exec backend npm run migrate
    Write-Host "  OK: Migraciones aplicadas." -ForegroundColor Green
} catch {
    Write-Host "  ADVERTENCIA: Fallo al aplicar migraciones (probablemente la DB aún no estaba lista o ya están aplicadas)." -ForegroundColor Yellow
}

# ── 6. Crear Acceso Directo ───────────────────────────────────
Print-Header
Write-Host "[6/6] Creando Acceso Directo en el Escritorio..." -ForegroundColor Yellow

try {
    $WshShell = New-Object -comObject WScript.Shell
    $DesktopPath = $WshShell.SpecialFolders.Item("Desktop")
    $Shortcut = $WshShell.CreateShortcut("$DesktopPath\CasaIoT.lnk")
    
    # Asignamos el navegador por defecto abriendo localhost:3000
    $Shortcut.TargetPath = "http://localhost:3000"
    $Shortcut.Description = "Abrir Dashboard de CasaIoT"
    $Shortcut.IconLocation = "shell32.dll, 20" # Icono genérico web
    $Shortcut.Save()
    
    Write-Host "  OK: Acceso directo 'CasaIoT' creado en el Escritorio." -ForegroundColor Green
} catch {
    Write-Host "  ADVERTENCIA: No se pudo crear el acceso directo." -ForegroundColor Yellow
}

# ── Fin ────────────────────────────────────────────────────────
Print-Header
Write-Host "¡Instalación de CasaIoT Completada!" -ForegroundColor Green
Write-Host ""
Write-Host "Dashboard local:    http://localhost:3000" -ForegroundColor Cyan
Write-Host "Dashboard remoto:   http://$LocalIP:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para detener el sistema, ejecuta 'docker compose down' en esta carpeta."
Write-Host ""
Read-Host "Presiona Enter para salir y abrir el Dashboard..."

Start-Process "http://localhost:3000"
