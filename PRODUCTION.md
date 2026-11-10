# CasaIoT — Guía de Producción

## Checklist Pre-Deployment

### 1. Validación de Ambiente
```bash
bash scripts/validate-env.sh
```

Verifica:
- ✓ Contraseña de DB con 20+ caracteres
- ✓ JWT_SECRET y JWT_REFRESH_SECRET únicos (64+ caracteres)
- ✓ MQTT_BACKEND_PASSWORD configurada
- ✓ Certificados TLS presentes
- ✓ URLs apuntando a direcciones de producción

### 2. Generación de Secretos

```bash
# JWT secrets
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Contraseña de DB (20+ caracteres)
openssl rand -base64 32

# Contraseña MQTT
openssl rand -base64 16
```

### 3. Certificados TLS para MQTT

```bash
bash scripts/generate-certs.sh
```

Genera:
- `broker/certs/ca.crt` — Autoridad Certificadora
- `broker/certs/broker.crt` — Certificado del broker
- `broker/certs/broker.key` — Llave privada del broker
- `broker/certs/backend.crt` — Certificado del cliente backend
- `broker/certs/backend.key` — Llave privada del backend

## Configuración de Producción

### docker-compose.yml

Cambios recomendados para producción:

```yaml
# 1. Reemplazar servicios locales con servicios managed (si aplica)
db:
  image: postgres:16-alpine
  restart: always  # Cambiar a 'always' en producción
  # Considerar usar Amazon RDS, Google Cloud SQL, etc.

# 2. Agregar volúmenes de backup
volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/casaiot-postgres  # Ruta de backup
```

### Variables de Entorno (.env)

```env
NODE_ENV=production

# Base de datos
POSTGRES_DB=casaiot_prod
POSTGRES_USER=casaiot_prod
POSTGRES_PASSWORD=<genera_con_openssl>

# JWT
JWT_SECRET=<genera_con_node>
JWT_REFRESH_SECRET=<genera_con_node>

# MQTT
MQTT_BACKEND_USER=backend
MQTT_BACKEND_PASSWORD=<genera_con_openssl>

# URLs (actualizar a dominio real)
NEXT_PUBLIC_API_URL=https://tu-dominio.com/api
NEXT_PUBLIC_WS_URL=wss://tu-dominio.com/ws

# CORS
ALLOWED_ORIGINS=https://tu-dominio.com,https://www.tu-dominio.com

# Puerto (detrás de proxy reverso)
PORT=3001
```

### Proxy Reverso (Nginx)

```nginx
upstream casaiot_backend {
  server backend:3001;
}

upstream casaiot_frontend {
  server frontend:3000;
}

server {
  listen 443 ssl http2;
  server_name tu-dominio.com;

  ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;
  ssl_protocols TLSv1.3 TLSv1.2;
  ssl_ciphers HIGH:!aNULL:!MD5;

  # Frontend
  location / {
    proxy_pass http://casaiot_frontend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # API
  location /api {
    proxy_pass http://casaiot_backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # WebSocket
  location /ws {
    proxy_pass http://casaiot_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
  }

  # Métricas (solo desde red interna)
  location /metrics {
    proxy_pass http://casaiot_backend;
    allow 10.0.0.0/8;  # Solo red interna
    deny all;
  }

  # Health check
  location /health {
    proxy_pass http://casaiot_backend;
  }
}

# Redirect HTTP → HTTPS
server {
  listen 80;
  server_name tu-dominio.com;
  return 301 https://$server_name$request_uri;
}
```

## Monitoreo

### Health Check

```bash
curl https://tu-dominio.com/health
```

Respuesta esperada (healthy):
```json
{
  "status": "healthy",
  "timestamp": "2026-07-11T13:38:20Z",
  "services": {
    "database": "ok",
    "mqtt": "ok",
    "websocket": { "status": "ok", "clients": 5 }
  }
}
```

### Métricas Prometheus

```bash
curl https://tu-dominio.com/metrics
```

