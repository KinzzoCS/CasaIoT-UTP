#!/bin/bash

# ─────────────────────────────────────────────────────────────
#  validate-env.sh — Valida variables de entorno antes de start
#
#  Uso: bash scripts/validate-env.sh
#  Verifica que todas las vars requeridas estén presentes y válidas
# ─────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

errors=0

log_error() {
  echo -e "${RED}✗ ERROR${NC}: $1"
  ((errors++))
}

log_success() {
  echo -e "${GREEN}✓ OK${NC}: $1"
}

log_warn() {
  echo -e "${YELLOW}⚠ WARN${NC}: $1"
}

# Cargar .env si existe
if [ -f .env ]; then
  set -a
  source .env
  set +a
else
  log_error ".env file not found. Copy .env.example to .env and fill it."
  exit 1
fi

echo "Validando variables de entorno..."
echo ""

# ── Base de datos ──────────────────────────────────────────────
echo "📦 Database:"
if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  log_error "POSTGRES_PASSWORD no está configurada"
else
  if [ ${#POSTGRES_PASSWORD} -lt 20 ]; then
    log_warn "POSTGRES_PASSWORD tiene menos de 20 caracteres (se recomienda 20+)"
  else
    log_success "POSTGRES_PASSWORD ✓"
  fi
fi

if [ -z "${POSTGRES_DB:-}" ]; then
  POSTGRES_DB="casaiot"
fi
log_success "POSTGRES_DB=$POSTGRES_DB ✓"

if [ -z "${POSTGRES_USER:-}" ]; then
  POSTGRES_USER="casaiot"
fi
log_success "POSTGRES_USER=$POSTGRES_USER ✓"

# ── JWT ────────────────────────────────────────────────────────
echo ""
echo "🔐 JWT:"

if [ -z "${JWT_SECRET:-}" ] || [ "$JWT_SECRET" = "CHANGE_ME_GENERATE_WITH_CRYPTO" ]; then
  log_error "JWT_SECRET no está configurada o sigue siendo placeholder"
else
  if [ ${#JWT_SECRET} -lt 64 ]; then
    log_warn "JWT_SECRET tiene menos de 64 caracteres (se recomienda 64+)"
  else
    log_success "JWT_SECRET ✓"
  fi
fi

if [ -z "${JWT_REFRESH_SECRET:-}" ] || [ "$JWT_REFRESH_SECRET" = "CHANGE_ME_GENERATE_WITH_CRYPTO_DIFFERENT" ]; then
  log_error "JWT_REFRESH_SECRET no está configurada o sigue siendo placeholder"
else
  if [ ${#JWT_REFRESH_SECRET} -lt 64 ]; then
    log_warn "JWT_REFRESH_SECRET tiene menos de 64 caracteres"
  else
    log_success "JWT_REFRESH_SECRET ✓"
  fi
fi

# ── MQTT ───────────────────────────────────────────────────────
echo ""
echo "📡 MQTT:"

if [ -z "${MQTT_BACKEND_PASSWORD:-}" ] || [ "$MQTT_BACKEND_PASSWORD" = "CHANGE_ME_MQTT_BACKEND_PASSWORD" ]; then
  log_error "MQTT_BACKEND_PASSWORD no está configurada o sigue siendo placeholder"
else
  log_success "MQTT_BACKEND_PASSWORD ✓"
fi

# ── Certificados ────────────────────────────────────────────────
echo ""
echo "📜 Certificados:"

if [ ! -f "broker/certs/ca.crt" ]; then
  log_error "Certificado CA no encontrado: broker/certs/ca.crt"
else
  log_success "broker/certs/ca.crt ✓"
fi

if [ ! -f "broker/certs/backend.crt" ]; then
  log_error "Certificado backend no encontrado: broker/certs/backend.crt"
else
  log_success "broker/certs/backend.crt ✓"
fi

if [ ! -f "broker/certs/backend.key" ]; then
  log_error "Llave privada no encontrada: broker/certs/backend.key"
else
  log_success "broker/certs/backend.key ✓"
fi

# ── URLs ───────────────────────────────────────────────────────
echo ""
echo "🌐 URLs:"

NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3001}"
NEXT_PUBLIC_WS_URL="${NEXT_PUBLIC_WS_URL:-ws://localhost:3001}"

if [[ $NEXT_PUBLIC_API_URL == "http://localhost:3001" ]]; then
  log_warn "NEXT_PUBLIC_API_URL está en localhost (solo funciona en desarrollo local)"
else
  log_success "NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL ✓"
fi

if [[ $NEXT_PUBLIC_WS_URL == "ws://localhost:3001" ]]; then
  log_warn "NEXT_PUBLIC_WS_URL está en localhost (solo funciona en desarrollo local)"
else
  log_success "NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL ✓"
fi

# ── Resultado final ────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────────────────"

if [ $errors -eq 0 ]; then
  echo -e "${GREEN}✓ Todas las variables están correctamente configuradas${NC}"
  echo "Puedes ejecutar: docker compose up -d"
  exit 0
else
  echo -e "${RED}✗ Se encontraron $errors error(es)${NC}"
  echo "Por favor, corrije los errores antes de iniciar Docker Compose"
  exit 1
fi
