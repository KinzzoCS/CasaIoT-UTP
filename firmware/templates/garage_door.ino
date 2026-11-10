// ─────────────────────────────────────────────────────────────
//  garage_door.ino — Plantilla para Puerta de Cochera
// ─────────────────────────────────────────────────────────────

#define RELAY_PIN 2
#define OPEN_SENSOR_PIN 4
#define CLOSE_SENSOR_PIN 5

// Estados: "abierto", "cerrado", "intermedio"
String doorState = "cerrado";
bool isMoving = false;

void setupHardware() {
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(OPEN_SENSOR_PIN, INPUT);
  pinMode(CLOSE_SENSOR_PIN, INPUT);
  
  digitalWrite(RELAY_PIN, LOW);
}

void loopHardware() {
  // Verificar sensores de límite
  bool isOpen = digitalRead(OPEN_SENSOR_PIN) == HIGH;
  bool isClosed = digitalRead(CLOSE_SENSOR_PIN) == HIGH;

  if (isOpen) {
    doorState = "abierto";
    isMoving = false;
    digitalWrite(RELAY_PIN, LOW);
  } else if (isClosed) {
    doorState = "cerrado";
    isMoving = false;
    digitalWrite(RELAY_PIN, LOW);
  } else if (isMoving) {
    doorState = "intermedio";
  }
}

void publishState() {
  JsonDocument doc;
  doc["estado"] = doorState;
  doc["movimiento"] = isMoving;
  
  char buffer[128];
  serializeJson(doc, buffer);
  mqttClient.publish(topicEstado.c_str(), buffer, true);
}

void onCommandReceived(String accion, JsonDocument& doc) {
  if (accion == "abrir") {
    if (doorState != "abierto") {
      digitalWrite(RELAY_PIN, HIGH);
      isMoving = true;
      // El relay se apagará cuando el sensor de abierto se active
    }
  } else if (accion == "cerrar") {
    if (doorState != "cerrado") {
      digitalWrite(RELAY_PIN, HIGH);
      isMoving = true;
      // El relay se apagará cuando el sensor de cerrado se active
    }
  } else if (accion == "toggle") {
    if (doorState == "cerrado") {
      accion = "abrir";
      onCommandReceived(accion, doc);
    } else if (doorState == "abierto") {
      accion = "cerrar";
      onCommandReceived(accion, doc);
    }
  }
  publishState();
}
