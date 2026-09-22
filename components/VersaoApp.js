'use client';
import React, { useEffect, useState } from 'react';
import { C } from './ui';
import { VERSAO_BUILD, publicadaDaResposta } from '../lib/versao';

// Mostra qual versão do PicoOS está rodando AQUI, neste aparelho — e avisa,
// em letra grande e clicável, quando ela é mais velha que a publicada.
//
// Antes isto mostrava a versão do SERVIDOR. Num aparelho parado numa versão
// antiga (o notebook que fica dias sem fechar) o rodapé mostrava a versão nova
// e ela não tinha como desconfiar: o app dizia um número e rodava outro. Aí um
// aviso já corrigido continuava aparecendo na tela dela, e nenhum de nós dois
// conseguia explicar o porquê.
export default function VersaoApp() {
  const [publicada, setPublicada] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch('/api/versao', { cache: 'no-store' });
        const j = await r.json();
        const p = publicadaDaResposta(j);
        if (vivo && p) setPublicada(p);
      } catch { /* sem internet: não mostra nada */ }
    })();
    return () => { vivo = false; };
  }, []);

  const rodando = VERSAO_BUILD;
  // Só dá pra afirmar que está velha quando se conhece os DOIS lados.
  const velha = !!(rodando && publicada && publicada !== rodando);

  if (!rodando && !publicada) return null;

  if (velha) {
    return (
      <div style={{ padding: '0 12px 10px' }}>
        <button
          onClick={() => window.location.reload()}
          style={{
            width: '100%', background: C.panel2, border: `1px solid ${C.amber}`, color: C.text,
            borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontSize: 12.5,
            fontWeight: 700, lineHeight: 1.45, textAlign: 'center',
          }}
        >
          Saiu versão nova — toca aqui pra atualizar
          <span style={{ display: 'block', fontSize: 10.5, fontWeight: 500, color: C.muted, letterSpacing: '.04em', marginTop: 3 }}>
            aqui roda a {rodando} · publicada a {publicada}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ fontSize: 10, color: C.faint, textAlign: 'center', padding: '0 12px 10px', letterSpacing: '.04em' }}>
      versão {rodando || publicada}
    </div>
  );
}
