# CasaIoT — Quick Start

## 🚀 Inicio Rápido

### 1. **Clonar y Configurar**

```bash
git clone <tu-repo>
cd CasaIoT
cp .env.example .env

# Editar .env con tus valores
nano .env
```

### 2. **Validar Ambiente**

```bash
bash scripts/validate-env.sh
```

Verifica que todas las variables estén correctas.

### 3. **Levantar Servicios**

```bash
docker compose up -d
```

Espera a que estén healthy (30-60 segundos):

```bash
docker compose ps
```

### 4. **Crear Usuario Admin**

```bash
curl -X POST http://localhost:3001/api/setup/create-admin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@2026!"}'
```

Solo funciona si la base de datos no tiene usuarios. Ojo: la migración `002` siembra `admin / admin123`; si existe,
inicia sesión con él y **cámbiale la contraseña** en Ajustes → Seguridad (el backend avisa en los logs mientras siga igual).

El registro público está cerrado (`ALLOW_REGISTRATION=false`): el resto de cuentas las crea un admin desde Ajustes → Seguridad.

Tras actualizar el código, aplica las migraciones nuevas: `docker compose exec backend npm run migrate`.

### 5. **Inicia Sesión**

- **Frontend**: http://localhost:3000
- **Usuario**: admin
- **Contraseña**: Admin@2026! (o la que configuraste)

## 🔗 Endpoints Principales

| Endpoint | Descripción |
|----------|-------------|
| `http://localhost:3000` | Frontend (Next.js) |
| `http://localhost:3001/api/auth/login` | Login |
| `http://localhost:3001/api/devices` | CRUD de dispositivos |
| `http://localhost:3001/health` | Health check |
| `http://localhost:3001/metrics` | Métricas Prometheus |

## 🛠️ Comandos Útiles

### Ver logs

```bash
# Backend
docker compose logs backend -f

# Frontend
docker compose logs frontend -f

# Todos
docker compose logs -f
```

### Ejecutar migraciones

```bash
docker compose exec backend npm run migrate
```

### Verificar BD

```bash
docker compose exec db psql -U casaiot -d casaiot -c "\dt"
```

### Reiniciar servicios

```bash
docker compose restart backend
docker compose restart frontend
docker compose restart broker
```

## 📱 Acceso Remoto (Desarrollo Local)

Para probar desde el móvil en la red local, cambia `.env`:

```env
NEXT_PUBLIC_API_URL=http://192.168.1.100:3001
NEXT_PUBLIC_WS_URL=ws://192.168.1.100:3001
```

Luego:
```bash
docker compose up -d --force-recreate
```

Accede desde móvil a: `http://192.168.1.100:3000`

(Reemplaza `192.168.1.100` con tu IP local)

## 🔐 Variables de Entorno Críticas

| Variable | Ejemplo | Descripción |
|----------|---------|-------------|
| `POSTGRES_PASSWORD` | `MyStrongPass123!` | 20+ caracteres |
| `JWT_SECRET` | `(64 caracteres hex)` | Generado con crypto |
| `JWT_REFRESH_SECRET` | `(64 caracteres hex)` | Distinto de JWT_SECRET |
| `MQTT_BACKEND_PASSWORD` | `MqttPass123!` | Contraseña MQTT |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | URL del backend |

## 🧪 Testing Setup

Verificar que todo funciona:

```bash
# 1. Health check
curl http://localhost:3001/health

# 2. Crear admin
curl -X POST http://localhost:3001/api/setup/create-admin \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"Test@2026!"}'

# 3. Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"Test@2026!"}'

# 4. Lista dispositivos (con token del login)
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3001/api/devices
```

## 📊 Monitoreo

### Métricas en Prometheus

```bash
curl http://localhost:3001/metrics
```

### Estado del Sistema

```bash
docker compose ps
docker stats
docker system df
```

## 🧹 Limpiar

Detener servicios:

```bash
docker compose down
```

Eliminar volúmenes (⚠️ pierde datos):

```bash
docker compose down -v
```

Limpiar imágenes no usadas:

```bash
docker system prune -a
```

## 📖 Más Información

- **Documentación de Producción**: Ver `PRODUCTION.md`
- **API Reference**: Endpoints en `backend/src/api/`
- **Frontend Components**: `frontend/src/components/`
- **Database Schema**: `backend/src/db/migrations/001_initial_schema.sql`

## ⚠️ Troubleshooting

### "Credenciales inválidas"

```bash
# Verificar que el usuario existe
docker compose exec db psql -U casaiot -d casaiot \
  -c "SELECT username FROM users"

# Recrear admin
docker compose exec db psql -U casaiot -d casaiot \
  -c "DELETE FROM users WHERE username='admin'"

curl -X POST http://localhost:3001/api/setup/create-admin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"NewPassword@2026!"}'
```

### Backend no responde

```bash
# Ver logs
docker compose logs backend --tail 50

# Reiniciar
docker compose restart backend

# Reconstruir
docker compose up -d --build backend
```

### WebSocket timeout (frontend)

```bash
# Verificar MQTT
docker compose logs broker --tail 20

# Reiniciar broker
docker compose restart broker
```

---

**Versión**: 1.0.0
**Última actualización**: 2026-07-11
