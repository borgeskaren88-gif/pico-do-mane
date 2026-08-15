'use client';
import React, { useState, useEffect } from 'react';
import { C, Card, Btn } from './ui';

// Cutuca gentil: aparece nas outras abas quando NINGUÉM está com o ponto aberto,
// lembrando a pessoa de bater a entrada. Não obriga — dá pra dispensar. Some
// sozinho assim que alguém registra a entrada.
export default function LembretePonto({ onIr }) {
  const [temAberto, setTemAberto] = useState(null); // null = carregando; true/false depois
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch('/api/ponto', { cache: 'no-store' });
        const j = await r.json();
        if (vivo && j.ok) setTemAberto((j.registros || []).some((x) => !x.saida));
        else if (vivo) setTemAberto(true); // na dúvida, não incomoda
      } catch { if (vivo) setTemAberto(true); }
    })();
    return () => { vivo = false; };
  }, []);

  if (temAberto !== false || fechado) return null;
  return (
    <Card style={{ marginBottom: 14, borderColor: C.amber, background: C.panel2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.amber }}>Você bateu seu ponto? 👋</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Ninguém registrou entrada ainda. Bata a sua antes de começar.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Btn small onClick={onIr}>Ir pro Ponto</Btn>
          <Btn kind="ghost" small onClick={() => setFechado(true)}>Agora não</Btn>
        </div>
      </div>
    </Card>
  );
}
