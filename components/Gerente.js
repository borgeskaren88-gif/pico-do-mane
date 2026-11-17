'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, LogoMark, pageBg } from './ui';
import BotaoAtualizar from './BotaoAtualizar';
import PullToRefresh from './PullToRefresh';
import Garcom from './Garcom';
import Cozinha from './Cozinha';
import Gerencia, { InicioGerente } from './Gerencia';
import { sairDeVez } from '../lib/pushClient';

// A TELA DA GERENTE.
//
// "Ela vai aprender todas as áreas, pra quando precisar salvar ela vai saber."
//
// Por isso não é uma tela nova com cópias das outras: são AS MESMAS telas da
// equipe — a do atendimento e a da cozinha, embutidas — mais a aba Gerência,
// com o que é só dela. O que mudar na tela do atendimento muda aqui junto, e
// ela aprende exatamente o que a equipe usa.
// "Lembra que ela tem que ter a Central de Operações também, pra atender como
// garçom." É a tela do atendimento, inteira, com o nome que a equipe conhece.
const AREAS = [['inicio', 'Início'], ['salao', 'Central de Operações'], ['cozinha', 'Cozinha'], ['gerencia', 'Gerência']];

export default function Gerente() {
  const router = useRouter();
  const [area, setArea] = useState('inicio');
  const sair = async () => { await sairDeVez(); router.refresh(); };

  return (
    <div style={{ minHeight: '100vh', background: pageBg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <PullToRefresh />
      <div style={{ padding: 'calc(18px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) 12px calc(16px + env(safe-area-inset-left))', borderBottom: `1px solid ${C.hair}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LogoMark size={40} radius={11} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '.02em', lineHeight: 1 }}>PicoOS</div>
              <div style={{ fontSize: 12, color: C.accent, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: 3, fontWeight: 600 }}>Gerência</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <BotaoAtualizar />
            <button onClick={sair} style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Sair</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '18px calc(16px + env(safe-area-inset-right)) calc(60px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))' }}>
        <div role="tablist" aria-label="Áreas" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {AREAS.map(([v, rot]) => (
            <button key={v} role="tab" aria-selected={area === v} data-area={v} onClick={() => setArea(v)} style={{
              border: `1px solid ${area === v ? C.accent : C.line}`, cursor: 'pointer', borderRadius: 12, padding: '11px 8px', fontSize: 14.5, fontWeight: 900,
              background: area === v ? C.accent : 'transparent', color: area === v ? '#06101F' : C.text,
            }}>{rot}</button>
          ))}
        </div>
        {area === 'inicio' && <InicioGerente onIr={setArea} />}
        {area === 'salao' && <Garcom embutido />}
        {area === 'cozinha' && <Cozinha embutido />}
        {area === 'gerencia' && <Gerencia />}
      </div>
    </div>
  );
}
