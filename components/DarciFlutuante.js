'use client';
import React, { useState, useEffect } from 'react';
import { C } from './ui';
import Darci from './Darci';
import OrbDarci from './OrbDarci';

// Botão flutuante da Darci: fica sempre no canto, em qualquer tela do PicoOS.
// Ao tocar, ela sobe numa gaveta por cima da tela — a dona pergunta e volta pro
// que estava fazendo, sem perder de vista. A aba "Darci" continua existindo pra
// quem quiser a tela inteira.
export default function DarciFlutuante({ onAbrir, ...props }) {
  const [aberto, setAberto] = useState(false);
  // Ao abrir, pede pro Dashboard atualizar vendas/estoque — assim ela responde
  // com o número de agora mesmo vindo de uma tela que não carrega esses dados.
  const abrir = () => { setAberto(true); try { onAbrir && onAbrir(); } catch { /* ignora */ } };

  useEffect(() => {
    if (!aberto) return;
    const esc = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('keydown', esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // trava o fundo enquanto a gaveta está aberta
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = antes; };
  }, [aberto]);

  return (
    <>
      <style>{`
        @keyframes darci-sobe { from { transform: translateY(18px); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes darci-halo { 0%,100% { box-shadow: 0 8px 26px rgba(0,0,0,.30), 0 0 0 0 color-mix(in srgb, ${C.accent} 40%, transparent) }
                                 50%     { box-shadow: 0 8px 26px rgba(0,0,0,.30), 0 0 0 9px color-mix(in srgb, ${C.accent} 0%, transparent) } }
        .darci-fab { animation: darci-halo 3.2s ease-out infinite; }
        .darci-gaveta { animation: darci-sobe .22s ease both; }
      `}</style>

      {!aberto && (
        <button
          className="darci-fab"
          onClick={abrir}
          aria-label="Falar com a Darci"
          title="Falar com a Darci"
          style={{
            position: 'fixed', zIndex: 60,
            right: 'calc(16px + env(safe-area-inset-right))',
            bottom: 'calc(20px + env(safe-area-inset-bottom))',
            width: 64, height: 64, borderRadius: 999, padding: 0, overflow: 'hidden',
            border: `1px solid ${C.line}`, background: C.panel, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}
        >
          <OrbDarci ativo={false} tamanho={62} />
        </button>
      )}

      {aberto && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setAberto(false); }}
          role="dialog" aria-modal="true" aria-label="Darci"
          style={{
            position: 'fixed', inset: 0, zIndex: 70,
            background: 'rgba(3, 8, 18, 0.55)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div className="darci-gaveta" style={{
            position: 'relative', width: '100%', maxWidth: 720, maxHeight: '92vh', overflowY: 'auto',
            background: C.ink, border: `1px solid ${C.line}`, borderBottom: 'none',
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
            padding: '8px 16px calc(20px + env(safe-area-inset-bottom))',
          }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 3, background: C.ink, paddingTop: 4, paddingBottom: 6 }}>
              <div style={{ width: 42, height: 4, borderRadius: 999, background: C.line, margin: '0 auto' }} />
              <button onClick={() => setAberto(false)} aria-label="Fechar"
                style={{ position: 'absolute', right: 0, top: 0, background: 'none', border: 'none', color: C.muted, fontSize: 22, lineHeight: 1, padding: '2px 6px', cursor: 'pointer' }}>×</button>
            </div>
            <Darci {...props} />
          </div>
        </div>
      )}
    </>
  );
}
