// ─────────────────────────────────────────────────────────────
//  utils/prometheus-metrics.js — Métricas Prometheus
//
//  Expone métricas para monitoreo en Prometheus/Grafana:
//  - Requests por endpoint
//  - Latencia de DB
//  - Conexiones activas MQTT/WebSocket
//  - Errores por tipo
// ─────────────────────────────────────────────────────────────

'use strict';

const config = require('../config');

// Contadores simples en memoria (en producción: usar Prometheus client)
const metrics = {
  httpRequests: 0,
  httpErrors: 0,
  dbQueries: 0,
  dbErrors: 0,
  mqttMessages: 0,
  wsConnections: 0,
  wsDisconnections: 0,
  startTime: Date.now(),
};

/**
 * Registra una métrica de request HTTP
 */
function recordHttpRequest(method, path, statusCode) {
  metrics.httpRequests++;
  if (statusCode >= 400) {
    metrics.httpErrors++;
  }
}

/**
 * Registra una query a DB
 */
function recordDbQuery(duration, success = true) {
  metrics.dbQueries++;
  if (!success) {
    metrics.dbErrors++;
  }
}

/**
 * Registra mensaje MQTT
 */
function recordMqttMessage() {
  metrics.mqttMessages++;
}

/**
 * Registra conexión WebSocket
 */
function recordWsConnection() {
  metrics.wsConnections++;
}

/**
 * Registra desconexión WebSocket
 */
function recordWsDisconnection() {
  metrics.wsDisconnections++;
}

/**
 * Retorna métricas en formato Prometheus
 */
function getMetricsText() {
  const uptime = (Date.now() - metrics.startTime) / 1000;

  return `# HELP casaiot_http_requests_total Total HTTP requests
# TYPE casaiot_http_requests_total counter
casaiot_http_requests_total ${metrics.httpRequests}

# HELP casaiot_http_errors_total Total HTTP errors
# TYPE casaiot_http_errors_total counter
casaiot_http_errors_total ${metrics.httpErrors}

# HELP casaiot_db_queries_total Total database queries
# TYPE casaiot_db_queries_total counter
casaiot_db_queries_total ${metrics.dbQueries}

# HELP casaiot_db_errors_total Total database errors
# TYPE casaiot_db_errors_total counter
casaiot_db_errors_total ${metrics.dbErrors}

# HELP casaiot_mqtt_messages_total Total MQTT messages processed
# TYPE casaiot_mqtt_messages_total counter
casaiot_mqtt_messages_total ${metrics.mqttMessages}

# HELP casaiot_ws_active_connections Active WebSocket connections
# TYPE casaiot_ws_active_connections gauge
casaiot_ws_active_connections ${metrics.wsConnections - metrics.wsDisconnections}

# HELP casaiot_uptime_seconds Uptime in seconds
# TYPE casaiot_uptime_seconds gauge
casaiot_uptime_seconds ${uptime}
`;
}

module.exports = {
  recordHttpRequest,
  recordDbQuery,
  recordMqttMessage,
  recordWsConnection,
  recordWsDisconnection,
  getMetricsText,
};
