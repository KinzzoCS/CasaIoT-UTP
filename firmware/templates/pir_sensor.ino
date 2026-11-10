// ─────────────────────────────────────────────────────────────
//  pir_sensor.ino — Plantilla para Sensor PIR (Movimiento)
// ─────────────────────────────────────────────────────────────

#define PIR_PIN 2
#define PIR_DEBOUNCE_TIME 500  // ms para evitar falsos positivos

bool motionDetected = false;
unsigned long lastMotionTime = 0;

void setupHardware() {
  pinMode(PIR_PIN, INPUT);  // PIR sensor
}

void loopHardware() {
  // Leer sensor cada 100ms
  static unsigned long lastRead = 0;
  if (millis() - lastRead < 100) return;
  lastRead = millis();

  int sensorValue = digitalRead(PIR_PIN);
  bool currentMotion = (sensorValue == HIGH);

  // Detectar cambios de estado con debounce
  if (currentMotion != motionDetected) {
    if (millis() - lastMotionTime > PIR_DEBOUNCE_TIME) {
      motionDetected = currentMotion;
      lastMotionTime = millis();
      publishState();  // Publicar cambio inmediatamente
    }
  }
}

void publishState() {
  JsonDocument doc;
  doc["movimiento"] = motionDetected;
  doc["ts"] = millis();
  
  char buffer[128];
  serializeJson(doc, buffer);
  mqttClient.publish(topicEstado.c_str(), buffer, false);  // No retained para sensor
}

void onCommandReceived(String accion, JsonDocument& doc) {
  // PIR sensor es solo lectura, no recibe comandos
  // pero podríamos calibrar o cambiar sensibilidad en el futuro
  if (accion == "calibrar") {
    // TODO: Lógica de calibración
  }
}
