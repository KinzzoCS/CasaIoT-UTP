'use client';

// ─────────────────────────────────────────────────────────────
//  FirmwareInstructionsModal.jsx — Modal con instrucciones
// ─────────────────────────────────────────────────────────────

import { X, Copy, Check } from 'lucide-react';
import { useState } from 'react';

const PINOUT_GUIDE = {
  light: {
    pins: [
      { pin: '5', component: 'LED/Relé', color: 'var(--color-blue-500)' },
      { pin: 'GND', component: 'Tierra', color: 'var(--text-muted)' },
      { pin: '3.3V', component: 'Alimentación', color: 'var(--color-success)' },
    ],
    instructions: [
      'OPCIÓN A - LED simple (bajo amperaje): Resistencia limitadora 220Ω en serie con LED, conectar PIN 5 al cátodo (-) de la resistencia',
      'OPCIÓN B - Relé/Carga de alto amperaje: Conecta PIN 5 a la base del transistor BC547 (a través de resistencia 1kΩ)',
      'Si usas transistor: Colector → Bobina del relé, Emisor → GND',
      'Si usas transistor: Diodo de protección (1N4007) en paralelo con bobina (cátodo a 3.3V)',
      'GND del relé/LED → GND del ESP32',
      'Pin común del relé → Carga (luz/dispositivo)',
      '⚠️ IMPORTANTE: Nunca excedas 500mA en un PIN de ESP32',
    ],
  },
  pir_sensor: {
    pins: [
      { pin: '2', component: 'Sensor PIR', color: 'var(--color-warning)' },
      { pin: 'GND', component: 'Tierra', color: 'var(--text-muted)' },
      { pin: '5V', component: 'Alimentación', color: 'var(--color-success)' },
    ],
    instructions: [
      'Conecta PIN 5V del ESP32 → PIN Vcc del sensor PIR',
      'Conecta PIN 2 del ESP32 → PIN OUT del sensor PIR',
      'Conecta GND del ESP32 → PIN GND del sensor PIR',
      'Espera 30 segundos después de encender para que se calibre',
      'El LED del sensor parpadeará durante la calibración',
      'Mantén alejado de fuentes de calor intensas durante calibración',
    ],
  },
  blind_motor: {
    pins: [
      { pin: '2', component: 'Relé Motor ARRIBA', color: 'var(--color-success)' },
      { pin: '4', component: 'Relé Motor ABAJO', color: 'var(--color-danger)' },
      { pin: '5', component: 'Encoder', color: 'var(--color-warning)' },
    ],
    instructions: [
      'Conecta motor a relé de doble sentido (relés ARRIBA y ABAJO)',
      'PIN 2 → Bobina relé ARRIBA',
      'PIN 4 → Bobina relé ABAJO',
      'PIN 5 → Entrada encoder (cuenta de pulsos)',
      'Instala finales de carrera (sensores) en posiciones abierta y cerrada',
      'Prueba el motor manualmente antes de subir el código',
    ],
  },
  garage_door: {
    pins: [
      { pin: '2', component: 'Relé Puerta', color: 'var(--color-blue-500)' },
      { pin: '4', component: 'Sensor ABIERTO', color: 'var(--color-success)' },
      { pin: '5', component: 'Sensor CERRADO', color: 'var(--color-danger)' },
    ],
    instructions: [
      'Conecta el relé al actuador o motor de la puerta',
      'PIN 2 → Bobina del relé',
      'PIN 4 → Sensor de posición ABIERTO (reed switch o solenoide)',
      'PIN 5 → Sensor de posición CERRADO (reed switch o solenoide)',
      'Ambos sensores deben estar en HIGH cuando se activan',
      'Prueba manualmente el funcionamiento de ambos sensores',
    ],
  },
  ldr_sensor: {
    pins: [
      { pin: 'A0', component: 'Sensor LDR', color: 'var(--color-warning)' },
      { pin: 'GND', component: 'Tierra', color: 'var(--text-muted)' },
      { pin: '5V', component: 'Alimentación', color: 'var(--color-success)' },
    ],
    instructions: [
      'Crea un divisor de voltaje: LDR en serie con resistencia de 10kΩ',
      'Conexión: 5V → LDR → Resistencia 10kΩ → GND',
      'Punto medio (entre LDR y resistencia) → PIN A0 del ESP32',
      'Protege el LDR de luz artificial que pueda interferir',
      'El sensor es más preciso en condiciones de luz natural',
      'Calibra el umbral según tu entorno (valores típicos: 300-700)',
    ],
  },
  multi_sala: {
    pins: [
      { pin: '5', component: 'Relé Cocina', color: 'var(--color-blue-500)' },
      { pin: '18', component: 'Relé Cuarto', color: 'var(--color-success)' },
      { pin: '19', component: 'Relé Cochera', color: 'var(--color-warning)' },
      { pin: 'GND', component: 'Tierra común relés', color: 'var(--text-muted)' },
      { pin: '3.3V', component: 'Alimentación relés', color: 'var(--color-success)' },
    ],
    instructions: [
      'Conecta cada relé a su carga correspondiente (cocina, cuarto, cochera)',
      'PIN 5 → Bobina relé COCINA (con resistencia 1kΩ a base de transistor)',
      'PIN 18 → Bobina relé CUARTO (con resistencia 1kΩ a base de transistor)',
      'PIN 19 → Bobina relé COCHERA (con resistencia 1kΩ a base de transistor)',
      'Diodo de protección (1N4007) en paralelo con cada bobina (cátodo a 3.3V)',
      'GND de todos los relés → GND del ESP32',
      '⚠️ IMPORTANTE: Nunca excedas 500mA en un PIN de ESP32',
    ],
  },
  multi_sala_servo: {
    pins: [
      { pin: '4', component: 'Relé Luz Sala', color: 'var(--color-blue-500)' },
      { pin: '5', component: 'Relé Luz Cocina', color: 'var(--color-success)' },
      { pin: '18', component: 'Relé Luz Cuarto', color: 'var(--color-warning)' },
      { pin: '19', component: 'Servo Cochera (90° cerrada / 0° abierta)', color: 'var(--color-danger)' },
      { pin: 'GND', component: 'Tierra común (relés + servo)', color: 'var(--text-muted)' },
      { pin: '5V', component: 'Alimentación servo', color: 'var(--color-success)' },
      { pin: '3.3V', component: 'Alimentación relés', color: 'var(--color-success)' },
    ],
    instructions: [
      'PIN 4 → Bobina relé luz SALA (resistencia 1kΩ a base de transistor)',
      'PIN 5 → Bobina relé luz COCINA (resistencia 1kΩ a base de transistor)',
      'PIN 18 → Bobina relé luz CUARTO (resistencia 1kΩ a base de transistor)',
      'PIN 19 → Señal del SERVO de la cochera (naranja/amarillo)',
      'Servo: cable rojo → 5V, café/negro → GND, señal → PIN 19',
      '⚠️ Alimenta el servo con fuente externa de 5V (2A) si es de alta carga, NO desde el ESP32',
      'Diodo de protección (1N4007) en paralelo con cada bobina de relé (cátodo a 3.3V)',
      'El servo se mueve entre 90° (cerrada) y 0° (abierta)',
    ],
  },
};

