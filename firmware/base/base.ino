// ─────────────────────────────────────────────────────────────
//  CasaIoT — ESP32 Base Firmware
//  WiFi + TLS + MQTT
// ─────────────────────────────────────────────────────────────

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>

// ── Variables Inyectadas por el Backend ────────────────────────
const char* WIFI_SSID     = "REPLACE_WIFI_SSID";
const char* WIFI_PASSWORD = "REPLACE_WIFI_PASSWORD";
const char* BROKER_IP     = "REPLACE_BROKER_IP";
const int   BROKER_PORT   = 8883;
const char* DEVICE_ID     = "REPLACE_DEVICE_ID";
const char* CA_CERT       = REPLACE_CA_CERT;

// ── Topics (derivados del DEVICE_ID) ──────────────────────────
String topicEstado;
String topicComando;
String topicTelemetria;

// ── Instancias Globales ───────────────────────────────────────
WiFiClientSecure secureClient;
PubSubClient mqttClient(secureClient);

unsigned long lastTelemetry = 0;
const long telemetryInterval = 60000;

// ── Headers para funciones de hardware ─────────────────────────
void setupHardware();
void loopHardware();
void onCommandReceived(String accion, JsonDocument& doc);
void publishState();

void setupTopics() {
  topicEstado     = String("casa/dispositivo/") + DEVICE_ID + "/estado";
  topicComando    = String("casa/dispositivo/") + DEVICE_ID + "/comando";
  topicTelemetria = String("casa/dispositivo/") + DEVICE_ID + "/telemetria";
  Serial.println("[TOPICS] Estado: " + topicEstado);
  Serial.println("[TOPICS] Comando: " + topicComando);
  Serial.println("[TOPICS] Telemetria: " + topicTelemetria);
}

