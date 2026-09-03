'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, Icone, LogoMark, pageBg } from './ui';
import Financas from './Financas';
import Habitos from './Habitos';
import ListaCompras from './ListaCompras';

const ABAS = [
  ['financas', 'Finanças', 'wallet'],
  ['habitos', 'Hábitos', 'flame'],
  ['lista', 'Lista', 'cart'],
];

export default function Painel({ usuario }) {
  const router = useRouter();
  const [aba, setAba] = useState('financas');
  const [tema, setTema] = useState('escuro');

  useEffect(() => {
    try {
      const t = localStorage.getItem('financas-tema');
      if (t === 'claro' || t === 'escuro') setTema(t);
    } catch {}
    try {
      const a = new URLSearchParams(window.location.search).get('aba');
      if (['financas', 'habitos', 'lista'].includes(a)) setAba(a);
    } catch {}
  }, []);
  const trocarTema = () => {
    const novo = tema === 'escuro' ? 'claro' : 'escuro';
    setTema(novo);
    try {
      localStorage.setItem('financas-tema', novo);
      document.documentElement.setAttribute('data-theme', novo);
    } catch {}
  };

  const sair = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.refresh();
  };

  const iconBtn = {
    width: 38, height: 38, borderRadius: 10, border: `1px solid ${C.line}`, background: C.panel2,
    color: C.text, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  };
  const tituloAba = ABAS.find(([id]) => id === aba)?.[1] || '';

  return (
    <div style={{ minHeight: '100vh', background: pageBg, color: C.text, fontFamily: "'Urbanist', system-ui, -apple-system, sans-serif" }}>
      {/* Barra do topo */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: C.barBg, backdropFilter: 'blur(10px)', borderBottom: `1px solid ${C.hair}`, padding: 'calc(10px + env(safe-area-inset-top)) 16px 10px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoMark size={30} radius={9} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.1 }}>Nossa Casa</div>
            <div style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Olá, {usuario.nome} · {tituloAba}</div>
          </div>
          <button onClick={trocarTema} title="Trocar tema" style={iconBtn}><Icone name={tema === 'escuro' ? 'sun' : 'moon'} size={18} /></button>
          <button onClick={sair} style={{ ...iconBtn, width: 'auto', padding: '0 12px', fontSize: 13, fontWeight: 600 }}>Sair</button>
        </div>
      </div>

      {/* Conteúdo da aba ativa */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px calc(96px + env(safe-area-inset-bottom))' }}>
        {aba === 'financas' && <Financas usuario={usuario} tema={tema} />}
        {aba === 'habitos' && <Habitos usuario={usuario} />}
        {aba === 'lista' && <ListaCompras usuario={usuario} />}
      </div>

      {/* Barra de abas (embaixo) */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, background: C.barBg, backdropFilter: 'blur(12px)', borderTop: `1px solid ${C.hair}`, padding: '8px 12px calc(8px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', gap: 6 }}>
          {ABAS.map(([id, rot, ico]) => {
            const ativo = aba === id;
            return (
              <button key={id} onClick={() => { setAba(id); if (typeof window !== 'undefined') window.scrollTo({ top: 0 }); }}
                style={{ flex: 1, border: 'none', cursor: 'pointer', borderRadius: 12, padding: '8px 6px', background: ativo ? C.accent : 'transparent', color: ativo ? C.onAccent : C.muted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <Icone name={ico} size={21} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>{rot}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
