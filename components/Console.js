'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { C, Card, Btn, Field, TextInput, inputStyle, LogoMark, pageBg } from './ui';

// A SALA DE MÁQUINAS.
//
// Vender um sistema era: criar projeto no Supabase, rodar SQL, criar projeto na
// Vercel, pôr quatro configurações, publicar, conferir. Uns 15 minutos de
// atenção, e um lugar novo pra errar a cada cliente.
//
// Aqui é um formulário. Código, nome, senha, criar. O resto já existe.

const dataBR = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

// Quanto tempo faz que o negócio mexeu no app. É o sinal de que alguém parou de
// usar antes de avisar que vai sair.
function faz(iso) {
  if (!iso) return 'nunca mexeu';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (!Number.isFinite(dias)) return '—';
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 30) return `faz ${dias} dias`;
  return `faz ${Math.floor(dias / 30)} ${Math.floor(dias / 30) === 1 ? 'mês' : 'meses'}`;
}

export default function Console() {
  const [dentro, setDentro] = useState(false);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [negocios, setNegocios] = useState([]);
  const [msg, setMsg] = useState('');
  const [novo, setNovo] = useState({ codigo: '', nome: '', senha: '' });
  const [criando, setCriando] = useState(false);
  const [recemCriado, setRecemCriado] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/negocios', { cache: 'no-store' });
      if (r.status === 401) { setDentro(false); return; }
      const j = await r.json();
      if (j.ok) { setNegocios(j.negocios || []); setDentro(true); }
    } catch { setErro('Sem conexão.'); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const entrar = async (e) => {
    e.preventDefault();
    setErro('');
    const r = await fetch('/api/admin/entrar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.ok) { setSenha(''); carregar(); } else setErro(j.erro || 'Senha incorreta.');
  };

  const sair = async () => {
    await fetch('/api/admin/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sair: true }) });
    setDentro(false); setNegocios([]);
  };

  const agir = async (corpo) => {
    setMsg('');
    const r = await fetch('/api/admin/negocios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) { setMsg(j.erro || 'Não deu certo.'); return null; }
    await carregar();
    return j;
  };

  const criar = async (e) => {
    e.preventDefault();
    setCriando(true);
    const j = await agir({ acao: 'criar', ...novo, codigo: novo.codigo.trim().toLowerCase() });
    setCriando(false);
    if (j) {
      // A senha aparece UMA vez, aqui, pra ela copiar e mandar. Não fica
      // guardada em lugar nenhum legível: no banco só existe o embaralhado.
      setRecemCriado({ codigo: novo.codigo.trim().toLowerCase(), nome: novo.nome, senha: novo.senha });
      setNovo({ codigo: '', nome: '', senha: '' });
    }
  };

  if (!dentro) {
    return (
      <div style={{ minHeight: '100vh', background: pageBg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 48, margin: '0 auto 12px' }}><LogoMark size={48} radius={14} /></div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>PicoOS</div>
            <div style={{ fontSize: 11.5, color: C.accent, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: 4, fontWeight: 600 }}>Sala de máquinas</div>
          </div>
          <Card>
            <form onSubmit={entrar}>
              <Field label="Senha">
                <input type="password" value={senha} onChange={(ev) => { setSenha(ev.target.value); setErro(''); }}
                  autoFocus autoCapitalize="none" autoCorrect="off" spellCheck="false" style={inputStyle} />
              </Field>
              {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 12, marginTop: -6 }}>{erro}</div>}
              <Btn kind="primary" type="submit">Entrar</Btn>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: pageBg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px 16px 60px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>Sala de máquinas</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
              {negocios.length === 0 ? 'Nenhum negócio ainda.'
                : `${negocios.length} ${negocios.length === 1 ? 'negócio' : 'negócios'} · ${negocios.filter((n) => n.ativo).length} ativo(s)`}
            </div>
          </div>
          <button onClick={sair} style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 9, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>Sair</button>
        </div>

        {msg && <Card style={{ marginBottom: 14, borderColor: C.red }}><div style={{ fontSize: 13.5, color: C.red }}>{msg}</div></Card>}

        {recemCriado && (
          <Card style={{ marginBottom: 14, borderColor: C.accent }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Pronto — {recemCriado.nome || recemCriado.codigo} já pode entrar</div>
            <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
              Manda pra pessoa:<br />
              <b>Código do negócio:</b> {recemCriado.codigo}<br />
              <b>Senha:</b> {recemCriado.senha}
            </div>
            <div style={{ fontSize: 12.5, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
              Esta senha aparece <b>só agora</b> — guardada fica só a versão embaralhada, que
              nem eu nem tu conseguimos ler de volta. Se perder, tu pões uma nova aqui mesmo.
              A equipe dela entra com <b>1234</b> e troca depois.
            </div>
            <div style={{ marginTop: 12 }}><Btn kind="ghost" onClick={() => setRecemCriado(null)}>Já mandei</Btn></div>
          </Card>
        )}

        <Card style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Novo negócio</div>
          <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 14, lineHeight: 1.5 }}>
            O código é o que a pessoa digita pra entrar. Minúsculas, números e hífen — e não muda depois.
          </div>
          <form onSubmit={criar}>
            <Field label="Código"><TextInput value={novo.codigo} onChange={(v) => setNovo((n) => ({ ...n, codigo: v }))} placeholder="ex: boteco-da-ana" /></Field>
            <Field label="Nome do negócio"><TextInput value={novo.nome} onChange={(v) => setNovo((n) => ({ ...n, nome: v }))} placeholder="ex: Boteco da Ana" /></Field>
            <Field label="Senha da dona (mínimo 6)"><TextInput value={novo.senha} onChange={(v) => setNovo((n) => ({ ...n, senha: v }))} placeholder="a que tu vais mandar pra ela" /></Field>
            <Btn kind="primary" type="submit" disabled={criando}>{criando ? 'Criando…' : 'Criar negócio'}</Btn>
          </form>
        </Card>

        {negocios.map((n) => (
          <Card key={n.codigo} style={{ marginBottom: 10, opacity: n.ativo ? 1 : 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 800 }}>{n.nome}</div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>
                  código <b>{n.codigo}</b> · desde {dataBR(n.criadoEm)} · {faz(n.ultimoMovimento)}
                </div>
                {!n.ativo && <div style={{ fontSize: 12.5, color: C.red, marginTop: 4, fontWeight: 700 }}>Suspenso — não consegue entrar. Os dados estão todos aqui.</div>}
              </div>
              <button
                onClick={() => agir({ acao: n.ativo ? 'suspender' : 'religar', codigo: n.codigo })}
                style={{ flexShrink: 0, background: 'none', border: `1px solid ${n.ativo ? C.line : C.accent}`, color: n.ativo ? C.muted : C.accent, borderRadius: 9, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>
                {n.ativo ? 'Suspender' : 'Religar'}
              </button>
            </div>
            <div style={{ marginTop: 12, borderTop: `1px solid ${C.hair}`, paddingTop: 10 }}>
              <SenhaNova codigo={n.codigo} onTrocar={agir} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Trocar a senha da dona de um negócio — pra quando o cliente perde a dele.
function SenhaNova({ codigo, onTrocar }) {
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState('');
  const [feito, setFeito] = useState(false);
  if (!aberto) {
    return (
      <button onClick={() => { setAberto(true); setFeito(false); }}
        style={{ background: 'none', border: 'none', color: C.faint, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
        {feito ? 'Senha trocada ✓' : 'Trocar a senha da dona →'}
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="senha nova (mínimo 6)"
        autoCapitalize="none" autoCorrect="off" spellCheck="false" style={{ ...inputStyle, flex: 1 }} />
      <button
        onClick={async () => { const j = await onTrocar({ acao: 'senha', codigo, senha }); if (j) { setFeito(true); setAberto(false); setSenha(''); } }}
        style={{ background: C.accent, color: '#06101F', border: 'none', borderRadius: 9, padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Trocar</button>
      <button onClick={() => { setAberto(false); setSenha(''); }}
        style={{ background: 'none', border: 'none', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
    </div>
  );
}
