// ─────────────────────────────────────────────────────────────
//  blind_motor.ino — Plantilla para Motor de Persiana
// ─────────────────────────────────────────────────────────────

#define MOTOR_UP_PIN 2
#define MOTOR_DOWN_PIN 4
#define ENCODER_PIN 5

int currentPosition = 0;  // 0-100

void setupHardware() {
  pinMode(MOTOR_UP_PIN, OUTPUT);
  pinMode(MOTOR_DOWN_PIN, OUTPUT);
  pinMode(ENCODER_PIN, INPUT);
  
  digitalWrite(MOTOR_UP_PIN, LOW);
  digitalWrite(MOTOR_DOWN_PIN, LOW);
}

void loopHardware() {
  // Monitorear encoder para actualizar posición
  // Implementar lógica de conteo de pulsos
}

void publishState() {
  JsonDocument doc;
  doc["posicion"] = currentPosition;  // 0-100
  
  char buffer[128];
  serializeJson(doc, buffer);
  mqttClient.publish(topicEstado.c_str(), buffer, true);
}

void onCommandReceived(String accion, JsonDocument& doc) {
  if (accion == "subir") {
    digitalWrite(MOTOR_UP_PIN, HIGH);
    digitalWrite(MOTOR_DOWN_PIN, LOW);
  } else if (accion == "bajar") {
    digitalWrite(MOTOR_UP_PIN, LOW);
    digitalWrite(MOTOR_DOWN_PIN, HIGH);
  } else if (accion == "parar") {
    digitalWrite(MOTOR_UP_PIN, LOW);
    digitalWrite(MOTOR_DOWN_PIN, LOW);
  } else if (accion == "posicion") {
    int targetPos = doc["posicion"] | currentPosition;
    // TODO: Calcular tiempo de movimiento basado en targetPos
    if (targetPos > currentPosition) {
      digitalWrite(MOTOR_UP_PIN, HIGH);
      digitalWrite(MOTOR_DOWN_PIN, LOW);
    } else if (targetPos < currentPosition) {
      digitalWrite(MOTOR_UP_PIN, LOW);
      digitalWrite(MOTOR_DOWN_PIN, HIGH);
    }
  }
  publishState();
}