const COMMANDS_GUIDE = {
  light: [
    { label: 'Encender LED', cmd: '{"accion": "encender"}', color: 'var(--color-success)' },
    { label: 'Apagar LED', cmd: '{"accion": "apagar"}', color: 'var(--color-danger)' },
    { label: 'Alternar', cmd: '{"accion": "toggle"}', color: 'var(--color-warning)' },
  ],
  multi_sala: [
    { label: 'Encender sala', cmd: '{"accion": "encender", "sala": "cocina"}', color: 'var(--color-success)' },
    { label: 'Apagar sala', cmd: '{"accion": "apagar", "sala": "cocina"}', color: 'var(--color-danger)' },
    { label: 'Alternar sala', cmd: '{"accion": "toggle", "sala": "cocina"}', color: 'var(--color-warning)' },
    { label: 'Todas Encendido', cmd: '{"accion": "todas_on"}', color: 'var(--color-success)' },
    { label: 'Todas Apagado', cmd: '{"accion": "todas_off"}', color: 'var(--color-danger)' },
  ],
  multi_sala_servo: [
    { label: 'Encender luz Sala', cmd: '{"accion": "encender", "sala": "sala"}', color: 'var(--color-success)' },
    { label: 'Apagar luz Cocina', cmd: '{"accion": "apagar", "sala": "cocina"}', color: 'var(--color-danger)' },
    { label: 'Todas Encendido', cmd: '{"accion": "todas_on"}', color: 'var(--color-success)' },
    { label: 'Todas Apagado', cmd: '{"accion": "todas_off"}', color: 'var(--color-danger)' },
    { label: 'Abrir Cochera (servo 0°)', cmd: '{"accion": "abrir_cochera"}', color: 'var(--color-success)' },
    { label: 'Cerrar Cochera (servo 90°)', cmd: '{"accion": "cerrar_cochera"}', color: 'var(--color-danger)' },
    { label: 'Alternar Cochera', cmd: '{"accion": "toggle_cochera"}', color: 'var(--color-warning)' },
  ],
};

