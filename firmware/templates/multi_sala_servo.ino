// ─────────────────────────────────────────────────────────────
//  multi_sala_servo.ino — 3 luces + cochera con servo vía MQTT
//
//  Hardware:
//    PIN  4 → Relé Luz Sala
//    PIN  5 → Relé Luz Cocina
//    PIN 18 → Relé Luz Cuarto
//    PIN 19 → Servo Cochera (90° cerrada / 0° abierta)
//
//  MQTT: Escucha comandos en casa/dispositivo/{DEVICE_ID}/comando
//  Publica estado en: casa/dispositivo/{DEVICE_ID}/estado
//
//  Comandos MQTT (luces):
//    { "accion": "encender",  "sala": "sala" }
//    { "accion": "apagar",    "sala": "cocina" }
//    { "accion": "toggle",    "sala": "cuarto" }
//    { "accion": "todas_on"  }
//    { "accion": "todas_off" }
//
//  Comandos MQTT (cochera/servo):
//    { "accion": "abrir_cochera" }   → servo a 0° (abierta)
//    { "accion": "cerrar_cochera" }  → servo a 90° (cerrada)
//    { "accion": "toggle_cochera" }
// ─────────────────────────────────────────────────────────────

#include <ESP32Servo.h>

struct Sala {
  int pin;
  bool estado;
  String nombre;
};

Sala salas[] = {
  { 4,  false, "sala"   },
  { 5,  false, "cocina" },
  { 18, false, "cuarto" },
};

const int NUM_SALAS = 3;

// ── Servo Cochera ─────────────────────────────────────────────
const int SERVO_PIN = 19;
const int SERVO_CERRADA = 90;
const int SERVO_ABIERTA = 0;

Servo servoCochera;
bool cocheraAbierta = false;

void setupHardware() {
  for (int i = 0; i < NUM_SALAS; i++) {
    pinMode(salas[i].pin, OUTPUT);
    digitalWrite(salas[i].pin, LOW);
    salas[i].estado = false;
  }

  // Servo: 90° cerrada, 0° abierta
  servoCochera.attach(SERVO_PIN, 500, 2400);
  servoCochera.write(SERVO_CERRADA);
  cocheraAbierta = false;

  Serial.println("\n=== Control Multi-sala + Servo ===");
  Serial.println("Pins: 4 (sala), 5 (cocina), 18 (cuarto), 19 (servo cochera)");
  Serial.println("Servo rango: 90 (cerrada) - 0 (abierta) grados");
  Serial.println("Listo para comandos MQTT\n");
}

void loopHardware() {
}

void publishState() {
  JsonDocument doc;
  JsonObject salasObj = doc["salas"].to<JsonObject>();

  for (int i = 0; i < NUM_SALAS; i++) {
    salasObj[salas[i].nombre] = salas[i].estado;
  }

  doc["cochera"] = cocheraAbierta;
  doc["timestamp"] = millis();

  char buffer[256];
  serializeJson(doc, buffer);

  bool published = mqttClient.publish(topicEstado.c_str(), buffer, true);

  Serial.println("Estado publicado:");
  for (int i = 0; i < NUM_SALAS; i++) {
    Serial.print("  ");
    Serial.print(salas[i].nombre);
    Serial.print(": ");
    Serial.println(salas[i].estado ? "ON" : "OFF");
  }
  Serial.print("  cochera: ");
  Serial.println(cocheraAbierta ? "ABIERTA (0°)" : "CERRADA (90°)");

  if (!published) {
    Serial.println("ERROR: No se pudo publicar estado en MQTT");
  }
}

void setCochera(bool abrir) {
  int angulo = abrir ? SERVO_ABIERTA : SERVO_CERRADA;
  servoCochera.write(angulo);
  cocheraAbierta = abrir;
  Serial.print("Cochera: ");
  Serial.print(abrir ? "ABIERTA" : "CERRADA");
  Serial.print(" (");
  Serial.print(angulo);
  Serial.println(" grados)");
}

void onCommandReceived(String accion, JsonDocument& doc) {
  accion.toUpperCase();
  bool stateChanged = false;

  if (accion == "ABRIR_COCHERA") {
    setCochera(true);
    stateChanged = true;
  } else if (accion == "CERRAR_COCHERA") {
    setCochera(false);
    stateChanged = true;
  } else if (accion == "TOGGLE_COCHERA") {
    setCochera(!cocheraAbierta);
    stateChanged = true;
  } else if (accion == "TODAS_ON" || accion == "TODAS_OFF") {
    bool nuevoEstado = (accion == "TODAS_ON");
    for (int i = 0; i < NUM_SALAS; i++) {
      if (salas[i].estado != nuevoEstado) {
        salas[i].estado = nuevoEstado;
        digitalWrite(salas[i].pin, nuevoEstado ? HIGH : LOW);
        stateChanged = true;
      }
    }
    Serial.println(accion == "TODAS_ON" ? "Todas ENCENDIDAS" : "Todas APAGADAS");
  } else {
    String sala = doc["sala"].as<String>();
    if (sala.isEmpty()) {
      sala = doc["params"]["sala"].as<String>();
    }
    if (sala.isEmpty()) {
      Serial.println("ERROR: Comando requiere campo 'sala'");
      return;
    }

    int idx = -1;
    for (int i = 0; i < NUM_SALAS; i++) {
      if (salas[i].nombre == sala) {
        idx = i;
        break;
      }
    }

    if (idx == -1) {
      Serial.println("ERROR: Sala desconocida: " + sala);
      return;
    }

    if (accion == "ENCENDER" || accion == "ON") {
      if (!salas[idx].estado) {
        salas[idx].estado = true;
        digitalWrite(salas[idx].pin, HIGH);
        stateChanged = true;
        Serial.println("Sala " + sala + " ENCENDIDA");
      }
    } else if (accion == "APAGAR" || accion == "OFF") {
      if (salas[idx].estado) {
        salas[idx].estado = false;
        digitalWrite(salas[idx].pin, LOW);
        stateChanged = true;
        Serial.println("Sala " + sala + " APAGADA");
      }
    } else if (accion == "TOGGLE") {
      salas[idx].estado = !salas[idx].estado;
      digitalWrite(salas[idx].pin, salas[idx].estado ? HIGH : LOW);
      stateChanged = true;
      Serial.println("Sala " + sala + " TOGGLE -> " + (salas[idx].estado ? "ON" : "OFF"));
    } else {
      Serial.println("Comando no reconocido: " + accion);
      return;
    }
  }

  if (stateChanged) {
    publishState();
  }
}
