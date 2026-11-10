FROM node:20-alpine AS builder

ARG NEXT_PUBLIC_WIFI_SSID
ARG NEXT_PUBLIC_MQTT_BROKER
ENV NEXT_PUBLIC_WIFI_SSID=$NEXT_PUBLIC_WIFI_SSID
ENV NEXT_PUBLIC_MQTT_BROKER=$NEXT_PUBLIC_MQTT_BROKER

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# ── Imagen de producción ──────────────────────────────────────
FROM node:20-alpine AS runner

RUN addgroup -g 1001 -S nodejs && \
    adduser -S casaiot -u 1001 -G nodejs

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder --chown=casaiot:nodejs /app/.next/standalone ./
COPY --from=builder --chown=casaiot:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=casaiot:nodejs /app/public ./public

USER casaiot

EXPOSE 3000

CMD ["node", "server.js"]
