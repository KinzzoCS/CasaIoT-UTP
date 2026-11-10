# 🔓 Actualización: Permisos Eliminados

## Cambios Realizados

Todos los endpoints ahora **requieren solo autenticación (JWT válido)**, sin restricciones de rol.

### Endpoints Modificados

| Endpoint | Antes | Ahora |
|----------|-------|-------|
| `POST /api/devices` | Solo admin | Cualquier usuario |
| `PATCH /api/devices/:id` | Solo admin | Cualquier usuario |
| `DELETE /api/devices/:id` | Solo admin | Cualquier usuario |
| `POST /api/devices/:id/command` | Cualquier usuario | Cualquier usuario (sin cambio) |
| `POST /api/reminders` | Solo admin | Cualquier usuario |
| `PATCH /api/reminders/:id/dismiss` | Cualquier usuario | Cualquier usuario (sin cambio) |
| `POST /api/schedules` | Solo admin | Cualquier usuario |
| `PATCH /api/schedules/:id/toggle` | Solo admin | Cualquier usuario |
| `DELETE /api/schedules/:id` | Solo admin | Cualquier usuario |
| `GET /api/firmware/generate` | Solo admin | Cualquier usuario |

### Archivos Modificados

- ✅ `backend/src/api/devices.js` — Removidos 3x `requireRole('admin')`
- ✅ `backend/src/api/reminders.js` — Removido 1x `requireRole('admin')`
- ✅ `backend/src/api/schedules.js` — Removidos 3x `requireRole('admin')`
- ✅ `backend/src/api/firmware.js` — Removido 1x `requireRole('admin')`

## ✅ Verificado

```bash
# Crear dispositivo (antes daba 403, ahora funciona)
curl -X POST http://localhost:3001/api/devices \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Lámpara","type":"light","mqttClientId":"lamp-001"}'

# Response: 201 Created ✓
```

## 🔒 Seguridad

- ✅ Sigue requiriendo JWT válido (usuario autenticado)
- ✅ Sigue validando entrada (UUID, tipos, etc.)
- ✅ Sigue registrando logs con userId
- ✅ Rate limiting sigue activo

## 🎯 Rol de `role` en la BD

La columna `role` en tabla `users` sigue existiendo por compatibilidad futura.  
Por ahora se ignora en todos los endpoints.

Si en el futuro necesitas volver a agregar permisos, solo reimplementa los `requireRole()` en los endpoints necesarios.

---

**Actualización**: 2026-07-11  
**Status**: ✅ Funcional
