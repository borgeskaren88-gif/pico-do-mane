'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, Card, Btn, Field, TextInput, Empty, SecTitle, PageTitle, LogoMark, pageBg } from './ui';
import { uid } from '../lib/util';

export default function Cozinha() {
  const router = useRouter();
  const [itens, setItens] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/lista', { cache: 'no-store' });
        const j = await r.json();
        if (j.ok) { setItens(Array.isArray(j.listaCompras) ? j.listaCompras : []); setTarefas(Array.isArray(j.tarefas) ? j.tarefas : []); }
      } catch { /* ignora */ }
      setCarregando(false);
    })();
  }, []);

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
  const excluir = (id) => { if (id === editId) limpar(); salvar(itens.filter((i) => i.id !== id)); };

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
                  <button onClick={() => excluir(it.id)} title="Excluir" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 4px' }}>×</button>
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
                <div key={t.id || i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 12px', borderTop: i === 0 ? 'none' : `1px solid ${C.hair}` }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.accent, flexShrink: 0, marginTop: 7 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, color: C.text, lineHeight: 1.35 }}>{t.texto}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
