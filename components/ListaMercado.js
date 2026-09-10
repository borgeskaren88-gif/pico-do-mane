'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { C, Card, Btn, Empty } from './ui';

// A lista de compras do jeito de quem está EMPURRANDO O CARRINHO: só o que
// falta, agrupado por categoria, e um toque risca o item. O que foi riscado
// some da lista e vai pro rodapé, com "desmarcar" — porque errar no mercado
// acontece e não pode ser um problema.
//
// Quem anota é a cozinha; aqui só se risca e, se precisar, se acrescenta uma
// coisa que faltou. A lista da cozinha nunca é reescrita por engano: o riscar
// manda só o id do item, não a lista toda.
export default function ListaMercado() {
  const [itens, setItens] = useState([]);
  const [comprados, setComprados] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState('');
  const [verComprados, setVerComprados] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/lista', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) {
        setItens(Array.isArray(j.listaCompras) ? j.listaCompras : []);
        setComprados(Array.isArray(j.comprados) ? j.comprados : []);
        setErro('');
      } else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Sem conexão.'); }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => {
    carregar();
    const aoVoltar = () => { if (!document.hidden) carregar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [carregar]);

  const marcar = async (id, comprado) => {
    // Rico na tela primeiro: no mercado o sinal cai, e ela não pode ficar
    // esperando o servidor pra riscar o próximo item.
    if (comprado) {
      const item = itens.find((i) => i.id === id);
      setItens((l) => l.filter((i) => i.id !== id));
      if (item) setComprados((l) => [{ ...item, comprado: true }, ...l]);
    } else {
      const item = comprados.find((i) => i.id === id);
      setComprados((l) => l.filter((i) => i.id !== id));
      if (item) setItens((l) => [{ ...item, comprado: false }, ...l]);
    }
    try {
      await fetch('/api/lista', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marcarComprado: { [id]: comprado } }),
      });
    } catch { setErro('Sem sinal agora — vou salvar quando voltar.'); }
  };

  const adicionar = async () => {
    const nome = novo.trim();
    if (!nome) return;
    setBusy(true); setErro('');
    const item = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), nome, quantidade: '', categoria: 'Outros', comprado: false, criadoEm: Date.now() };
    const lista = [...itens, item];
    setItens(lista); setNovo('');
    try {
      await fetch('/api/lista', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listaCompras: lista }),
      });
      await carregar();
    } catch { setErro('Sem conexão — o item ficou só aqui.'); }
    finally { setBusy(false); }
  };

  // Agrupa por categoria: no mercado se anda por corredor, não por ordem de
  // quem anotou.
  const grupos = useMemo(() => {
    const m = new Map();
    for (const i of itens) {
      const cat = (i.categoria || 'Outros').trim() || 'Outros';
      if (!m.has(cat)) m.set(cat, []);
      m.get(cat).push(i);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [itens]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: C.text }}>Lista de Compras</div>
        <div style={{ fontSize: 12, color: C.faint, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {itens.length ? `${itens.length} item(ns) faltando` : 'nada faltando'}
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12, lineHeight: 1.45 }}>
        É a lista que a cozinha anota. Toca no item pra riscar quando puser no carrinho.
      </div>

      {erro && <div style={{ fontSize: 13, color: C.amber, marginBottom: 10 }}>{erro}</div>}

      <Card style={{ padding: 14, marginBottom: 12 }}>
        {!carregado ? <Empty>Carregando…</Empty> : itens.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '18px 10px', color: C.faint, fontSize: 13, lineHeight: 1.5 }}>
            A lista está vazia.<br />
            <span style={{ fontSize: 12 }}>Quando a cozinha anotar o que falta, aparece aqui.</span>
          </div>
        ) : grupos.map(([cat, lista]) => (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.accent, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>{cat}</div>
            {lista.map((i) => (
              <button key={i.id} onClick={() => marcar(i.id, true)} style={{
                display: 'flex', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left',
                background: 'none', border: 'none', borderTop: `1px solid ${C.hair}`, padding: '12px 0', cursor: 'pointer',
              }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, border: `2.5px solid ${C.line}`, flexShrink: 0 }} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 15, color: C.text, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{i.nome}</span>
                  {i.quantidade ? <span style={{ display: 'block', fontSize: 12.5, color: C.faint, marginTop: 2 }}>{i.quantidade}</span> : null}
                </span>
              </button>
            ))}
          </div>
        ))}

        {/* Faltou uma coisa que não está anotada? Acrescenta aqui. */}
        <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
          <input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') adicionar(); }}
            placeholder="Faltou alguma coisa? escreve aqui"
            style={{ flex: 1, minWidth: 0, background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 10, padding: '11px 12px', fontSize: 15 }}
          />
          <Btn small onClick={adicionar} disabled={busy}>Add</Btn>
        </div>
      </Card>

      {comprados.length > 0 && (
        <Card style={{ padding: 14 }}>
          <button onClick={() => setVerComprados((v) => !v)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 800, padding: 0 }}>
            {verComprados ? '▾' : '▸'} Já no carrinho ({comprados.length})
          </button>
          {verComprados && comprados.map((i) => (
            <div key={i.id} style={{ display: 'flex', gap: 12, alignItems: 'center', borderTop: `1px solid ${C.hair}`, padding: '10px 0' }}>
              <span style={{ width: 20, height: 20, borderRadius: 999, background: C.green, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.faint, textDecoration: 'line-through', overflowWrap: 'anywhere' }}>
                {i.nome}{i.quantidade ? ` · ${i.quantidade}` : ''}
              </span>
              <button onClick={() => marcar(i.id, false)} style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: '5px 11px', borderRadius: 8, flexShrink: 0 }}>desmarcar</button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
