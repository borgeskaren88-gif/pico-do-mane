'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { C, Card, Btn, Label, inputStyle, Empty } from './ui';

export default function ListaCompras({ usuario }) {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [salvando, setSalvando] = useState(false);

  const aplicar = (j) => { if (j && j.ok) setLista(j.lista || []); };

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try {
      const r = await fetch('/api/casa', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) aplicar(j); else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Não consegui conectar.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const acao = async (payload) => {
    try {
      const r = await fetch('/api/casa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (j.ok) aplicar(j); else setErro(j.erro || 'Erro.');
      return j;
    } catch { setErro('Sem conexão.'); return { ok: false }; }
  };

  const adicionar = async (e) => {
    e.preventDefault();
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    await acao({ acao: 'listaAdd', nome: nome.trim(), quantidade: quantidade.trim() });
    setNome(''); setQuantidade(''); setSalvando(false);
  };
  const alternar = (id) => acao({ acao: 'listaToggle', id });
  const apagar = (id) => acao({ acao: 'listaDel', id });
  const limparComprados = () => { if (window.confirm('Tirar da lista tudo que já foi comprado?')) acao({ acao: 'listaLimparComprados' }); };

  const { abertos, comprados } = useMemo(() => {
    const abertos = lista.filter((i) => !i.comprado);
    const comprados = lista.filter((i) => i.comprado);
    return { abertos, comprados };
  }, [lista]);

  const linha = (it) => (
    <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: `1px solid ${C.hair}` }}>
      <button onClick={() => alternar(it.id)} aria-label={it.comprado ? 'Desmarcar' : 'Marcar como comprado'}
        style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, cursor: 'pointer', padding: 0, border: `2px solid ${it.comprado ? C.green : C.line}`, background: it.comprado ? C.green : 'transparent', color: '#052014', fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {it.comprado ? '✓' : ''}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: it.comprado ? C.faint : C.text, textDecoration: it.comprado ? 'line-through' : 'none' }}>
          {it.nome}{it.quantidade ? <span style={{ color: C.muted, fontWeight: 400 }}> · {it.quantidade}</span> : null}
        </div>
        <div style={{ fontSize: 11, color: C.faint, marginTop: 1 }}>{it.criadoPor}</div>
      </div>
      <button onClick={() => apagar(it.id)} title="Apagar" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, padding: 4, lineHeight: 1 }}>×</button>
    </div>
  );

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Label>Adicionar à lista</Label>
        <form onSubmit={adicionar} style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Arroz, Detergente, Pão" style={inputStyle} />
            <input value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="qtd" style={{ ...inputStyle, width: 76, flexShrink: 0 }} />
          </div>
          <button type="submit" disabled={salvando} style={{ marginTop: 10, width: '100%', background: C.accent, color: '#06101F', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 15, fontWeight: 700, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.7 : 1 }}>
            {salvando ? 'Adicionando…' : '+ Adicionar'}
          </button>
        </form>
      </Card>

      {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{erro}</div>}

      {carregando ? <Empty>Carregando…</Empty> : lista.length === 0 ? (
        <Empty>Lista vazia.<br />Anote o que está faltando em casa. 🛒</Empty>
      ) : (
        <>
          <Label>A comprar ({abertos.length})</Label>
          <Card style={{ marginTop: 8, marginBottom: 16, padding: 0, overflow: 'hidden' }}>
            {abertos.length === 0 ? <Empty>Tudo comprado! 🎉</Empty> : abertos.map(linha)}
          </Card>

          {comprados.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 2px 8px' }}>
                <Label>Comprados ({comprados.length})</Label>
                <button onClick={limparComprados} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>limpar</button>
              </div>
              <Card style={{ padding: 0, overflow: 'hidden', opacity: 0.85 }}>{comprados.map(linha)}</Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
