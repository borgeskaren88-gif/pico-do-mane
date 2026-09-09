'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { C, Card, Label, inputStyle, Empty, Icone } from './ui';

// Quadro de tarefas da casa, uma coluna por pessoa. Aurora é a pet da casa :)
const PESSOAS = [
  ['mariele', 'Mariele', '#88937B'],
  ['karen', 'Karen', '#9A7BA0'],
  ['aurora', 'Aurora', '#D3A45C'],
];

export default function Tarefas({ usuario }) {
  const [tarefas, setTarefas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [pessoa, setPessoa] = useState('karen');
  const [titulo, setTitulo] = useState('');
  const [meta, setMeta] = useState('1');
  const [salvando, setSalvando] = useState(false);

  const aplicar = (j) => { if (j && j.ok) setTarefas(j.tarefas || []); };
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
    if (!titulo.trim() || salvando) return;
    setSalvando(true);
    await acao({ acao: 'tarefaAdd', pessoa, titulo: titulo.trim(), meta });
    setTitulo(''); setMeta('1'); setSalvando(false);
  };

  const porPessoa = useMemo(() => {
    const m = { mariele: [], karen: [], aurora: [] };
    for (const t of tarefas) (m[t.pessoa] || m.karen).push(t);
    return m;
  }, [tarefas]);

  return (
    <div>
      {/* Formulário de nova tarefa */}
      <Card style={{ marginBottom: 16 }}>
        <Label>Nova tarefa</Label>
        <form onSubmit={adicionar} style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {PESSOAS.map(([id, nome, cor]) => {
              const ativo = pessoa === id;
              return (
                <button type="button" key={id} onClick={() => setPessoa(id)}
                  style={{ flex: 1, padding: '9px 4px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${ativo ? cor : C.line}`, background: ativo ? cor : 'transparent', color: ativo ? '#20180F' : C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: ativo ? '#20180F' : cor }} /> {nome}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Passear com a Aurora" style={inputStyle} />
            <input inputMode="numeric" value={meta} onChange={(e) => setMeta(e.target.value)} title="Quantas vezes" style={{ ...inputStyle, width: 64, flexShrink: 0, textAlign: 'center' }} />
            <button type="submit" disabled={salvando} style={{ background: C.accent, color: C.onAccent, border: 'none', borderRadius: 10, padding: '0 16px', height: 44, fontSize: 15, fontWeight: 700, cursor: 'pointer', flexShrink: 0, opacity: salvando ? 0.7 : 1 }}>+</button>
          </div>
          <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>O número é quantas vezes a tarefa precisa ser feita (ex.: 6 = seis vezes).</div>
        </form>
      </Card>

      {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{erro}</div>}

      {carregando ? <Empty>Carregando…</Empty> : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {PESSOAS.map(([id, nome, cor]) => (
            <Coluna key={id} id={id} nome={nome} cor={cor} itens={porPessoa[id]} acao={acao} />
          ))}
        </div>
      )}
    </div>
  );
}

function Coluna({ id, nome, cor, itens, acao }) {
  const prontas = itens.filter((t) => t.feitos >= t.meta).length;
  return (
    <div style={{ flex: 1, minWidth: 0, background: `${cor}1F`, border: `1px solid ${cor}3A`, borderRadius: 16, padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 4px 2px' }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: cor, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 800, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: cor, fontSize: 12, fontWeight: 800 }}><Icone name="star" size={12} />{prontas}</span>
      </div>
      {itens.length === 0 ? (
        <div style={{ fontSize: 11, color: C.faint, textAlign: 'center', padding: '14px 4px' }}>Sem tarefas</div>
      ) : itens.map((t) => <TarefaCard key={t.id} t={t} cor={cor} acao={acao} />)}
    </div>
  );
}

function TarefaCard({ t, cor, acao }) {
  const feitos = Number(t.feitos) || 0;
  const pronta = feitos >= t.meta;
  const pct = t.meta > 0 ? Math.round((feitos / t.meta) * 100) : 0;
  return (
    <div style={{ background: C.glassBg, border: `1px solid ${pronta ? cor : C.glassBorder}`, borderRadius: 12, padding: '9px 9px 8px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, lineHeight: 1.25, color: pronta ? C.muted : C.text, textDecoration: pronta ? 'line-through' : 'none', wordBreak: 'break-word' }}>{t.titulo}</div>
        <button onClick={() => acao({ acao: 'tarefaDel', id: t.id })} title="Apagar" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
      </div>
      {/* barra de progresso com estrela */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7 }}>
        <div style={{ flex: 1, minWidth: 0, height: 14, background: 'rgba(160,150,130,0.20)', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: cor, borderRadius: 999, transition: 'width .2s' }} />
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 9.5, fontWeight: 800, color: pct > 55 ? '#20180F' : C.text }}><Icone name="star" size={9} />{feitos}/{t.meta}</span>
        </div>
      </div>
      {/* botões + / − */}
      <div style={{ display: 'flex', gap: 5, marginTop: 7 }}>
        <button onClick={() => acao({ acao: 'tarefaProgresso', id: t.id, delta: -1 })} disabled={feitos === 0} style={{ width: 26, height: 26, borderRadius: 8, border: `1px solid ${C.line}`, background: 'transparent', color: C.muted, cursor: feitos === 0 ? 'default' : 'pointer', opacity: feitos === 0 ? 0.4 : 1, fontSize: 16, lineHeight: 1, flexShrink: 0 }}>−</button>
        <button onClick={() => acao({ acao: 'tarefaProgresso', id: t.id, delta: 1 })} disabled={pronta} style={{ flex: 1, height: 26, borderRadius: 8, border: 'none', background: pronta ? 'transparent' : cor, color: pronta ? cor : '#20180F', cursor: pronta ? 'default' : 'pointer', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>{pronta ? 'feito!' : <><Icone name="plus" size={13} /> 1</>}</button>
      </div>
    </div>
  );
}
