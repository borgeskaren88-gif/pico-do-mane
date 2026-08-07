'use client';
import React, { useState } from 'react';
import { C } from './ui';

// Botão de atualizar: recarrega o app do zero, puxando os dados mais recentes
// (inclusive o que a cozinha salvou) e a versão mais nova publicada.
export default function BotaoAtualizar() {
  const [girando, setGirando] = useState(false);
  const atualizar = () => {
    setGirando(true);
    setTimeout(() => window.location.reload(), 120);
  };
  return (
    <button onClick={atualizar} title="Atualizar" aria-label="Atualizar"
      style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '7px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        style={{ animation: girando ? 'pdm-spin .7s linear infinite' : 'none' }}>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}
