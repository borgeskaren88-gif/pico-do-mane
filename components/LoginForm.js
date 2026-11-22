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
  // BAR NOVO: a equipe entra pelo NOME da pessoa (não por cargo). A lista de
  // cargos fica guardada pra voltar se o código for o do bar da casa.
  const [papeisCargo, setPapeisCargo] = useState(null);
  const [porPessoa, setPorPessoa] = useState(false);
  const [nomeEquipe, setNomeEquipe] = useState('');
  useEffect(() => { try { setNomeEquipe(localStorage.getItem('picoos-nome-equipe') || ''); } catch { /* ignora */ } }, []);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch('/api/negocio', { cache: 'no-store' });
        const j = await r.json();
        if (!vivo || !j) return;
        if (Array.isArray(j.papeis) && j.papeis.length) {
          setPapeis(j.papeis);
          setPapeisCargo(j.papeis);
          // Quem entrou por último neste aparelho já vem escolhido — se essa
          // porta ainda existir (um acesso fechado some da lista).
          try {
            const ultimo = localStorage.getItem('picoos-ultimo-papel');
            if (ultimo && j.papeis.some(([v]) => v === ultimo)) setPapel(ultimo);
          } catch { /* ignora */ }
        }
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

  // Digitou o código: pergunta como se entra nesse bar. Um código inventado
  // responde igual a um de verdade — a tela não vira lista de clientes.
  useEffect(() => {
    if (!multi) return undefined;
    const cod = codigo.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(cod)) { setPorPessoa(false); if (papeisCargo) setPapeis(papeisCargo); return undefined; }
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/negocio?codigo=${encodeURIComponent(cod)}`, { cache: 'no-store' });
        const j = await r.json();
        if (!vivo || !j) return;
        if (j.modo === 'pessoas') {
          setPorPessoa(true);
          setPapeis(j.papeis);
          setPapel((p) => {
            if (j.papeis.some(([v]) => v === p)) return p;
            try { const u = localStorage.getItem('picoos-ultimo-papel'); if (u && j.papeis.some(([v]) => v === u)) return u; } catch { /* ignora */ }
            return 'dona';
          });
        } else {
          setPorPessoa(false);
          if (papeisCargo) { setPapeis(papeisCargo); setPapel((p) => (papeisCargo.some(([v]) => v === p) ? p : 'dona')); }
        }
      } catch { /* fica como está */ }
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [codigo, multi, papeisCargo]);

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
        body: JSON.stringify({ senha, papel, lembrar, ...(multi ? { codigo: codigo.trim().toLowerCase() } : {}), ...(papel === 'equipe' ? { nome: nomeEquipe.trim() } : {}) }),
      });
      const json = await res.json();
      if (json.ok) {
        // Marca esta JANELA como a que acabou de entrar.
        //
        // No computador ninguém fica logado: uma janela sem esta marca é
        // sessão herdada de quem estava antes, e o app sai sozinho. Sem marcar
        // aqui, o próprio login cairia nessa regra e devolveria a tela de
        // entrar — laço infinito, e ninguém entraria no notebook.
        try { sessionStorage.setItem('pdm_sessaoAtiva', '1'); } catch { /* ignora */ }
        if (multi) { try { localStorage.setItem('picoos-codigo', codigo.trim().toLowerCase()); } catch { /* ignora */ } }
        try { localStorage.setItem('picoos-ultimo-papel', papel); } catch { /* ignora */ }
        if (papel === 'equipe') { try { localStorage.setItem('picoos-nome-equipe', nomeEquipe.trim()); } catch { /* ignora */ } }
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
            {/* UMA SETINHA, NÃO UM BOTÃO POR LOGIN.
                "Tá ficando muito login, aí fica poluído." Com Dona, Cozinha,
                Atendimento, Reservas, Gerente e Extra a grade virou um mural.
                Agora é uma caixa só, que abre a lista ao tocar — no celular
                vira a roleta do próprio aparelho. E o aparelho lembra quem
                entrou da última vez: o notebook da Sarah já abre em "Gerente". */}
            <Field label="Quem está entrando?">
              <div style={{ position: 'relative' }}>
                <select data-quem value={papel} onChange={(e) => { setPapel(e.target.value); setErro(''); }}
                  aria-label="Quem está entrando?"
                  style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', paddingRight: 40, fontWeight: 700, cursor: 'pointer' }}>
                  {papeis.map(([v, rot]) => <option key={v} value={v} style={{ background: C.panel, color: C.text }}>{rot}</option>)}
                </select>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: C.muted, pointerEvents: 'none' }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </Field>
            {porPessoa && papel === 'equipe' && (
              <Field label="Teu nome">
                <input data-nome-equipe value={nomeEquipe} placeholder="o nome que a dona cadastrou"
                  onChange={(e) => { setNomeEquipe(e.target.value); setErro(''); }}
                  autoCapitalize="words" autoCorrect="off" autoComplete="username" spellCheck="false" style={inputStyle} />
              </Field>
            )}
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
        {/* No app de muitos: quem chegou aqui sem conta (pelo QR code, por
            exemplo) acha o caminho do cadastro, em vez de ir embora. */}
        {multi && (
          <div style={{ textAlign: 'center', fontSize: 13, color: C.muted, marginTop: 10 }}>
            Ainda não usa o PicoOS? <a href="/criar" data-link-criar style={{ color: C.accent, fontWeight: 700 }}>Criar meu negócio grátis</a>
          </div>
        )}
      </div>
    </div>
  );
}