export default function FirmwareInstructionsModal({ isOpen, deviceName, deviceType, onClose, deviceMqttClientId, deviceSsid, deviceBroker }) {
  const [copied, setCopied] = useState(false);
  const guide = PINOUT_GUIDE[deviceType] || PINOUT_GUIDE.light;
  const commands = COMMANDS_GUIDE[deviceType] || COMMANDS_GUIDE.light;

  if (!isOpen) return null;

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 'var(--space-4)',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-6)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '700', color: 'var(--text-primary)' }}>
            Instrucciones: {deviceName}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 'var(--space-2)',
              color: 'var(--text-muted)',
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 'var(--space-6)' }}>
          {/* Pinout */}
          <section style={{ marginBottom: 'var(--space-8)' }}>
            <h3 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: '700',
              marginBottom: 'var(--space-4)',
              color: 'var(--text-primary)',
            }}>
              📌 Conexión de Pines
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {guide.pins.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                    padding: 'var(--space-3)',
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--radius-full)',
                      background: p.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      color: 'white',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    {p.pin}
                  </div>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                    {p.component}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Step-by-step instructions */}
          <section style={{ marginBottom: 'var(--space-8)' }}>
            <h3 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: '700',
              marginBottom: 'var(--space-4)',
              color: 'var(--text-primary)',
            }}>
              🔧 Pasos de Instalación
            </h3>
            <ol style={{ paddingLeft: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {guide.instructions.map((instruction, i) => (
                <li
                  key={i}
                  style={{
                    color: 'var(--text-secondary)',
                    lineHeight: '1.6',
                    listStyle: 'decimal',
                  }}
                >
                  {instruction}
                </li>
              ))}
            </ol>
          </section>

          {/* Upload to ESP32 */}
          <section style={{ marginBottom: 'var(--space-8)' }}>
            <h3 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: '700',
              marginBottom: 'var(--space-4)',
              color: 'var(--text-primary)',
            }}>
              💾 Cómo Subir el Firmware
            </h3>
            <div style={{
              background: 'var(--color-blue-50)',
              borderLeft: '4px solid var(--color-blue-500)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-4)',
            }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
                <strong>Requisitos:</strong>
              </p>
              <ul style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', paddingLeft: 'var(--space-5)' }}>
                <li>Arduino IDE instalado</li>
                <li>Placa ESP32 configurada en Arduino IDE (URL: <code style={{fontSize: '10px'}}>https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json</code>)</li>
                <li>Cable USB-Serial para conectar ESP32</li>
              </ul>
              <div style={{
                background: 'var(--color-danger-bg, #fef2f2)',
                border: '1px solid var(--color-danger, #ef4444)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                marginTop: 'var(--space-3)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-danger, #dc2626)',
              }}>
                <strong>📚 Librerías requeridas:</strong> Antes de compilar, instala desde
                Sketch → Include Library → Manage Libraries:
                <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
                  <li><strong>PubSubClient</strong> de Nick O&apos;Leary</li>
                  <li><strong>ArduinoJson</strong> de Benoit Blanchon</li>
                </ol>
              </div>
            </div>

            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
            }}>
              <ol style={{ paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <li style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                  Abre Arduino IDE y copia el código descargado
                </li>
                <li style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                  Selecciona: Tools → Board → esp32 → ESP32 Dev Module
                </li>
                <li style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                  Selecciona el puerto COM (Tools → Port)
                </li>
                <li style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                  Click en Upload (Ctrl+U o botón flecha)
                </li>
                <li style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                  Espera a que diga &ldquo;Done uploading&rdquo;
                </li>
              </ol>
            </div>
          </section>

          {/* WiFi Configuration */}
          <section style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: '700',
              marginBottom: 'var(--space-4)',
              color: 'var(--text-primary)',
            }}>
              📡 Configuración WiFi & MQTT
            </h3>
            <div style={{
              background: 'var(--color-warning-bg)',
              borderLeft: '4px solid var(--color-warning)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
            }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                <strong>El firmware está preconfigurado con:</strong>
              </p>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-sm)',
              }}>
                <div>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>WiFi SSID:</span>
                  <div style={{
                    background: 'white',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    marginTop: '4px',
                    fontFamily: 'monospace',
                    fontSize: 'var(--text-xs)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span>{deviceSsid || 'Ya fue configurado al descargar'}</span>
                    <button
                      onClick={() => copyToClipboard(deviceSsid || '')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Broker MQTT:</span>
                  <div style={{
                    background: 'white',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    marginTop: '4px',
                    fontFamily: 'monospace',
                    fontSize: 'var(--text-xs)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span>{deviceBroker || 'Ya fue configurado al descargar'}</span>
                    <button
                      onClick={() => copyToClipboard(deviceBroker || '')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Device ID:</span>
                  <div style={{
                    background: 'white',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    marginTop: '4px',
                    fontFamily: 'monospace',
                    fontSize: 'var(--text-xs)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span>{deviceMqttClientId || '—'}</span>
                    <button
                      onClick={() => copyToClipboard(deviceMqttClientId || '')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* MQTT Commands */}
          <section style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: '700',
              marginBottom: 'var(--space-4)',
              color: 'var(--text-primary)',
            }}>
              🎮 Comandos MQTT Disponibles
            </h3>
            <div style={{
              background: 'var(--color-blue-50)',
              borderLeft: '4px solid var(--color-blue-500)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
            }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
                <strong>Publica estos comandos en:</strong>
              </p>
              <div style={{
                background: 'white',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'monospace',
                fontSize: 'var(--text-xs)',
                marginBottom: 'var(--space-3)',
                wordBreak: 'break-all',
              }}>
                casa/dispositivo/&lt;DEVICE_ID&gt;/comando
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {commands.map((cmd, i) => (
                  <div key={i}>
                    <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{cmd.label}:</strong>
                    <code style={{
                      display: 'block',
                      background: 'white',
                      padding: '8px',
                      borderRadius: '4px',
                      fontSize: 'var(--text-xs)',
                      marginTop: '4px',
                      fontFamily: 'monospace',
                      color: cmd.color,
                    }}>
                      {cmd.cmd}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div style={{
          padding: 'var(--space-4) var(--space-6)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: 'var(--space-3)',
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: 'var(--space-3)',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
