'use client';

import { useState, useRef, useCallback } from 'react';

const ROOM_ALIASES = {
  sala: ['sala', 'living', 'sala de estar', 'estancia'],
  cocina: ['cocina', 'kitchen'],
  cuarto: ['cuarto', 'dormitorio', 'recamara', 'recámara', 'habitacion', 'habitación', 'room', 'bedroom'],
  cochera: ['cochera', 'garage', 'garaje', 'garaj'],
};

const ALL_ROOM_WORDS = ['sala', 'living', 'estancia', 'cocina', 'kitchen', 'cuarto', 'dormitorio', 'recamara', 'recámara', 'habitacion', 'habitación', 'room', 'bedroom', 'cochera', 'garage', 'garaje', 'garaj', 'todos', 'todas', 'todo', 'toda'];

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

function findRooms(text) {
  const lower = text.toLowerCase();
  const found = [];
  for (const [room, aliases] of Object.entries(ROOM_ALIASES)) {
    for (const alias of aliases) {
      if (lower.includes(alias)) {
        if (!found.includes(room)) found.push(room);
        break;
      }
    }
  }
  return found;
}

function mentionsAll(text) {
  return /todos|todas|todo|toda/i.test(text);
}

function findDevice(text, devices, checkAllTypes = false) {
  let lower = text.toLowerCase().trim()
    .replace(/^(?:(?:de|el|la|del|las|los|un|una|foco|focos|luz|luces|switch|interruptor)\s+)+/g, '');

  let matched = devices.filter(d => {
    const name = d.name.toLowerCase();
    return name === lower || name.includes(lower) || lower.includes(name);
  });
  if (matched.length > 0) return matched[0];

  const withoutRooms = lower.replace(new RegExp('\\b(' + ALL_ROOM_WORDS.join('|') + ')\\b', 'g'), '').trim();
  if (withoutRooms && withoutRooms !== lower) {
    matched = devices.filter(d => {
      const name = d.name.toLowerCase();
      return name === withoutRooms || name.includes(withoutRooms) || withoutRooms.includes(name);
    });
    if (matched.length > 0) return matched[0];
  }

  const words = lower.split(/\s+/).filter(w => w.length > 2 && !ALL_ROOM_WORDS.includes(w));
  if (words.length > 0) {
    matched = devices.filter(d => {
      const name = d.name.toLowerCase();
      return words.some(w => name.includes(w));
    });
    if (matched.length > 0) return matched[0];
  }

  const onlyRoomWords = lower.split(/\s+/).every(w => w.length <= 2 || ALL_ROOM_WORDS.includes(w));
  if (checkAllTypes && onlyRoomWords) {
    const ms = devices.find(d => d.type === 'multi_sala' || d.type === 'multi_sala_servo');
    if (ms) return ms;
  }

  return null;
}

function parseSingleCommand(text, devices) {
  const lower = text.toLowerCase().trim();

  const actionMap = [
    { action: 'encender', keywords: ['enciende', 'prende', 'encender', 'activar', 'prender'] },
    { action: 'apagar',   keywords: ['apaga', 'apagar', 'desactivar', 'apaguen'] },
    { action: 'toggle',   keywords: ['cambia', 'toggle', 'cambiar', 'invertir'] },
    { action: 'abrir_cochera', keywords: ['abre la cochera', 'abrir la cochera', 'abre cochera', 'abrir cochera', 'abre el garage', 'abre el garaje'] },
    { action: 'cerrar_cochera', keywords: ['cierra la cochera', 'cerrar la cochera', 'cierra cochera', 'cerrar cochera', 'cierra el garage', 'cierra el garaje'] },
  ];

  for (const { action, keywords } of actionMap) {
    for (const kw of keywords) {
      const idx = lower.indexOf(kw);
      if (idx === -1) continue;
      const rest = lower.slice(idx + kw.length).trim();

      const rooms = findRooms(rest);
      const all = mentionsAll(rest);
      const isCocheraAction = action === 'abrir_cochera' || action === 'cerrar_cochera';

      let device = findDevice(rest, devices, rooms.length > 0 || all || isCocheraAction);
      if (!device) continue;

      return { action, device, rooms, all, error: null };
    }
  }

  return null;
}

