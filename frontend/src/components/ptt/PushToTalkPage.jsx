'use client';

import { useDevices } from '../../hooks/useDevices';
import { usePushToTalk } from '../../hooks/usePushToTalk';
import { Mic, Square, CheckCircle, XCircle, Lightbulb } from 'lucide-react';

const S = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '60vh',
    gap: 'var(--space-6)',
  },
  pttWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pttButton: (active, supported) => ({
    position: 'relative',
    width: 200,
    height: 200,
    borderRadius: '50%',
    background: active ? 'var(--accent)' : 'var(--bg-primary)',
    border: `6px solid ${active ? 'var(--color-red)' : 'var(--color-gray-200)'}`,
    color: active ? 'white' : 'var(--text-secondary)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-3)',
    cursor: supported ? 'pointer' : 'not-allowed',
    transition: 'all var(--transition-spring)',
    opacity: supported ? 1 : 0.5,
    boxShadow: active ? '0 12px 32px rgba(53,120,229,0.4)' : 'var(--shadow-md)',
    transform: active ? 'scale(0.92)' : 'scale(1)',
    overflow: 'visible',
    zIndex: 2,
  }),
  ripple: {
    position: 'absolute',
    inset: -30,
    borderRadius: '50%',
    border: '4px solid var(--accent)',
    animation: 'ripple 1.2s ease-out infinite',
    pointerEvents: 'none',
    zIndex: 1,
  },
  ripple2: {
    position: 'absolute',
    inset: -50,
    borderRadius: '50%',
    border: '3px solid var(--accent)',
    animation: 'ripple 1.8s ease-out infinite',
    animationDelay: '0.4s',
    pointerEvents: 'none',
    zIndex: 1,
  },
  transcript: {
    padding: 'var(--space-3) var(--space-5)',
    background: 'var(--color-red-bg)',
    borderRadius: 'var(--radius-lg)',
    fontSize: 'var(--text-lg)',
    fontWeight: '500',
    color: 'var(--accent)',
    minHeight: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    maxWidth: 400,
    width: '100%',
  },
  resultCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-4) var(--space-5)',
    borderRadius: 'var(--radius-lg)',
    fontSize: 'var(--text-base)',
    fontWeight: '500',
    minWidth: 280,
  },
  statusText: {
    fontSize: 'var(--text-lg)',
    fontWeight: 'var(--weight-semibold)',
    color: 'var(--text-primary)',
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
    textAlign: 'center',
    maxWidth: 280,
  },
  deviceList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-2)',
    justifyContent: 'center',
    maxWidth: 400,
  },
  deviceChip: (online) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: 'var(--space-1) var(--space-3)',
    borderRadius: 'var(--radius-full)',
    background: 'var(--color-gray-100)',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-secondary)',
    opacity: online ? 1 : 0.5,
  }),
};

export default function PushToTalkPage() {
  const { devices, sendCommand } = useDevices();
  const { isListening, transcript, results, isSupported, startListening, stopListening } = usePushToTalk(devices, sendCommand);

  const onlineDevices = devices.filter(d => d.is_online);

  if (!isSupported) {
    return (
      <div style={S.container} className="animate-fade">
        <div style={{ ...S.pttButton(false, false) }}>
          <Mic size={48} strokeWidth={2} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>PTT</span>
        </div>
        <div style={S.statusText}>No compatible</div>
        <div style={S.instructionText}>
          Tu navegador no soporta reconocimiento de voz. Usa Chrome en Android o desktop.
        </div>
      </div>
    );
  }

  return (
    <div style={S.container} className="animate-fade">
      <div style={S.pttWrapper}>
        {isListening && <div style={S.ripple} />}
        {isListening && <div style={S.ripple2} />}
        <button
          style={S.pttButton(isListening, true)}
          onMouseDown={startListening}
          onMouseUp={stopListening}
          onMouseLeave={stopListening}
          onTouchStart={(e) => { e.preventDefault(); startListening(); }}
          onTouchEnd={(e) => { e.preventDefault(); stopListening(); }}
        >
          {isListening ? (
            <>
              <Square size={48} strokeWidth={2} fill="currentColor" />
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>ESCUCHANDO</span>
            </>
          ) : (
            <>
              <Mic size={48} strokeWidth={2} />
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>PTT</span>
            </>
          )}
        </button>
      </div>

      {transcript && (
        <div style={S.transcript}>{transcript}</div>
      )}

      {results && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: '100%', maxWidth: 400 }}>
          {results.map((r, i) => (
            <div key={i} style={{
              ...S.resultCard,
              background: r.type === 'success' ? 'rgba(30, 200, 100, 0.1)' : 'rgba(228, 30, 63, 0.08)',
              color: r.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
            }}>
              {r.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
              <span>{r.message}</span>
            </div>
          ))}
        </div>
      )}

      {!isListening && !transcript && (
        <>
          <div style={S.statusText}>Listo para comandos de voz</div>
          <div style={S.instructionText}>
            Mantén presionado para hablar. Ej: &ldquo;Enciende cocina&rdquo;, &ldquo;Apaga cocina y cuarto&rdquo;, &ldquo;Prende todas las luces&rdquo;
          </div>
        </>
      )}

      {onlineDevices.length > 0 && !isListening && !transcript && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)', fontWeight: '600', textTransform: 'uppercase' }}>
            Dispositivos disponibles
          </div>
          <div style={S.deviceList}>
            {devices.map(d => (
              <div key={d.id} style={S.deviceChip(d.is_online)}>
                <Lightbulb size={12} />
                {d.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
