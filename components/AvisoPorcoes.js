'use client';
import React, { useState, useEffect } from 'react';
import { C } from './ui';
import { painelDasPorcoes } from '../lib/porcoes';

// O aviso das porções na entrada da cozinha.
//
// A aba Porções só avisa quem abre a aba Porções — e quem está no meio do
// serviço não abre aba nenhuma. O pedido era "pra ela ter ciência de quando
// precisa separar", e ciência não se pede: se entrega na cara, antes de
// qualquer coisa.
//
// Então o que falta aparece logo na entrada, com a frase do caso mais urgente,
// e some sozinho quando não falta nada. Aviso que aparece sempre vira paisagem;
// este só existe quando tem o que fazer.
export default function AvisoPorcoes({ onIr }) {
  const [aFazer, setAFazer] = useState([]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch('/api/estoque', { cache: 'no-store' });
        const j = await r.json();
        if (vivo && j && j.ok) setAFazer(painelDasPorcoes(j.itens || []).aFazer);
      } catch { /* sem internet: fica quieto */ }
    })();
    return () => { vivo = false; };
  }, []);

  if (!aFazer.length) return null;

  // O pior vem na frente porque a lista já veio na ordem da urgência.
  const pior = aFazer[0];
  const cor = pior.nivel === 'atencao' ? C.amber : C.red;
  const resto = aFazer.length - 1;

  return (
    <button
      onClick={onIr}
      style={{
        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
        background: C.panel, border: `1px solid ${cor}`, borderRadius: 12,
        padding: '11px 13px', marginBottom: 14, color: C.text,
      }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 800, color: cor, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>
        Porções · {pior.nome}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.45 }}>{pior.recado}</div>
      <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4 }}>
        {resto > 0 ? `e mais ${resto} produto${resto > 1 ? 's' : ''} — toca pra ver` : 'toca pra registrar'}
      </div>
    </button>
  );
}
