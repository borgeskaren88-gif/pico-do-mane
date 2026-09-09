'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { C, Card, Label, inputStyle, Empty, Icone } from './ui';
import { todayISO, fmtDate, MESES_LONGO } from '../lib/util';

const serif = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";
const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

// Data por extenso pra dar o ar de "diário": "quarta-feira, 9 de setembro de 2026".
function dataExtenso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dia = new Date(y, m - 1, d).getDay();
  return `${DIAS_SEMANA[dia]}, ${d} de ${MESES_LONGO[m - 1].toLowerCase()} de ${y}`;
}

const SECOES = [['notas', 'Notas', 'pencil'], ['lembretes', 'Lembretes', 'bell'], ['checklist', 'Checklist', 'check']];

export default function Caderno({ usuario }) {
  const [notas, setNotas] = useState([]);
  const [lembretes, setLembretes] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sec, setSec] = useState('notas');
  const hoje = todayISO();

  const aplicar = (j) => { if (j && j.ok) { setNotas(j.notas || []); setLembretes(j.lembretes || []); setChecklist(j.checklist || []); } };
  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try {
      const r = await fetch('/api/caderno', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) aplicar(j); else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Não consegui conectar.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const acao = async (payload) => {
    try {
      const r = await fetch('/api/caderno', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (j.ok) aplicar(j); else setErro(j.erro || 'Erro.');
      return j;
    } catch { setErro('Sem conexão.'); return { ok: false }; }
  };

  return (
    <div>
      {/* Cabeçalho estilo diário */}
      <div style={{ margin: '2px 2px 16px' }}>
        <div style={{ fontFamily: serif, fontSize: 30, lineHeight: 1.05, color: C.text }}>
          Meu <span style={{ fontStyle: 'italic' }}>caderno</span>
        </div>
        <div style={{ fontFamily: serif, fontSize: 13, color: C.muted, marginTop: 4, textTransform: 'capitalize' }}>{dataExtenso(hoje)}</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: C.faint, background: C.glassBg, border: `1px solid ${C.glassBorder}`, borderRadius: 999, padding: '4px 11px' }}>
          <Icone name="lock" size={13} /> Só você vê — a outra pessoa não tem acesso
        </div>
      </div>

      {/* Seletor de seção */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {SECOES.map(([id, rot, ico]) => {
          const ativo = sec === id;
          return (
            <button key={id} onClick={() => setSec(id)}
              style={{ flex: 1, border: `1.5px solid ${ativo ? C.accent : C.line}`, background: ativo ? C.accent : 'transparent', color: ativo ? C.onAccent : C.muted, cursor: 'pointer', borderRadius: 12, padding: '9px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
              <Icone name={ico} size={18} /> {rot}
            </button>
          );
        })}
      </div>

      {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{erro}</div>}

      {carregando ? <Empty>Carregando…</Empty>
        : sec === 'notas' ? <Notas notas={notas} acao={acao} />
        : sec === 'lembretes' ? <Lembretes lembretes={lembretes} acao={acao} hoje={hoje} />
        : <Checklist checklist={checklist} acao={acao} />}
    </div>
  );
}

// Bolinha de "concluído" no estilo da inspiração (contorno vira preenchida).
function Ponto({ feito, cor, onClick }) {
  return (
    <button onClick={onClick} aria-label={feito ? 'Desmarcar' : 'Marcar'} style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0, cursor: 'pointer', padding: 0, border: `2px solid ${feito ? (cor || C.accent) : C.line}`, background: feito ? (cor || C.accent) : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.onAccent }}>
      {feito ? <Icone name="check" size={13} /> : null}
    </button>
  );
}

// Linha pontilhada que liga o texto ao ponto, igual à foto de inspiração.
const linhaLigacao = { flex: 1, height: 0, borderBottom: `1px dashed ${C.hair}`, margin: '0 10px', alignSelf: 'center', minWidth: 12 };

