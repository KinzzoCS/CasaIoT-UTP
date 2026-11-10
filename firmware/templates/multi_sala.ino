// ─────────────────────────────────────────────────────────────
//  multi_sala.ino — Control de 3 ambientes vía MQTT
//
//  Hardware:
//    PIN  5 → Relé Cocina
//    PIN 18 → Relé Cuarto
//    PIN 19 → Relé Cochera
//
//  MQTT: Escucha comandos en casa/dispositivo/{DEVICE_ID}/comando
//  Publica estado en: casa/dispositivo/{DEVICE_ID}/estado
//
//  Comandos MQTT:
//    { "accion": "encender",  "sala": "cocina" }
//    { "accion": "apagar",    "sala": "cocina" }
//    { "accion": "toggle",    "sala": "cocina" }
//    { "accion": "todas_on"  }
//    { "accion": "todas_off" }
// ─────────────────────────────────────────────────────────────

struct Sala {
  int pin;
  bool estado;
  String nombre;
};

Sala salas[] = {
  { 5,  false, "cocina"  },
  { 18, false, "cuarto"  },
  { 19, false, "cochera" },
};

const int NUM_SALAS = 3;

void setupHardware() {
  for (int i = 0; i < NUM_SALAS; i++) {
    pinMode(salas[i].pin, OUTPUT);
    digitalWrite(salas[i].pin, LOW);
    salas[i].estado = false;
  }

  Serial.println("\n=== Control Multi-sala ===");
  Serial.println("Pins: 5 (cocina), 18 (cuarto), 19 (cochera)");
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

  if (!published) {
    Serial.println("ERROR: No se pudo publicar estado en MQTT");
  }
}

void onCommandReceived(String accion, JsonDocument& doc) {
  accion.toUpperCase();
  bool stateChanged = false;

  if (accion == "TODAS_ON" || accion == "TODAS_OFF") {
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
