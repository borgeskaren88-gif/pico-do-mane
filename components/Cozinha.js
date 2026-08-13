'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, Card, Btn, Field, TextInput, NumInput, Empty, SecTitle, PageTitle, LogoMark, pageBg } from './ui';
import { uid, num, fmtDate } from '../lib/util';
import BotaoAtualizar from './BotaoAtualizar';
import PullToRefresh from './PullToRefresh';
import EstoqueCozinha from './EstoqueCozinha';

export default function Cozinha() {
  const router = useRouter();
  const [aba, setAba] = useState('compras'); // 'compras' | 'garrafas'
  const [itens, setItens] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [editId, setEditId] = useState(null);
  // Controle de garrafas (só abrir e encerrar).
  const [garrafas, setGarrafas] = useState([]);
  const [gProduto, setGProduto] = useState('');
  const [gVolume, setGVolume] = useState('1000');
  const [gMsg, setGMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/lista', { cache: 'no-store' });
        const j = await r.json();
        if (j.ok) { setItens(Array.isArray(j.listaCompras) ? j.listaCompras : []); setTarefas(Array.isArray(j.tarefas) ? j.tarefas : []); }
      } catch { /* ignora */ }
      setCarregando(false);
    })();
    carregarGarrafas();
  }, []);

  const carregarGarrafas = async () => {
    try {
      const r = await fetch('/api/garrafas', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) setGarrafas(Array.isArray(j.garrafas) ? j.garrafas : []);
    } catch { /* ignora */ }
  };
  const abrirGarrafa = async () => {
    if (!gProduto.trim()) return;
    setGMsg('');
    try {
      const r = await fetch('/api/garrafas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'abrir', produto: gProduto.trim(), volume: gVolume }) });
      const j = await r.json();
      if (j.ok) { setGProduto(''); setGVolume('1000'); await carregarGarrafas(); } else setGMsg(j.erro || 'Não consegui abrir a garrafa.');
    } catch { setGMsg('Não consegui abrir a garrafa.'); }
  };
  const encerrarGarrafa = async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Encerrar esta garrafa (marcar que acabou hoje)?')) return;
    try {
      const r = await fetch('/api/garrafas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'encerrar', id }) });
      const j = await r.json();
      if (j.ok) await carregarGarrafas(); else setGMsg(j.erro || 'Não consegui encerrar.');
    } catch { setGMsg('Não consegui encerrar.'); }
  };
  const garrafasAbertas = garrafas.filter((g) => g.dataAbertura && !g.dataTermino);
  const garrafasEncerradas = garrafas.filter((g) => g.dataTermino);

  // Salva a lista (só a lista) no servidor. O servidor preserva os itens já
  // comprados pela dona; aqui a gente cuida só dos itens em aberto.
  const salvar = (novos) => {
    setItens(novos);
    fetch('/api/lista', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listaCompras: novos }) }).catch(() => { });
  };

  const limpar = () => { setNome(''); setQuantidade(''); setEditId(null); };
  const salvarItem = () => {
    if (!nome.trim()) return;
    if (editId) salvar(itens.map((i) => (i.id === editId ? { ...i, nome: nome.trim(), quantidade: quantidade.trim() } : i)));
    else salvar([{ id: uid(), nome: nome.trim(), quantidade: quantidade.trim(), comprado: false, criadoEm: Date.now() }, ...itens]);
    limpar();
  };
  const editar = (it) => { setNome(it.nome || ''); setQuantidade(it.quantidade || ''); setEditId(it.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  // Joga o que está acabando no estoque pra dentro da lista de pedidos (sem
  // duplicar o que já está lá em aberto). Retorna quantos foram adicionados.
  const reporNaLista = (novos) => {
    const existentes = new Set(itens.filter((i) => !i.comprado).map((i) => (i.nome || '').trim().toLowerCase()));
    const add = novos.filter((n) => !existentes.has((n.nome || '').trim().toLowerCase()));
    if (add.length) salvar([...add.map((n) => ({ id: uid(), nome: n.nome, quantidade: '', categoria: n.categoria || '', comprado: false, criadoEm: Date.now() })), ...itens]);
    return add.length;
  };

  // Marca/desmarca uma tarefa como feita (só o "feito"; o texto é da dona).
  const marcarTarefa = (id, feito) => {
    setTarefas((ts) => ts.map((t) => (t.id === id ? { ...t, feito, feitoEm: feito ? new Date().toISOString() : '' } : t)));
    fetch('/api/lista', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tarefasFeito: { [id]: feito } }) }).catch(() => { });
  };

  // Tema claro/escuro (mesmo comportamento do resto do app).
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
              <div style={{ fontSize: 12, color: C.accent, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: 3, fontWeight: 600 }}>Cozinha</div>
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
          {[['compras', 'Lista de Compras'], ['estoque', 'Estoque'], ['garrafas', 'Garrafas']].map(([v, rot]) => (
            <button key={v} onClick={() => setAba(v)} style={{
              flex: 1, border: 'none', cursor: 'pointer', borderRadius: 9, padding: '9px 8px', fontSize: 14, fontWeight: 700,
              background: aba === v ? C.accent : 'transparent', color: aba === v ? '#06101F' : C.muted,
            }}>{rot}</button>
          ))}
        </div>

        {aba === 'compras' && (<>
        <PageTitle sub="Anote o que está faltando no bar">Lista de Compras</PageTitle>

        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>{editId ? 'Editar item' : 'Adicionar item'}</div>
          <Field label="O que falta?"><TextInput value={nome} onChange={setNome} placeholder="Gelo, limão, óleo…" /></Field>
          <Field label="Quantidade"><TextInput value={quantidade} onChange={setQuantidade} placeholder="2 fardos, 5kg…" /></Field>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={salvarItem}>{editId ? 'Salvar' : 'Adicionar'}</Btn>
            {editId && <Btn kind="ghost" onClick={limpar}>Cancelar</Btn>}
          </div>
        </Card>

        <SecTitle>A comprar ({itens.length})</SecTitle>
        {carregando ? <Empty>Carregando…</Empty> : itens.length === 0 ? <Empty>Lista vazia.<br />Anote o que está faltando no bar.</Empty> : (
          <div style={{ marginBottom: 8 }}>
            {itens.map((it) => (
              <Card key={it.id} style={{ marginBottom: 8, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{it.nome}{it.quantidade && <span style={{ color: C.muted, fontWeight: 400 }}> · {it.quantidade}</span>}</div>
                  </div>
                  <button onClick={() => editar(it)} title="Editar" style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 4 }}>Editar</button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <SecTitle>Tarefas</SecTitle>
          {tarefas.length === 0 ? <Empty>Nenhuma tarefa por aqui.</Empty> : (
            <Card style={{ padding: 6 }}>
              {tarefas.map((t, i) => (
                <div key={t.id || i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 12px', borderTop: i === 0 ? 'none' : `1px solid ${C.hair}` }}>
                  <button onClick={() => marcarTarefa(t.id, !t.feito)} aria-label={t.feito ? 'Marcar como não feita' : 'Marcar como feita'}
                    style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, cursor: 'pointer', padding: 0, border: `2px solid ${t.feito ? C.green : C.line}`, background: t.feito ? C.green : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.feito && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#06101F" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>}
                  </button>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.35, color: t.feito ? C.faint : C.text, textDecoration: t.feito ? 'line-through' : 'none' }}>{t.texto}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
        </>)}

        {aba === 'estoque' && <EstoqueCozinha onRepor={reporNaLista} />}

        {aba === 'garrafas' && (<>
        <PageTitle sub="Abra quando começar e encerre quando acabar">Controle de Garrafas</PageTitle>

        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Abrir garrafa</div>
          <Field label="Produto"><TextInput value={gProduto} onChange={setGProduto} placeholder="Gin Kalvelage, Red Label…" /></Field>
          <Field label="Volume da garrafa (ml)"><NumInput value={gVolume} onChange={setGVolume} placeholder="1000" /></Field>
          {gMsg && <div style={{ color: C.amber, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>{gMsg}</div>}
          <Btn onClick={abrirGarrafa}>Abrir garrafa</Btn>
        </Card>

        <SecTitle>Abertas agora ({garrafasAbertas.length})</SecTitle>
        {garrafasAbertas.length === 0 ? <Empty>Nenhuma garrafa aberta.</Empty> : garrafasAbertas.map((g) => (
          <Card key={g.id} style={{ marginBottom: 8, padding: 14, borderColor: C.accent }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{g.produto}</div>
                <div style={{ fontSize: 12, color: C.faint, marginTop: 3 }}>{num(g.volume)}ml · aberta {fmtDate(g.dataAbertura)}</div>
              </div>
              <Btn kind="ok" small onClick={() => encerrarGarrafa(g.id)}>Encerrar</Btn>
            </div>
          </Card>
        ))}

        {garrafasEncerradas.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <SecTitle>Encerradas recentes</SecTitle>
            {garrafasEncerradas.map((g) => (
              <Card key={g.id} style={{ marginBottom: 6, padding: '10px 14px' }}>
                <div style={{ fontSize: 14, color: C.faint }}>{g.produto}<span style={{ color: C.faint }}> · {num(g.volume)}ml · encerrada {fmtDate(g.dataTermino)}</span></div>
              </Card>
            ))}
          </div>
        )}
        </>)}
      </div>
    </div>
  );
}