Expone:
- `casaiot_http_requests_total` — Total de requests HTTP
- `casaiot_http_errors_total` — Errores HTTP
- `casaiot_db_queries_total` — Queries a DB
- `casaiot_db_errors_total` — Errores de DB
- `casaiot_mqtt_messages_total` — Mensajes MQTT procesados
- `casaiot_ws_active_connections` — Conexiones WebSocket activas
- `casaiot_uptime_seconds` — Uptime en segundos

### Logs

Logs en formato JSON (parseable):
```bash
docker compose logs backend -f | jq .
```

Filtrar por nivel:
```bash
docker compose logs backend -f | jq 'select(.level=="error")'
```

## Backup y Recuperación

### Backup Automático de PostgreSQL

```bash
# Backup completo
docker compose exec -T db pg_dump -U casaiot_prod casaiot_prod > backup-$(date +%Y%m%d).sql

# Backup comprimido
docker compose exec -T db pg_dump -U casaiot_prod -Fc casaiot_prod > backup-$(date +%Y%m%d).dump
```

### Restauración

```bash
# Desde SQL
docker compose exec -T db psql -U casaiot_prod casaiot_prod < backup-20260711.sql

# Desde dump comprimido
docker compose exec -T db pg_restore -U casaiot_prod -d casaiot_prod backup-20260711.dump
```

## Scaling

### Horizontal Scaling con Load Balancer

Para escalar a múltiples instancias del backend:

```yaml
backend:
  image: casaiot-backend:latest
  deploy:
    replicas: 3
  expose:
    - 3001
```

Usar un load balancer (Nginx, HAProxy) enfrente para distribuir tráfico.

### Vertical Scaling

Aumentar recursos en `docker-compose.yml`:

```yaml
services:
  backend:
    mem_limit: 1g  # 1 GB de RAM
    memswap_limit: 2g

  db:
    mem_limit: 2g  # 2 GB de RAM
```

## Seguridad

### Escaneo de Vulnerabilidades

```bash
# Verificar imágenes Docker
docker scan casaiot-backend:latest

# Dependencias Node.js
npm audit
```

### Ataques Comunes Prevenidos

- ✓ **Rate Limiting**: Limitado por IP, más estricto en auth
- ✓ **SQL Injection**: Parámetros preparados con `pg`
- ✓ **XSS**: Helmet + sanitización de entrada
- ✓ **CSRF**: JWT tokens (stateless)
- ✓ **DoS**: Límite de tamaño de body (10KB)
- ✓ **Timing Attacks**: Comparación constante en bcrypt
- ✓ **Secrets**: Variables de entorno, nunca en código

## Troubleshooting

### Backend no responde

```bash
# Ver logs
docker compose logs backend

# Health check manual
docker compose exec backend curl http://localhost:3001/health

# Conectividad a DB
docker compose exec backend node -e "require('./src/db/database').healthCheck().then(ok => console.log(ok ? 'DB OK' : 'DB FAIL'))"
```

### MQTT no conecta

```bash
# Ver logs de Mosquitto
docker compose logs broker

# Verificar certificados
openssl x509 -in broker/certs/backend.crt -noout -text
```

### WebSocket caído

```bash
# Ver conexiones WebSocket activas
docker compose exec backend curl http://localhost:3001/health | jq '.services.websocket'
```

## Mantenimiento

### Actualizar Dependencias

```bash
# Verificar actualizaciones
npm outdated

# Actualizar
npm update

# Auditar nuevas vulnerabilidades
npm audit
```

### Migraciones de Base de Datos

Nuevas migraciones van en `backend/src/db/migrations/`:

```bash
# Ejecutar migraciones
docker compose exec backend npm run migrate

# Ver migraciones aplicadas
docker compose exec backend psql -U casaiot -d casaiot -c "SELECT * FROM _migrations;"
```

### Limpiar Volúmenes Antiguos

```bash
# Ver volúmenes no usados
docker volume ls -f dangling=true

# Eliminar
docker volume prune
```

---

**Última actualización:** 2026-07-11
**Versión CasaIoT:** 1.0.0