function Notas({ notas, acao }) {
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [editId, setEditId] = useState('');
  const [salvando, setSalvando] = useState(false);

  const limpar = () => { setTitulo(''); setTexto(''); setEditId(''); };
  const salvar = async (e) => {
    e.preventDefault();
    if ((!titulo.trim() && !texto.trim()) || salvando) return;
    setSalvando(true);
    if (editId) await acao({ acao: 'notaEdit', id: editId, titulo, texto });
    else await acao({ acao: 'notaAdd', titulo, texto });
    limpar(); setSalvando(false);
  };
  const editar = (n) => { setEditId(n.id); setTitulo(n.titulo || ''); setTexto(n.texto || ''); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Label>{editId ? 'Editar nota' : 'Nova nota'}</Label>
        <form onSubmit={salvar} style={{ marginTop: 8 }}>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (opcional)" style={{ ...inputStyle, fontWeight: 700, marginBottom: 8 }} />
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva aqui o que quiser…" rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="submit" disabled={salvando} style={{ flex: 1, background: C.accent, color: C.onAccent, border: 'none', borderRadius: 10, padding: '11px', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: salvando ? 0.7 : 1 }}>{salvando ? 'Salvando…' : editId ? 'Salvar alterações' : '+ Guardar nota'}</button>
            {editId && <button type="button" onClick={limpar} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.line}`, borderRadius: 10, padding: '0 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>cancelar</button>}
          </div>
        </form>
      </Card>

      {notas.length === 0 ? <Empty>Nenhuma nota ainda.<br />Guarde uma ideia, um recado, um desabafo.</Empty> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {notas.map((n) => (
            <Card key={n.id} style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {n.titulo && <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, marginBottom: n.texto ? 4 : 0 }}>{n.titulo}</div>}
                  {n.texto && <div style={{ fontSize: 14, color: C.muted, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{n.texto}</div>}
                </div>
                <button onClick={() => editar(n)} title="Editar" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', padding: 4 }}><Icone name="pencil" size={16} /></button>
                <button onClick={() => { if (window.confirm('Apagar esta nota?')) acao({ acao: 'notaDel', id: n.id }); }} title="Apagar" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Lembretes({ lembretes, acao, hoje }) {
  const [texto, setTexto] = useState('');
  const [data, setData] = useState('');
  const [salvando, setSalvando] = useState(false);
  const ordenados = useMemo(() => [...lembretes].sort((a, b) => (a.feito === b.feito ? 0 : a.feito ? 1 : -1)), [lembretes]);

  const salvar = async (e) => {
    e.preventDefault();
    if (!texto.trim() || salvando) return;
    setSalvando(true);
    await acao({ acao: 'lembreteAdd', texto, data });
    setTexto(''); setData(''); setSalvando(false);
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Label>Novo lembrete</Label>
        <form onSubmit={salvar} style={{ marginTop: 8 }}>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: Ligar pra dentista" style={inputStyle} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ ...inputStyle, minWidth: 0, WebkitAppearance: 'none', appearance: 'none', colorScheme: 'dark' }} />
            <button type="submit" disabled={salvando} style={{ background: C.accent, color: C.onAccent, border: 'none', borderRadius: 10, padding: '0 18px', height: 44, fontSize: 15, fontWeight: 700, cursor: 'pointer', flexShrink: 0, opacity: salvando ? 0.7 : 1 }}>+</button>
          </div>
        </form>
      </Card>

      {ordenados.length === 0 ? <Empty>Nenhum lembrete.<br />Anote o que não pode esquecer.</Empty> : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {ordenados.map((l, i) => {
            const atrasado = l.data && !l.feito && l.data < hoje;
            return (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderTop: i === 0 ? 'none' : `1px solid ${C.hair}` }}>
                <div style={{ minWidth: 0, maxWidth: '68%' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: l.feito ? C.faint : C.text, textDecoration: l.feito ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.texto}</div>
                  {l.data && <div style={{ fontSize: 12, color: atrasado ? C.red : C.faint, marginTop: 2 }}>{fmtDate(l.data)}{atrasado ? ' · atrasado' : ''}</div>}
                </div>
                <div style={linhaLigacao} />
                <Ponto feito={l.feito} onClick={() => acao({ acao: 'lembreteToggle', id: l.id })} />
                <button onClick={() => acao({ acao: 'lembreteDel', id: l.id })} title="Apagar" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function Checklist({ checklist, acao }) {
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const abertos = checklist.filter((c) => !c.feito);
  const feitos = checklist.filter((c) => c.feito);

  const salvar = async (e) => {
    e.preventDefault();
    if (!texto.trim() || salvando) return;
    setSalvando(true);
    await acao({ acao: 'checkAdd', texto });
    setTexto(''); setSalvando(false);
  };

  const linha = (c, i) => (
    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderTop: i === 0 ? 'none' : `1px solid ${C.hair}` }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: c.feito ? C.faint : C.text, textDecoration: c.feito ? 'line-through' : 'none', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.texto}</div>
      <div style={linhaLigacao} />
      <Ponto feito={c.feito} onClick={() => acao({ acao: 'checkToggle', id: c.id })} />
      <button onClick={() => acao({ acao: 'checkDel', id: c.id })} title="Apagar" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
    </div>
  );

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Label>Novo item</Label>
        <form onSubmit={salvar} style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: Comprar presente da Mari" style={inputStyle} />
          <button type="submit" disabled={salvando} style={{ background: C.accent, color: C.onAccent, border: 'none', borderRadius: 10, padding: '0 18px', height: 44, fontSize: 15, fontWeight: 700, cursor: 'pointer', flexShrink: 0, opacity: salvando ? 0.7 : 1 }}>+</button>
        </form>
      </Card>

      {checklist.length === 0 ? <Empty>Sua checklist está vazia.<br />Adicione a primeira tarefa.</Empty> : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 2px 8px' }}>
            <Label>{abertos.length} a fazer</Label>
            {feitos.length > 0 && <button onClick={() => { if (window.confirm('Tirar os itens já concluídos?')) acao({ acao: 'checkLimparFeitos' }); }} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>limpar concluídos</button>}
          </div>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {abertos.map(linha)}
            {feitos.length > 0 && <div style={{ opacity: 0.85 }}>{feitos.map(linha)}</div>}
          </Card>
        </>
      )}
    </div>
  );
}
