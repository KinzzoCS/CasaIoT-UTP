# ─────────────────────────────────────────────────────────────
#  generate-device-cert.ps1 — Genera certificado para un ESP32
#
#  Uso: .\scripts\generate-device-cert.ps1 -DeviceId "luz-sala"
#  Requiere haber ejecutado generate-certs.ps1 primero
# ─────────────────────────────────────────────────────────────

param(
    [Parameter(Mandatory=$true)]
    [string]$DeviceId,          # ej: "luz-sala", "cochera", "persiana-sala"
    [string]$CertsDir = ".\broker\certs",
    [int]$ValidDays = 730       # 2 años
)

$ErrorActionPreference = "Stop"

# Validar que la CA existe
if (-not (Test-Path "$CertsDir\ca.crt") -or -not (Test-Path "$CertsDir\ca.key")) {
    Write-Host "[ERROR] CA no encontrada. Ejecuta generate-certs.ps1 primero." -ForegroundColor Red
    exit 1
}

# Sanitizar DeviceId (solo alfanumérico y guiones)
$SafeId = $DeviceId -replace '[^a-zA-Z0-9-]', '-'
$OutputDir = "$CertsDir\devices\$SafeId"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Write-Host "[*] Generando certificado para dispositivo: $SafeId" -ForegroundColor Cyan

Push-Location $CertsDir
try {
    # Generar clave privada del dispositivo
    openssl genrsa -out "devices/$SafeId/device.key" 2048
    if ($LASTEXITCODE -ne 0) { throw "Error generando clave" }

    # CSR del dispositivo
    openssl req -new -key "devices/$SafeId/device.key" `
        -out "devices/$SafeId/device.csr" `
        -subj "/CN=esp32-$SafeId/O=CasaIoT/OU=Device"
    if ($LASTEXITCODE -ne 0) { throw "Error generando CSR" }

    # Firmar con la CA
    openssl x509 -req -in "devices/$SafeId/device.csr" `
        -CA ca.crt -CAkey ca.key -CAcreateserial `
        -out "devices/$SafeId/device.crt" -days $ValidDays
    if ($LASTEXITCODE -ne 0) { throw "Error firmando certificado" }

    # Limpiar CSR
    Remove-Item -Force "devices/$SafeId/device.csr" -ErrorAction SilentlyContinue

    # Convertir a formato compatible con Arduino (hex dump)
    $certContent = Get-Content "devices/$SafeId/device.crt" -Raw
    $keyContent  = Get-Content "devices/$SafeId/device.key" -Raw
    $caContent   = Get-Content "ca.crt" -Raw

    # Generar archivo de credenciales para el firmware
    @"
// ─────────────────────────────────────────────
//  Credenciales TLS para: $SafeId
//  Generado: $(Get-Date -Format 'yyyy-MM-dd')
//  INCLUIR en el sketch del ESP32
//  NO SUBIR a repositorios públicos
// ─────────────────────────────────────────────

const char* DEVICE_ID = "esp32-$SafeId";

const char* CA_CERT = R"(
$caContent
)";

const char* DEVICE_CERT = R"(
$certContent
)";

const char* DEVICE_KEY = R"(
$keyContent
)";
"@ | Out-File -FilePath "devices/$SafeId/credentials.h" -Encoding ASCII

    Write-Host "[OK] Certificado generado para: $SafeId" -ForegroundColor Green
    Write-Host "  Directorio: $OutputDir" -ForegroundColor Gray
    Write-Host "  Copiar credentials.h al proyecto Arduino del ESP32" -ForegroundColor Yellow

} finally {
    Pop-Location
}
