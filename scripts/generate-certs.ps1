param(
    [string]$OutputDir = ".\broker\certs",
    [string]$ServerName = "casaiot-broker",
    [string]$Country = "MX",
    [string]$State = "CDMX",
    [string]$City = "Ciudad de Mexico",
    [string]$Org = "CasaIoT",
    [string]$ServerIP = "192.168.1.100",
    [int]$ValidDays = 3650
)

$ErrorActionPreference = "Stop"

$opensslPaths = @(
    "C:\Program Files\Git\usr\bin\openssl.exe",
    "C:\Program Files\OpenSSL-Win64\bin\openssl.exe",
    "$env:LOCALAPPDATA\Programs\Git\usr\bin\openssl.exe"
)
$ossl = $null
foreach ($p in $opensslPaths) {
    if (Test-Path $p) { $ossl = $p; break }
}
if (-not $ossl) {
    $ossl = (Get-Command openssl -ErrorAction SilentlyContinue).Source
}
if (-not $ossl) {
    Write-Host "[ERROR] OpenSSL no encontrado." -ForegroundColor Red; exit 1
}
Write-Host "[OK] OpenSSL: $ossl" -ForegroundColor Green

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
Push-Location $OutputDir

try {
    Write-Host "`n[1/5] CA..." -ForegroundColor Cyan
    & $ossl genrsa -out ca.key 4096
    & $ossl req -new -x509 -days $ValidDays -key ca.key -out ca.crt `
        -subj "/C=$Country/ST=$State/L=$City/O=$Org/CN=$Org-CA"

    $serverExtFile = "server_ext.cnf"
@"
[req]
req_extensions = v3_req
distinguished_name = req_distinguished_name
[req_distinguished_name]
[v3_req]
subjectAltName = @alt_names
[alt_names]
DNS.1 = localhost
DNS.2 = broker
DNS.3 = casaiot-broker
IP.1 = 127.0.0.1
IP.2 = $ServerIP
"@ | Out-File -FilePath $serverExtFile -Encoding ASCII

    Write-Host "[2/5] Server cert..." -ForegroundColor Cyan
    & $ossl genrsa -out server.key 2048
    & $ossl req -new -key server.key -out server.csr `
        -subj "/C=$Country/ST=$State/L=$City/O=$Org/CN=$ServerName" -config $serverExtFile
    & $ossl x509 -req -in server.csr -CA ca.crt -CAkey ca.key `
        -CAcreateserial -out server.crt -days 730 `
        -extensions v3_req -extfile $serverExtFile

    Write-Host "[3/5] Backend cert..." -ForegroundColor Cyan
    & $ossl genrsa -out backend.key 2048
    & $ossl req -new -key backend.key -out backend.csr `
        -subj "/C=$Country/ST=$State/L=$City/O=$Org/CN=casaiot-backend"
    & $ossl x509 -req -in backend.csr -CA ca.crt -CAkey ca.key `
        -CAcreateserial -out backend.crt -days 730

    Write-Host "[4/5] Limpiando..." -ForegroundColor Cyan
    Remove-Item -Force -ErrorAction SilentlyContinue server.csr, backend.csr, $serverExtFile

    Write-Host "[5/5] OK!" -ForegroundColor Green
} finally {
    Pop-Location
}
