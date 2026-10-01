'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, Card, Field, inputStyle, LogoMark, pageBg } from './ui';

// Os nomes genéricos. Os de verdade vêm da configuração do negócio (cada um
// põe o seu) — e, se a consulta falhar, estes aqui garantem que ninguém fica
// sem conseguir entrar por causa de um rótulo.
const PAPEIS_PADRAO = [['dona', 'Dona'], ['cozinha', 'Cozinha'], ['garcom', 'Atendimento'], ['reservas', 'Reservas']];

export default function LoginForm() {
  const router = useRouter();
  const [papel, setPapel] = useState('dona');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [papeis, setPapeis] = useState(PAPEIS_PADRAO);
  const [negocio, setNegocio] = useState('');
  // Instalação de muitos negócios: aí a pessoa diz de qual é. Numa instalação
  // de um cliente só (como a do Pico do Mané) este campo nem aparece.
  const [multi, setMulti] = useState(false);
  const [codigo, setCodigo] = useState('');
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch('/api/negocio', { cache: 'no-store' });
        const j = await r.json();
        if (!vivo || !j) return;
        if (Array.isArray(j.papeis) && j.papeis.length) setPapeis(j.papeis);
        if (j.nome) setNegocio(j.nome);
        if (j.multi) {
          setMulti(true);
          // Digitado uma vez, lembrado neste aparelho. Quem trabalha no lugar
          // não devia ter que saber o código de cor todo dia.
          try { setCodigo(localStorage.getItem('picoos-codigo') || ''); } catch { /* ignora */ }
        }
      } catch { /* fica com os nomes genéricos */ }
    })();
    return () => { vivo = false; };
  }, []);

  const entrar = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      // Só o celular/tablet continua logado. Notebook/PC pede a senha ao fechar
      // — MESMO com o app instalado (o app no notebook também é "standalone",
      // então a diferença tem que ser pelo aparelho, não pelo modo instalado).
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      const lembrar = /Android|iPhone|iPad|iPod/i.test(ua)
        || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha, papel, lembrar, ...(multi ? { codigo: codigo.trim().toLowerCase() } : {}) }),
      });
      const json = await res.json();
      if (json.ok) {
        // Marca a sessão como ativa nesta janela pra a trava de tela não pedir a
        // senha logo depois do login (ela só trava ao fechar e reabrir).
        try { sessionStorage.setItem('pdm_sessaoAtiva', '1'); } catch { /* ignora */ }
        if (multi) { try { localStorage.setItem('picoos-codigo', codigo.trim().toLowerCase()); } catch { /* ignora */ } }
        router.refresh();
      } else {
        setErro(json.erro || 'Senha incorreta.');
      }
    } catch {
      setErro('Não consegui conectar. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: pageBg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(20px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left))' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, margin: '0 auto 14px' }}><LogoMark size={56} radius={16} /></div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '.02em' }}>PicoOS</div>
          <div style={{ fontSize: 12, color: C.accent, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: 4, fontWeight: 600 }}>Central de Gestão</div>
          {/* O nome do negócio de quem usa, embaixo da marca do produto. */}
          {negocio && <div style={{ fontSize: 14, color: C.muted, marginTop: 8, fontWeight: 700 }}>{negocio}</div>}
        </div>

        <Card>
          <form onSubmit={entrar}>
            {multi && (
              <Field label="Código do negócio">
                <input
                  value={codigo}
                  placeholder="ex: boteco-da-ana"
                  onChange={(e) => { setCodigo(e.target.value); setErro(''); }}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="organization"
                  spellCheck="false"
                  style={inputStyle}
                />
              </Field>
            )}
            <Field label="Quem está entrando?">
              <div style={{ display: 'flex', flexWrap: 'wrap', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 3, gap: 3 }}>
                {papeis.map(([v, rot]) => (
                  <button key={v} type="button" onClick={() => { setPapel(v); setErro(''); }} style={{
                    flex: '1 1 45%', minWidth: 0, border: 'none', cursor: 'pointer', borderRadius: 8, padding: '9px 6px', fontSize: 14, fontWeight: 700,
                    background: papel === v ? C.accent : 'transparent', color: papel === v ? '#06101F' : C.muted,
                  }}>{rot}</button>
                ))}
              </div>
            </Field>
            <Field label="Senha">
              <div style={{ position: 'relative' }}>
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  value={senha}
                  placeholder="••••••••••"
                  onChange={(e) => setSenha(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="current-password"
                  spellCheck="false"
                  autoFocus={!multi || !!codigo}
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button type="button" onClick={() => setMostrarSenha((v) => !v)}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 12, padding: 8 }}>
                  {mostrarSenha ? 'ocultar' : 'ver'}
                </button>
              </div>
            </Field>
            {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 14, marginTop: -6 }}>{erro}</div>}
            <button type="submit" disabled={carregando} style={{ width: '100%', background: C.accent, color: '#06101F', border: 'none', borderRadius: 10, padding: '12px 18px', fontSize: 15, fontWeight: 700, cursor: carregando ? 'default' : 'pointer', opacity: carregando ? 0.7 : 1 }}>
              {carregando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </Card>
        <div style={{ textAlign: 'center', fontSize: 12, color: C.faint, marginTop: 16, lineHeight: 1.5 }}>
          Acesso restrito à gestão do PicoOS.
        </div>
      </div>
    </div>
  );
}
