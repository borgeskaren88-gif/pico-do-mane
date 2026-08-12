'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, LogoMark, pageBg } from './ui';
import BotaoAtualizar from './BotaoAtualizar';
import PullToRefresh from './PullToRefresh';
import Comandas from './Comandas';
import Caixa from './Caixa';

// Acesso do garçom (linha de frente): as comandas e o caixa do turno. Sem o
// financeiro do bar, sem relatório — só o que precisa pra atender e bater o caixa.
export default function Garcom() {
  const router = useRouter();
  const [aba, setAba] = useState('comandas'); // 'comandas' | 'caixa'

  const [tema, setTema] = useState('escuro');
  useEffect(() => { setTema(document.documentElement.getAttribute('data-theme') === 'claro' ? 'claro' : 'escuro'); }, []);
  const trocarTema = () => {
    const novo = tema === 'claro' ? 'escuro' : 'claro';
    setTema(novo);
    document.documentElement.setAttribute('data-theme', novo);
    try { localStorage.setItem('picoos-tema', novo); } catch { /* ignora */ }
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', novo === 'claro' ? '#F6F9FD' : '#0A1220');
  };

  const sair = async () => { await fetch('/api/logout', { method: 'POST' }); router.refresh(); };

  return (
    <div style={{ minHeight: '100vh', background: pageBg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <PullToRefresh />
      <div style={{ padding: 'calc(18px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) 12px calc(16px + env(safe-area-inset-left))', borderBottom: `1px solid ${C.hair}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LogoMark size={40} radius={11} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '.02em', lineHeight: 1 }}>PicoOS</div>
              <div style={{ fontSize: 12, color: C.accent, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: 3, fontWeight: 600 }}>Central de Operações</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <BotaoAtualizar />
            <button onClick={trocarTema} title={tema === 'claro' ? 'Mudar para escuro' : 'Mudar para claro'} aria-label="Trocar tema"
              style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '7px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {tema === 'claro' ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4.2" />
                  <path d="M12 2.5v2.2M12 19.3v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.4 19.6l1.6-1.6M18 6l1.6-1.6" />
                </svg>
              )}
            </button>
            <button onClick={sair} style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Sair</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '18px calc(16px + env(safe-area-inset-right)) calc(60px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))' }}>
        <div style={{ display: 'flex', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: 3, gap: 3, marginBottom: 18 }}>
          {[['caixa', 'Caixa'], ['comandas', 'Comandas']].map(([v, rot]) => (
            <button key={v} onClick={() => setAba(v)} style={{
              flex: 1, border: 'none', cursor: 'pointer', borderRadius: 9, padding: '9px 8px', fontSize: 14, fontWeight: 700,
              background: aba === v ? C.accent : 'transparent', color: aba === v ? '#06101F' : C.muted,
            }}>{rot}</button>
          ))}
        </div>
        {aba === 'comandas' ? <Comandas papel="garcom" /> : <Caixa />}
      </div>
    </div>
  );
}
