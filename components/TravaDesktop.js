'use client';
import React, { useEffect, useState } from 'react';
import { C, Card, LogoMark, pageBg, inputStyle } from './ui';

// Trava de tela no COMPUTADOR. O app instalado no notebook mantém a sessão mesmo
// depois de fechar a janela (o cookie não some sozinho), então aqui a gente
// garante o "pediu a senha ao reabrir": usamos o sessionStorage, que o navegador
// LIMPA quando a janela/aba fecha. Recarregar a página (F5) mantém — só fechar e
// reabrir é que trava de novo. No celular/tablet não trava (continua logado).
const CHAVE = 'pdm_sessaoAtiva';

function ehCelular() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export default function TravaDesktop({ children }) {
  const [estado, setEstado] = useState('checando'); // checando | travado | liberado
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    if (ehCelular()) { setEstado('liberado'); return; }
    let ativa = false;
    try { ativa = sessionStorage.getItem(CHAVE) === '1'; } catch { ativa = true; }
    setEstado(ativa ? 'liberado' : 'travado');
  }, []);

  const destravar = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const res = await fetch('/api/verificar-senha', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha }),
      });
      const j = await res.json();
      if (j.ok) {
        try { sessionStorage.setItem(CHAVE, '1'); } catch { /* ignora */ }
        setEstado('liberado');
      } else {
        setErro(j.erro || 'Senha incorreta.');
      }
    } catch {
      setErro('Não consegui conectar. Tente de novo.');
    } finally {
      setCarregando(false);
    }
  };

  if (estado === 'liberado') return children;
  if (estado === 'checando') return null;

  return (
    <div style={{ minHeight: '100vh', background: pageBg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(20px + env(safe-area-inset-top)) 20px calc(20px + env(safe-area-inset-bottom))' }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 52, margin: '0 auto 12px' }}><LogoMark size={52} radius={15} /></div>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '.02em' }}>Tela bloqueada</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Digite a senha para continuar.</div>
        </div>
        <Card>
          <form onSubmit={destravar}>
            <div style={{ position: 'relative' }}>
              <input
                type={mostrar ? 'text' : 'password'}
                value={senha}
                placeholder="Senha"
                onChange={(e) => setSenha(e.target.value)}
                autoCapitalize="none" autoCorrect="off" autoComplete="current-password" spellCheck="false" autoFocus
                style={{ ...inputStyle, paddingRight: 44 }}
              />
              <button type="button" onClick={() => setMostrar((v) => !v)}
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 12, padding: 8 }}>
                {mostrar ? 'ocultar' : 'ver'}
              </button>
            </div>
            {erro && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{erro}</div>}
            <button type="submit" disabled={carregando} style={{ width: '100%', background: C.accent, color: '#06101F', border: 'none', borderRadius: 10, padding: '12px 18px', fontSize: 15, fontWeight: 700, cursor: carregando ? 'default' : 'pointer', opacity: carregando ? 0.7 : 1, marginTop: 14 }}>
              {carregando ? 'Conferindo…' : 'Destravar'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