function parseCommands(text, devices) {
  const segments = text.split(/\s+y\s+/i).map(s => s.trim()).filter(Boolean);
  const results = [];

  for (const seg of segments) {
    const parsed = parseSingleCommand(seg, devices);
    if (!parsed) {
      results.push({ error: `No entendí: "${seg}"` });
    } else if (parsed.error) {
      results.push({ error: parsed.error });
    } else {
      results.push(parsed);
    }
  }

  return results;
}

function buildResultMessages(parsed, devices, sendCommand) {
  return parsed.map(p => {
    if (p.error) return { type: 'error', message: p.error };

    const isMultiSala = p.device.type === 'multi_sala' || p.device.type === 'multi_sala_servo';

    if (isMultiSala && p.all) {
      const action = p.action === 'encender' ? 'todas_on' : 'todas_off';
      sendCommand(p.device.id, action);
      return { type: 'success', message: `${p.action === 'encender' ? 'Encendidas' : 'Apagadas'}: todas las salas de ${p.device.name}`, device: p.device, action };
    }

    if (isMultiSala && p.rooms.length > 0) {
      for (const room of p.rooms) {
        sendCommand(p.device.id, p.action, { sala: room });
      }
      const roomsStr = p.rooms.join(' y ');
      return { type: 'success', message: `${p.action === 'encender' ? 'Encendido' : 'Apagado'}: ${roomsStr} en ${p.device.name}`, device: p.device, action: p.action, rooms: p.rooms };
    }

    if (p.action === 'abrir_cochera' || p.action === 'cerrar_cochera') {
      sendCommand(p.device.id, p.action);
      const abierta = p.action === 'abrir_cochera';
      return { type: 'success', message: `${abierta ? 'Abriendo' : 'Cerrando'} cochera de ${p.device.name}`, device: p.device, action: p.action };
    }

    sendCommand(p.device.id, p.action, { state: p.action === 'encender' ? 'on' : 'off' });
    return { type: 'success', message: `${p.action === 'encender' ? 'Encendido' : 'Apagado'}: ${p.device.name}`, device: p.device, action: p.action };
  });
}

export function usePushToTalk(devices, sendCommand) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [results, setResults] = useState(null);
  const recognitionRef = useRef(null);
  const finalPartsRef = useRef([]);
  const interimRef = useRef('');
  const stoppedRef = useRef(false);
  const SpeechRecognition = getSpeechRecognition();
  const isSupported = !!SpeechRecognition;

  const finalize = useCallback(() => {
    setIsListening(false);
    recognitionRef.current = null;
    const finalText = [...finalPartsRef.current, interimRef.current].join(' ');
    if (!finalText || finalText.trim().length === 0) {
      setResults([{ type: 'error', message: 'No escuché nada, intenta de nuevo' }]);
      return;
    }
    const parsed = parseCommands(finalText, devices);
    setResults(buildResultMessages(parsed, devices, sendCommand));
    setTranscript(finalText.trim());
  }, [devices, sendCommand]);

  const beginRecognition = useCallback((resetTranscript) => {
    if (resetTranscript) {
      setResults(null);
      setTranscript('');
      finalPartsRef.current = [];
      interimRef.current = '';
    }

    const rec = new SpeechRecognition();
    rec.lang = 'es-MX';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          finalPartsRef.current.push(res[0].transcript);
        } else {
          interim += res[0].transcript;
        }
      }
      interimRef.current = interim;
      const combined = [...finalPartsRef.current, interim].join(' ');
      setTranscript(combined.trim());
    };

    rec.onend = () => {
      recognitionRef.current = null;
      if (!stoppedRef.current) {
        beginRecognition(false);
        return;
      }
      finalize();
    };

    rec.onerror = (e) => {
      if (e.error === 'aborted' || e.error === 'no-speech') return;
      stoppedRef.current = true;
      try { rec.stop(); } catch {}
    };

    try {
      rec.start();
    } catch {
      stoppedRef.current = true;
      finalize();
      return;
    }
    recognitionRef.current = rec;
    setIsListening(true);
  }, [finalize]);

  const startListening = useCallback(() => {
    if (!isSupported || recognitionRef.current) return;
    stoppedRef.current = false;
    beginRecognition(true);
  }, [isSupported, beginRecognition]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    stoppedRef.current = true;
    try { recognitionRef.current.stop(); } catch {}
  }, []);

  const clearResults = useCallback(() => {
    setResults(null);
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    results,
    isSupported,
    startListening,
    stopListening,
    clearResults,
  };
}
