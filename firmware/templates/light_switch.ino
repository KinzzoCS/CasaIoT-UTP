// ─────────────────────────────────────────────────────────────
//  light_switch.ino — Control de LED/Relé vía MQTT
//
//  Hardware: LED en PIN 5
//  MQTT: Escucha comandos en casa/dispositivo/{DEVICE_ID}/comando
//  Publica estado en: casa/dispositivo/{DEVICE_ID}/estado
//
//  Comandos MQTT esperados:
//  { "accion": "encender" }
//  { "accion": "apagar" }
//  { "accion": "toggle" }
// ─────────────────────────────────────────────────────────────

const int LED_PIN = 5;
bool isOn = false;
unsigned long lastStateChange = 0;

void setupHardware() {
  // Configurar PIN del LED como salida
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  
  Serial.println("\n=== Control de LED ===");
  Serial.println("PIN: 5");
  Serial.println("Conectado a MQTT");
  Serial.println("Escuchando comandos...\n");
}

void loopHardware() {
  // Aquí se podrían agregar botones físicos para control manual
  // Por ahora, solo respondemos a comandos MQTT
}

void publishState() {
  // Crear JSON con estado actual
  JsonDocument doc;
  doc["estado"] = isOn ? "on" : "off";
  doc["encendido"] = isOn;
  doc["timestamp"] = millis();
  
  // Serializar y enviar
  char buffer[128];
  serializeJson(doc, buffer);
  
  bool published = mqttClient.publish(topicEstado.c_str(), buffer, true);
  
  // Debug en Serial
  if (isOn) {
    Serial.println("LED ENCENDIDO");
  } else {
    Serial.println("LED APAGADO");
  }
  
  if (!published) {
    Serial.println("ERROR: No se pudo publicar estado en MQTT");
  }
}

void onCommandReceived(String accion, JsonDocument& doc) {
  // Convertir a mayúsculas para mayor compatibilidad
  accion.toUpperCase();
  
  bool stateChanged = false;
  
  if (accion == "ENCENDER" || accion == "ON") {
    if (!isOn) {
      isOn = true;
      digitalWrite(LED_PIN, HIGH);
      stateChanged = true;
      Serial.println("Comando recibido: ENCENDER");
    }
  } 
  else if (accion == "APAGAR" || accion == "OFF") {
    if (isOn) {
      isOn = false;
      digitalWrite(LED_PIN, LOW);
      stateChanged = true;
      Serial.println("Comando recibido: APAGAR");
    }
  } 
  else if (accion == "TOGGLE") {
    isOn = !isOn;
    digitalWrite(LED_PIN, isOn ? HIGH : LOW);
    stateChanged = true;
    Serial.println("Comando recibido: TOGGLE");
  }
  else {
    Serial.println("Comando no reconocido: " + accion);
  }
  
  // Publicar estado solo si cambió
  if (stateChanged) {
    publishState();
  }
}