void connectWiFi() {
  Serial.println("");
  Serial.println("[WIFI] Iniciando conexion...");
  Serial.print("[WIFI] SSID: ");
  Serial.println(WIFI_SSID);
  Serial.print("[WIFI] Password length: ");
  Serial.println(strlen(WIFI_PASSWORD));

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempts++;
    if (attempts > 60) {
      Serial.println("");
      Serial.println("[WIFI] ERROR: No se pudo conectar después de 30 segundos");
      Serial.print("[WIFI] Status code: ");
      Serial.println(WiFi.status());
      delay(5000);
      attempts = 0;
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }

  Serial.println("");
  Serial.println("[WIFI] Conectado!");
  Serial.print("[WIFI] IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("[WIFI] Gateway: ");
  Serial.println(WiFi.gatewayIP());
  Serial.print("[WIFI] DNS: ");
  Serial.println(WiFi.dnsIP());
  Serial.print("[WIFI] RSSI: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
  Serial.print("[WIFI] MAC: ");
  Serial.println(WiFi.macAddress());
}

void syncNTP() {
  Serial.println("");
  Serial.println("[NTP] Sincronizando reloj...");
  configTime(-6 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  time_t now = time(nullptr);
  int attempts = 0;
  while (now < 1700000000 && attempts < 30) {
    delay(1000);
    Serial.print(".");
    now = time(nullptr);
    attempts++;
  }
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  Serial.println("");
  if (now >= 1700000000) {
    Serial.print("[NTP] Hora sincronizada: ");
    Serial.println(asctime(&timeinfo));
  } else {
    Serial.println("[NTP] WARN: No se pudo sincronizar hora, TLS puede fallar");
  }
}

void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.println("");
    Serial.println("[MQTT] ===== Intentando conectar al broker =====");
    Serial.print("[MQTT] Broker: ");
    Serial.print(BROKER_IP);
    Serial.print(":");
    Serial.println(BROKER_PORT);
    Serial.print("[MQTT] Client ID: ");
    Serial.println(DEVICE_ID);
    Serial.print("[MQTT] Username: ");
    Serial.println(DEVICE_ID);
    Serial.print("[MQTT] WiFi status: ");
    Serial.println(WiFi.status() == WL_CONNECTED ? "CONECTADO" : "DESCONECTADO");
    Serial.print("[MQTT] ESP IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("[MQTT] Gateway: ");
    Serial.println(WiFi.gatewayIP());

    int caLen = strlen(CA_CERT);
    Serial.print("[MQTT] CA_CERT length: ");
    Serial.println(caLen);
    if (caLen > 0) {
      String caPreview = String(CA_CERT).substring(0, 60);
      Serial.println("[MQTT] CA_CERT starts with: " + caPreview);
    }

    // Prueba TCP raw antes de TLS
    Serial.println("[TCP] Probando conexion raw (3s)...");
    WiFiClient testClient;
    testClient.setTimeout(3000);
    if (testClient.connect(BROKER_IP, BROKER_PORT)) {
      Serial.println("[TCP] CONEXION RAW EXITOSA");
      testClient.stop();
    } else {
      Serial.println("[TCP] CONEXION RAW FALLIDA");
    }

    if (mqttClient.connect(DEVICE_ID, DEVICE_ID, "")) {
      Serial.println("[MQTT] Conectado exitosamente!");
      Serial.print("[MQTT] Suscribiendo a: ");
      Serial.println(topicComando);
      mqttClient.subscribe(topicComando.c_str(), 1);
      publishState();
    } else {
      int rc = mqttClient.state();
      Serial.print("[MQTT] ERROR - rc=");
      Serial.println(rc);

      switch (rc) {
        case -4: Serial.println("[MQTT] Error: MQTT_CONNECTION_TIMEOUT - tiempo de espera agotado"); break;
        case -3: Serial.println("[MQTT] Error: MQTT_CONNECTION_LOST - conexion perdida"); break;
        case -2: Serial.println("[MQTT] Error: MQTT_CONNECT_FAILED - fallo en la conexion TCP/TLS"); break;
        case -1: Serial.println("[MQTT] Error: MQTT_DISCONNECTED - desconectado"); break;
        case 1:  Serial.println("[MQTT] Error: MQTT_CONNECT_BAD_PROTOCOL - version de protocolo incorrecta"); break;
        case 2:  Serial.println("[MQTT] Error: MQTT_CONNECT_BAD_CLIENT_ID - ID de cliente invalido"); break;
        case 3:  Serial.println("[MQTT] Error: MQTT_CONNECT_UNAVAILABLE - servidor no disponible"); break;
        case 4:  Serial.println("[MQTT] Error: MQTT_CONNECT_BAD_CREDENTIALS - usuario/contra incorrectos"); break;
        case 5:  Serial.println("[MQTT] Error: MQTT_CONNECT_UNAUTHORIZED - no autorizado"); break;
        default: Serial.println("[MQTT] Error: codigo desconocido"); break;
      }

      Serial.println("[MQTT] Reintentando en 5 segundos...");
      delay(5000);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.println("");
  Serial.println("[MQTT] Comando recibido!");
  Serial.print("[MQTT] Topic: ");
  Serial.println(String(topic));
  Serial.print("[MQTT] Payload: ");
  Serial.println(message);

  if (String(topic) == topicComando) {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, message);
    if (!error) {
      String accion = doc["accion"].as<String>();
      Serial.print("[MQTT] Accion: ");
      Serial.println(accion);
      onCommandReceived(accion, doc);
    } else {
      Serial.print("[MQTT] Error parseando JSON: ");
      Serial.println(error.c_str());
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("");
  Serial.println("===========================================");
  Serial.println("  CasaIoT - ESP32 Firmware");
  Serial.println("===========================================");
  Serial.print("[SYS] Device ID: ");
  Serial.println(DEVICE_ID);
  Serial.print("[SYS] Fecha compilacion: ");
  Serial.println(__DATE__);
  Serial.print("[SYS] Hora compilacion: ");
  Serial.println(__TIME__);

  setupTopics();
  setupHardware();

  // Configurar TLS
  int caLen = strlen(CA_CERT);
  Serial.println("");
  Serial.println("[TLS] Configurando conexion segura...");
  Serial.print("[TLS] Tamano certificado CA: ");
  Serial.print(caLen);
  Serial.println(" bytes");

  if (caLen > 0) {
    Serial.println("[TLS] Certificado CA disponible. Usando modo insecure (red local confiable)");
  } else {
    Serial.println("[TLS] Sin certificado CA");
  }
  // TLS cifrado pero sin verificar identidad del broker (funciona en cualquier red/IP)
  secureClient.setInsecure();
  secureClient.setTimeout(15000);

  connectWiFi();

  syncNTP();

  Serial.println("");
  Serial.println("[MQTT] Configurando servidor...");
  Serial.print("[MQTT] Host: ");
  Serial.print(BROKER_IP);
  Serial.print(" Port: ");
  Serial.println(BROKER_PORT);

  mqttClient.setServer(BROKER_IP, BROKER_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setKeepAlive(60);

  Serial.println("[SYS] Setup completado. Iniciando loop...");
  Serial.println("===========================================");
}

void sendTelemetry() {
  JsonDocument doc;
  doc["rssi"] = WiFi.RSSI();
  doc["heap"] = ESP.getFreeHeap();
  doc["uptime"] = millis() / 1000;

  char buffer[128];
  serializeJson(doc, buffer);
  bool ok = mqttClient.publish(topicTelemetria.c_str(), buffer, false);

  if (ok) {
    Serial.println("[TELEM] Enviada exitosamente");
  } else {
    Serial.println("[TELEM] Error al enviar telemetria");
  }
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[LOOP] WiFi perdido, reconectando...");
    connectWiFi();
  }

  if (!mqttClient.connected()) {
    connectMQTT();
  }

  mqttClient.loop();
  loopHardware();

  unsigned long now = millis();
  if (now - lastTelemetry > telemetryInterval) {
    lastTelemetry = now;
    Serial.println("[LOOP] Enviando telemetria...");
    sendTelemetry();
  }
}
