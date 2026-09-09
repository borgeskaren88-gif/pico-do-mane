'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { C, Card, Label, inputStyle, Empty, Icone } from './ui';
import { todayISO, CORES_HABITO } from '../lib/util';

// Pessoas padrão (nomes editáveis; ids fixos pra não quebrar tarefas antigas).
const PESSOAS_PADRAO = [
  { id: 'mariele', nome: 'Mariele', cor: '#88937B' },
  { id: 'karen', nome: 'Karen', cor: '#9A7BA0' },
  { id: 'aurora', nome: 'Aurora', cor: '#D3A45C' },
];

export default function Tarefas({ usuario }) {
  const [tarefas, setTarefas] = useState([]);
  const [pessoasRaw, setPessoasRaw] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sel, setSel] = useState('');
  const [addPessoa, setAddPessoa] = useState(false);
  const [novaPessoa, setNovaPessoa] = useState('');
  const [editPessoa, setEditPessoa] = useState(false);

  // Formulário de nova tarefa
  const [titulo, setTitulo] = useState('');
  const [meta, setMeta] = useState('1');
  const [cData, setCData] = useState('');
  const [cHora, setCHora] = useState('');
  const [salvando, setSalvando] = useState(false);

  const pessoas = pessoasRaw.length ? pessoasRaw : PESSOAS_PADRAO;

  const aplicar = (j) => { if (j && j.ok) { setTarefas(j.tarefas || []); setPessoasRaw(j.pessoas || []); } };
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

  // Garante uma pessoa selecionada válida.
  useEffect(() => {
    if (!pessoas.length) return;
    if (!pessoas.some((p) => p.id === sel)) setSel(pessoas.find((p) => p.id === 'karen')?.id || pessoas[0].id);
  }, [pessoas, sel]);

  const acao = async (payload) => {
    try {
      const r = await fetch('/api/casa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (j.ok) aplicar(j); else setErro(j.erro || 'Erro.');
      return j;
    } catch { setErro('Sem conexão.'); return { ok: false }; }
  };

  const pessoa = pessoas.find((p) => p.id === sel) || pessoas[0];
  const cor = pessoa?.cor || C.accent;
  const minhas = useMemo(() => tarefas.filter((t) => t.pessoa === sel), [tarefas, sel]);
  const abertas = minhas.filter((t) => (Number(t.feitos) || 0) < t.meta);
  const prontas = minhas.filter((t) => (Number(t.feitos) || 0) >= t.meta);
  const estrelasDe = (id) => tarefas.filter((t) => t.pessoa === id && (Number(t.feitos) || 0) >= t.meta).length;

  const adicionar = async (e) => {
    e.preventDefault();
    if (!titulo.trim() || salvando || !pessoa) return;
    setSalvando(true);
    await acao({ acao: 'tarefaAdd', pessoa: pessoa.id, titulo: titulo.trim(), meta, data: cData, hora: cHora });
    setTitulo(''); setMeta('1'); setCData(''); setCHora(''); setSalvando(false);
  };
  const criarPessoa = async () => {
    if (!novaPessoa.trim()) return;
    const j = await acao({ acao: 'pessoaAdd', nome: novaPessoa.trim() });
    setNovaPessoa(''); setAddPessoa(false);
    if (j && j.ok && j.pessoas?.length) setSel(j.pessoas[j.pessoas.length - 1].id);
  };

  return (
    <div>
      {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{erro}</div>}
      {carregando ? <Empty>Carregando…</Empty> : (
        <>
          {/* Seletor de pessoa (rolagem horizontal) */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 14 }}>
            {pessoas.map((p) => {
              const on = p.id === sel;
              return (
                <button key={p.id} onClick={() => { setSel(p.id); setEditPessoa(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, padding: '9px 14px', borderRadius: 999, cursor: 'pointer', border: `1.5px solid ${on ? p.cor : C.line}`, background: on ? p.cor : 'transparent', color: on ? '#20180F' : C.muted, fontWeight: 700, fontSize: 14 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: on ? '#20180F' : p.cor }} />
                  {p.nome}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, opacity: 0.9 }}><Icone name="star" size={12} />{estrelasDe(p.id)}</span>
                </button>
              );
            })}
            <button onClick={() => setAddPessoa((v) => !v)} style={{ flexShrink: 0, padding: '9px 14px', borderRadius: 999, cursor: 'pointer', border: `1.5px dashed ${C.line}`, background: 'transparent', color: C.muted, fontWeight: 700, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icone name="plus" size={15} /> pessoa</button>
          </div>

          {addPessoa && (
            <Card style={{ marginBottom: 14 }}>
              <Label>Nova pessoa</Label>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input value={novaPessoa} onChange={(e) => setNovaPessoa(e.target.value)} placeholder="Nome" style={inputStyle} />
                <button onClick={criarPessoa} style={{ background: C.accent, color: C.onAccent, border: 'none', borderRadius: 10, padding: '0 18px', height: 44, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>criar</button>
              </div>
            </Card>
          )}

          {/* Cabeçalho da pessoa selecionada */}
          {pessoa && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 2px 14px' }}>
              <span style={{ width: 16, height: 16, borderRadius: 999, background: cor, flexShrink: 0 }} />
              <div style={{ fontSize: 24, fontWeight: 800, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pessoa.nome}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: cor, fontWeight: 800 }}><Icone name="star" size={16} />{estrelasDe(pessoa.id)}</div>
              <button onClick={() => setEditPessoa((v) => !v)} title="Editar pessoa" style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}><Icone name="pencil" size={17} /></button>
            </div>
          )}

          {editPessoa && pessoa && (
            <EditarPessoa pessoa={pessoa} acao={acao} podeApagar={pessoas.length > 1} onFim={() => setEditPessoa(false)} />
          )}

          {/* Nova tarefa (pra pessoa selecionada) */}
          <Card style={{ marginBottom: 16 }}>
            <Label>Nova tarefa {pessoa ? `pra ${pessoa.nome}` : ''}</Label>
            <form onSubmit={adicionar} style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Passear com a Aurora" style={inputStyle} autoFocus />
                <input inputMode="numeric" value={meta} onChange={(e) => setMeta(e.target.value)} title="Quantas vezes" style={{ ...inputStyle, width: 64, flexShrink: 0, textAlign: 'center' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: C.muted, display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}><Icone name="clock" size={14} /> Quando:</span>
                <input type="date" value={cData} onChange={(e) => setCData(e.target.value)} style={{ ...inputStyle, padding: '8px 10px', WebkitAppearance: 'none', appearance: 'none', colorScheme: 'dark', minWidth: 0 }} />
                <input type="time" value={cHora} onChange={(e) => setCHora(e.target.value)} disabled={!cData} style={{ ...inputStyle, padding: '8px 10px', WebkitAppearance: 'none', appearance: 'none', colorScheme: 'dark', width: 96, flexShrink: 0, opacity: cData ? 1 : 0.5 }} />
              </div>
              <button type="submit" disabled={salvando} style={{ width: '100%', marginTop: 12, background: cor, color: '#20180F', border: 'none', borderRadius: 10, padding: '12px', fontSize: 15, fontWeight: 800, cursor: 'pointer', opacity: salvando ? 0.7 : 1 }}>{salvando ? 'Adicionando…' : '+ Adicionar tarefa'}</button>
              <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>O número é quantas vezes precisa ser feita. Com um dia marcado, vira notificação de manhã.</div>
            </form>
          </Card>

          {/* Lista de tarefas da pessoa */}
          {minhas.length === 0 ? (
            <Empty>Nenhuma tarefa pra {pessoa?.nome} ainda.<br />Adicione a primeira ali em cima.</Empty>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 2px 8px' }}>
                <Label>{abertas.length} a fazer</Label>
                {prontas.length > 0 && <button onClick={() => { if (window.confirm('Tirar as tarefas já feitas dessa pessoa?')) acao({ acao: 'tarefaLimparProntas', pessoa: pessoa.id }); }} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>limpar prontas</button>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {abertas.map((t) => <TarefaLinha key={t.id} t={t} cor={cor} acao={acao} />)}
                {prontas.length > 0 && <div style={{ opacity: 0.75, display: 'flex', flexDirection: 'column', gap: 12 }}>{prontas.map((t) => <TarefaLinha key={t.id} t={t} cor={cor} acao={acao} />)}</div>}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function EditarPessoa({ pessoa, acao, podeApagar, onFim }) {
  const [nome, setNome] = useState(pessoa.nome);
  return (
    <Card style={{ marginBottom: 16 }}>
      <Label>Editar pessoa</Label>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" style={inputStyle} />
        <button onClick={() => { if (nome.trim()) { acao({ acao: 'pessoaRenomear', id: pessoa.id, nome: nome.trim() }); onFim(); } }} style={{ background: C.accent, color: C.onAccent, border: 'none', borderRadius: 10, padding: '0 16px', height: 44, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>salvar</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0 4px' }}>
        {CORES_HABITO.map((c) => (
          <button key={c} onClick={() => acao({ acao: 'pessoaCor', id: pessoa.id, cor: c })} title="Cor" style={{ width: 28, height: 28, borderRadius: 999, cursor: 'pointer', background: c, border: 'none', boxShadow: pessoa.cor === c ? `0 0 0 3px ${C.text}` : '0 0 0 2px rgba(255,255,255,0.15)' }} />
        ))}
      </div>
      {podeApagar && <button onClick={() => { if (window.confirm(`Apagar ${pessoa.nome} e as tarefas dela?`)) { acao({ acao: 'pessoaDel', id: pessoa.id }); onFim(); } }} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '6px 0 0' }}>apagar esta pessoa</button>}
    </Card>
  );
}

function quandoLabel(data, hoje) {
  if (!data) return '';
  const amanha = new Date(hoje + 'T12:00:00'); amanha.setDate(amanha.getDate() + 1);
  const iso2 = amanha.toISOString().slice(0, 10);
  if (data === hoje) return 'hoje';
  if (data === iso2) return 'amanhã';
  const [, m, d] = data.split('-');
  return `${d}/${m}`;
}

function TarefaLinha({ t, cor, acao }) {
  const feitos = Number(t.feitos) || 0;
  const pronta = feitos >= t.meta;
  const pct = t.meta > 0 ? Math.round((feitos / t.meta) * 100) : 0;
  const hoje = todayISO();
  const atrasada = t.data && !pronta && t.data < hoje;
  const [editT, setEditT] = useState(false);
  const [titulo, setTitulo] = useState(t.titulo);
  const [meta, setMeta] = useState(String(t.meta));
  const [quando, setQuando] = useState(false);
  const [d, setD] = useState(t.data || '');
  const [h, setH] = useState(t.hora || '');

  const salvarNome = () => { if (titulo.trim()) { acao({ acao: 'tarefaRenomear', id: t.id, titulo: titulo.trim(), meta }); setEditT(false); } };
  const salvarQuando = () => { acao({ acao: 'tarefaQuando', id: t.id, data: d, hora: h }); setQuando(false); };

  return (
    <div style={{ background: C.glassBg, border: `1px solid ${pronta ? cor : C.glassBorder}`, borderRadius: 14, padding: 14, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: C.glassShadow }}>
      {editT ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} style={inputStyle} autoFocus />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: C.muted }}>Vezes:</span>
            <input inputMode="numeric" value={meta} onChange={(e) => setMeta(e.target.value)} style={{ ...inputStyle, width: 70, textAlign: 'center' }} />
            <button onClick={salvarNome} style={{ background: cor, color: '#20180F', border: 'none', borderRadius: 10, padding: '0 16px', height: 42, fontWeight: 800, cursor: 'pointer' }}>ok</button>
            <button onClick={() => { setEditT(false); setTitulo(t.titulo); setMeta(String(t.meta)); }} style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '0 12px', height: 42, cursor: 'pointer' }}>x</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: pronta ? C.muted : C.text, textDecoration: pronta ? 'line-through' : 'none', wordBreak: 'break-word' }}>{t.titulo}</div>
          <button onClick={() => setEditT(true)} title="Renomear" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', padding: 4 }}><Icone name="pencil" size={15} /></button>
          <button onClick={() => acao({ acao: 'tarefaDel', id: t.id })} title="Apagar" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
        </div>
      )}

      {/* Quando */}
      {!editT && (
        <>
          <button onClick={() => setQuando((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, background: t.data ? `${cor}22` : 'transparent', border: `1px solid ${t.data ? `${cor}55` : C.line}`, borderRadius: 999, padding: '4px 10px', cursor: 'pointer', color: atrasada ? C.red : t.data ? C.text : C.faint, fontSize: 12, fontWeight: 700 }}>
            <Icone name="clock" size={13} />
            {t.data ? `${quandoLabel(t.data, hoje)}${t.hora ? ` · ${t.hora}` : ''}${atrasada ? ' · atrasou' : ''}` : 'pôr dia/hora'}
          </button>
          {quando && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" value={d} onChange={(e) => setD(e.target.value)} style={{ ...inputStyle, padding: '8px 10px', colorScheme: 'dark', WebkitAppearance: 'none', appearance: 'none', minWidth: 0, flex: 1 }} />
              <input type="time" value={h} onChange={(e) => setH(e.target.value)} disabled={!d} style={{ ...inputStyle, padding: '8px 10px', colorScheme: 'dark', WebkitAppearance: 'none', appearance: 'none', width: 100, flexShrink: 0, opacity: d ? 1 : 0.5 }} />
              <button onClick={salvarQuando} style={{ background: cor, color: '#20180F', border: 'none', borderRadius: 10, padding: '0 14px', height: 40, fontWeight: 800, cursor: 'pointer' }}>ok</button>
              {t.data && <button onClick={() => { setD(''); setH(''); acao({ acao: 'tarefaQuando', id: t.id, data: '', hora: '' }); setQuando(false); }} style={{ background: 'none', border: 'none', color: C.faint, fontSize: 12, cursor: 'pointer' }}>tirar</button>}
            </div>
          )}
        </>
      )}

      {/* Progresso */}
      <div style={{ height: 20, background: 'rgba(160,150,130,0.20)', borderRadius: 999, overflow: 'hidden', position: 'relative', marginTop: 12 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: cor, borderRadius: 999, transition: 'width .2s' }} />
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, fontSize: 12, fontWeight: 800, color: pct > 55 ? '#20180F' : C.text }}><Icone name="star" size={12} />{feitos}/{t.meta}</span>
      </div>

      {/* Botões grandes */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={() => acao({ acao: 'tarefaProgresso', id: t.id, delta: -1 })} disabled={feitos === 0} style={{ width: 46, height: 44, borderRadius: 10, border: `1px solid ${C.line}`, background: 'transparent', color: C.muted, cursor: feitos === 0 ? 'default' : 'pointer', opacity: feitos === 0 ? 0.4 : 1, fontSize: 20, lineHeight: 1, flexShrink: 0 }}>−</button>
        <button onClick={() => acao({ acao: 'tarefaProgresso', id: t.id, delta: 1 })} disabled={pronta} style={{ flex: 1, height: 44, borderRadius: 10, border: pronta ? `1px solid ${cor}` : 'none', background: pronta ? 'transparent' : cor, color: pronta ? cor : '#20180F', cursor: pronta ? 'default' : 'pointer', fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>{pronta ? '✓ feito!' : <><Icone name="plus" size={17} /> marcar 1</>}</button>
      </div>
    </div>
  );
}
