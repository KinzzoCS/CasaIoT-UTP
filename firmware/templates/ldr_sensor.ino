// ─────────────────────────────────────────────────────────────
//  ldr_sensor.ino — Plantilla para Sensor LDR (Luminosidad)
// ─────────────────────────────────────────────────────────────

#define LDR_PIN A0
#define READING_INTERVAL 5000  // Leer cada 5 segundos

int luxLevel = 0;
int threshold = 500;  // Umbral de oscuridad configurable
unsigned long lastReading = 0;

void setupHardware() {
  pinMode(LDR_PIN, INPUT);
}

void loopHardware() {
  // Leer sensor cada READING_INTERVAL ms
  if (millis() - lastReading < READING_INTERVAL) return;
  lastReading = millis();

  int rawValue = analogRead(LDR_PIN);
  // Convertir valor ADC a aproximación de lux (0-4095 -> 0-1000 lux)
  luxLevel = map(rawValue, 0, 4095, 0, 1000);
  
  publishState();
}

void publishState() {
  JsonDocument doc;
  doc["luminosidad"] = luxLevel;
  doc["oscuro"] = luxLevel < threshold;
  
  char buffer[128];
  serializeJson(doc, buffer);
  mqttClient.publish(topicEstado.c_str(), buffer, false);  // No retained para sensor
}

void onCommandReceived(String accion, JsonDocument& doc) {
  // LDR sensor es solo lectura, pero permite cambiar threshold
  if (accion == "set_threshold") {
    int newThreshold = doc["threshold"] | threshold;
    threshold = constrain(newThreshold, 0, 1000);
    publishState();
  }
}
