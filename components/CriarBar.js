'use client';
import React, { useEffect, useState } from 'react';
import { C, Card, Btn, Field, TextInput, LogoMark, pageBg } from './ui';

// "CRIAR MEU BAR" — o cadastro que a pessoa faz sozinha, do celular, depois de
// ler o QR code. Cinco campos, um botão, e ela sai daqui dentro do app dela.
//
// Depois de criar, a tela mostra o CÓDIGO do bar (é o que ela e a equipe
// digitam pra entrar) e como pôr o app na tela do celular.

const reais = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CriarBar() {
  const [cfg, setCfg] = useState(null);
  const [f, setF] = useState({ nomeBar: '', cidade: '', dona: '', whatsapp: '', email: '', senha: '', senha2: '', site: '' });
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState('');
  const [indo, setIndo] = useState(false);
  const [pronto, setPronto] = useState(null);
  const [iphone, setIphone] = useState(false);

  useEffect(() => {
    fetch('/api/cadastro', { cache: 'no-store' }).then((r) => r.json()).then((j) => setCfg(j && j.ok ? j : { aberto: false })).catch(() => setCfg({ aberto: true, preco: 99.9, testeDias: 14 }));
    setIphone(/iPhone|iPad|iPod/i.test(navigator.userAgent || ''));
  }, []);

  const muda = (k) => (v) => { setF((x) => ({ ...x, [k]: v })); setErro(''); };

  const criar = async (e) => {
    e.preventDefault();
    if (f.senha !== f.senha2) { setErro('As duas senhas não estão iguais.'); return; }
    setIndo(true); setErro('');
    try {
      const r = await fetch('/api/cadastro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, senha2: undefined, aceite }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setErro(j.erro || 'Não deu certo. Tenta de novo.'); return; }
      try { localStorage.setItem('picoos-codigo', j.codigo); localStorage.setItem('picoos-ultimo-papel', 'dona'); } catch { /* ignora */ }
      setPronto(j);
      window.scrollTo(0, 0);
    } catch { setErro('Sem conexão. Tenta de novo.'); } finally { setIndo(false); }
  };

  const topo = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 22 }}>
      <LogoMark size={36} radius={10} />
      <div>
        <div style={{ fontSize: 18, fontWeight: 900 }}>PicoOS</div>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.13em', color: C.accent }}>CRIAR MEU BAR</div>
      </div>
    </div>
  );

  const casca = (filho) => (
    <main style={{ minHeight: '100dvh', background: pageBg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif', padding: '28px 16px 60px' }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>{topo}{filho}</div>
    </main>
  );

  if (pronto) {
    return casca(
      <div data-cadastro-pronto>
        <Card style={{ marginBottom: 14, borderColor: C.accent }}>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>Pronto, o {pronto.nome} já está no PicoOS!</div>
          <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
            Tens <b>{pronto.testeDias} dias grátis</b> pra usar tudo. Guarda o código do teu bar. É ele que tu e a tua equipe digitam pra entrar:
          </div>
          <div data-codigo style={{ fontSize: 26, fontWeight: 900, textAlign: 'center', margin: '16px 0 6px', padding: '12px', border: `2px dashed ${C.accent}`, borderRadius: 12, letterSpacing: '.02em' }}>{pronto.codigo}</div>
          <div style={{ fontSize: 12.5, color: C.faint, textAlign: 'center', lineHeight: 1.5 }}>
            A tua equipe tu cadastras depois, em <b>Configurações → Acessos</b>: até 5 pessoas, cada uma com nome e senha.
          </div>
        </Card>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Põe o app na tela do celular</div>
          <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.7 }}>
            {iphone ? (
              <>No <b>Safari</b>, toca no botão de compartilhar (o quadradinho com a seta pra cima) e depois em <b>&quot;Adicionar à Tela de Início&quot;</b>.</>
            ) : (
              <>No <b>Chrome</b>, toca nos três pontinhos lá em cima e depois em <b>&quot;Instalar aplicativo&quot;</b> (ou &quot;Adicionar à tela inicial&quot;).</>
            )}
            <br />Vai aparecer o ícone do PicoOS, igual a um aplicativo.
          </div>
        </Card>
        <Btn onClick={() => { window.location.href = '/'; }} style={{ width: '100%' }}>Entrar no meu PicoOS</Btn>
      </div>,
    );
  }

  if (cfg && cfg.aberto === false) {
    return casca(
      <Card>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>O cadastro está fechado agora</div>
        <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 14 }}>Fala com a gente que a gente cria o teu bar.</div>
        <Btn href="https://wa.me/5548988784016?text=Oi!%20Quero%20usar%20o%20PicoOS." target="_blank" rel="noopener noreferrer">Falar no WhatsApp</Btn>
      </Card>,
    );
  }

  const preco = cfg ? cfg.preco : 99.9;
  const dias = cfg ? cfg.testeDias : 14;
  return casca(
    <>
      <div style={{ fontSize: 'clamp(22px, 6vw, 28px)', fontWeight: 900, lineHeight: 1.2, marginBottom: 8 }}>{dias} dias grátis, sem cartão</div>
      <div style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.6, marginBottom: 18 }}>
        Cria o teu bar em um minuto. Depois do teste, <b>{reais(preco)} por mês</b>, e cancelas quando quiseres.
      </div>
      <Card>
        <form onSubmit={criar} data-form-cadastro>
          <Field label="Nome do bar"><TextInput value={f.nomeBar} onChange={muda('nomeBar')} placeholder="ex: Boteco da Ana" /></Field>
          <Field label="Cidade"><TextInput value={f.cidade} onChange={muda('cidade')} placeholder="ex: Florianópolis" /></Field>
          <Field label="Teu nome"><TextInput value={f.dona} onChange={muda('dona')} placeholder="como queres ser chamado(a) no app" /></Field>
          <Field label="WhatsApp (com DDD)"><TextInput value={f.whatsapp} onChange={muda('whatsapp')} inputMode="tel" placeholder="48 99999-9999" /></Field>
          <Field label="E-mail (opcional, pra receber a cobrança)"><TextInput value={f.email} onChange={muda('email')} type="email" placeholder="voce@email.com" /></Field>
          <Field label="Cria uma senha (mínimo 6)"><TextInput value={f.senha} onChange={muda('senha')} type="password" /></Field>
          <Field label="Repete a senha"><TextInput value={f.senha2} onChange={muda('senha2')} type="password" /></Field>
          {/* Campo-armadilha: gente não vê, robô preenche. */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
            <label>Site<input tabIndex={-1} autoComplete="off" value={f.site} onChange={(e) => muda('site')(e.target.value)} name="site" /></label>
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, color: C.muted, lineHeight: 1.5, marginBottom: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={aceite} onChange={(e) => { setAceite(e.target.checked); setErro(''); }} style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }} data-aceite />
            <span>Entendi: são {dias} dias grátis e, se eu quiser continuar, pago {reais(preco)} por mês. Se não pagar, o app pausa, mas meus dados ficam guardados.</span>
          </label>
          {erro && <div data-erro-cadastro style={{ color: C.red, fontSize: 13.5, marginBottom: 12, lineHeight: 1.5 }}>{erro}</div>}
          <Btn type="submit" disabled={indo} style={{ width: '100%' }}>{indo ? 'Criando…' : 'Criar meu bar'}</Btn>
        </form>
      </Card>
      <div style={{ fontSize: 13, color: C.faint, textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
        Já tem conta? <a href="/" style={{ color: C.accent, fontWeight: 700 }}>Entrar</a>
      </div>
    </>,
  );
}
