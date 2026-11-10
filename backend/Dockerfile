FROM node:20-alpine

# Metadatos
LABEL maintainer="CasaIoT"
LABEL description="CasaIoT Backend API"

# Crear usuario no-root para correr la app (principio de mínimo privilegio)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S casaiot -u 1001 -G nodejs

WORKDIR /app

# Copiar archivos de dependencias primero (aprovecha cache de Docker)
COPY package.json package-lock.json* ./

# Instalar solo dependencias de producción
RUN npm install --omit=dev && \
    npm cache clean --force

# Copiar código fuente
COPY src/ ./src/

# Crear directorio de logs
RUN mkdir -p /app/logs && chown casaiot:nodejs /app/logs

# Cambiar a usuario no-root
USER casaiot

# Puerto de la aplicación
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/index.js"]
