'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { C, Card, Btn, TextInput, inputStyle } from './ui';
import { todayISO, addDays, weekday, fmtDate, ymOf } from '../lib/util';

const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const LETRAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']; // domingo a sábado

// Calendário do mês (Google Agenda): o quadradão pra bater o olho e ver os
// compromissos. Self-contained — busca os próprios eventos. Só aparece quando o
// Google Agenda está conectado (senão devolve null e quem usa mostra a conexão).
export default function AgendaMes() {
  const hoje = todayISO();
  const mes = ymOf(hoje);
  const [agenda, setAgenda] = useState(null); // null = não conectado / carregando
  const [vista, setVista] = useState('mes'); // 'dia' | 'mes'
  const [diaSel, setDiaSel] = useState(hoje);
  const [novoAberto, setNovoAberto] = useState(false);
  const [evTitulo, setEvTitulo] = useState('');
  const [evData, setEvData] = useState(hoje);
  const [evHora, setEvHora] = useState('19:00');
  const [evDiaTodo, setEvDiaTodo] = useState(false);
  const [salvandoEv, setSalvandoEv] = useState(false);
  const [evErro, setEvErro] = useState('');

  const [concluindo, setConcluindo] = useState('');

  const carregarAgenda = async () => {
    try {
      const r = await fetch('/api/google/eventos', { cache: 'no-store' });
      const j = await r.json();
      setAgenda(j.ok && j.conectado ? (j.eventos || []) : null);
    } catch { setAgenda(null); }
  };
  useEffect(() => { carregarAgenda(); }, []);

  // "Dar ok" numa tarefa: risca (marca como feita) ou desmarca no Google. Ela
  // fica na lista, só riscada — como num calendário digital.
  const alternarTarefaAg = async (ev) => {
    if (concluindo) return;
    setConcluindo(ev.id);
    const novo = !ev.concluida;
    try {
      const r = await fetch('/api/google/concluir-tarefa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ev.id, concluida: novo }) });
      const j = await r.json();
      if (j.ok) setAgenda((a) => (a || []).map((x) => (x.id === ev.id ? { ...x, concluida: novo } : x)));
    } catch { /* ignora */ }
    setConcluindo('');
  };

  const agendaGrupos = useMemo(() => {
    if (!agenda || !agenda.length) return [];
    const m = new Map();
    for (const ev of agenda) {
      const d = (ev.inicio || '').slice(0, 10);
      if (!d) continue;
      if (!m.has(d)) m.set(d, []);
      m.get(d).push(ev);
    }
    return [...m.entries()];
  }, [agenda]);
  const porDia = useMemo(() => new Map(agendaGrupos), [agendaGrupos]);
  const diasComEvento = useMemo(() => {
    const s = new Set();
    for (const ev of (agenda || [])) { const d = (ev.inicio || '').slice(0, 10); if (d) s.add(d); }
    return s;
  }, [agenda]);
  const cabMes = (() => { const [y, m] = diaSel.split('-'); return `${MESES_LONGOS[Number(m) - 1]} ${y}`; })();

  const celulasMes = useMemo(() => {
    const [ano, mn] = mes.split('-').map(Number);
    const offset = new Date(ano, mn - 1, 1).getDay();
    const total = new Date(ano, mn, 0).getDate();
    const cs = [];
    for (let i = 0; i < offset; i++) cs.push(null);
    for (let d = 1; d <= total; d++) cs.push(`${mes}-${String(d).padStart(2, '0')}`);
    return cs;
  }, [mes]);

  const ehBoleto = (ev) => ev.tarefa && /^\s*boleto/i.test(ev.titulo || '');
  const corEvento = (ev) => (ehBoleto(ev) ? C.amber : ev.tarefa ? C.accent : ev.diaTodo ? C.muted : C.accent2);
  const etiquetaEvento = (ev) => (ehBoleto(ev) ? 'A pagar' : ev.tarefa ? 'Tarefa' : ev.diaTodo ? 'Dia todo' : ev.inicio.slice(11, 16));

  const listaDoDia = (dia) => {
    const evs = porDia.get(dia) || [];
    if (!evs.length) return <div style={{ fontSize: 13, color: C.faint, textAlign: 'center', padding: '14px 0 4px' }}>Nada agendado para {dia === hoje ? 'hoje' : 'este dia'}.</div>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {evs.map((ev) => {
          const cor = corEvento(ev);
          return (
            <div key={ev.id} style={{ display: 'flex', gap: 12, alignItems: 'center', background: `color-mix(in srgb, ${cor} 14%, transparent)`, borderRadius: 12, padding: '11px 14px' }}>
              <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: cor, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, color: ev.concluida ? C.faint : C.text, lineHeight: 1.3, textDecoration: ev.concluida ? 'line-through' : 'none' }}>{ev.titulo}</span>
              {ev.tarefa && !ehBoleto(ev) ? (
                <button onClick={() => alternarTarefaAg(ev)} disabled={concluindo === ev.id} title={ev.concluida ? 'Desmarcar' : 'Marcar como feito'}
                  style={{ flexShrink: 0, border: `1px solid ${cor}`, background: ev.concluida ? cor : 'transparent', color: ev.concluida ? '#06101F' : cor, borderRadius: 999, padding: '5px 13px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {concluindo === ev.id ? '…' : ev.concluida ? '✓ feito' : 'ok'}
                </button>
              ) : (
                <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: cor, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{etiquetaEvento(ev)}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const abrirNovo = () => { setEvData(vista === 'dia' ? hoje : diaSel); setEvErro(''); setNovoAberto(true); };
  const salvarEvento = async () => {
    if (!evTitulo.trim() || salvandoEv) return;
    setSalvandoEv(true); setEvErro('');
    try {
      const r = await fetch('/api/google/criar-evento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: evTitulo.trim(), data: evData, hora: evHora, diaTodo: evDiaTodo }) });
      const j = await r.json();
      if (j.ok) { setNovoAberto(false); setEvTitulo(''); setEvDiaTodo(false); setDiaSel(evData); if (vista === 'dia' && evData !== hoje) setVista('mes'); await carregarAgenda(); }
      else setEvErro(j.erro || 'Não consegui criar o evento.');
    } catch { setEvErro('Não consegui criar o evento.'); }
    setSalvandoEv(false);
  };

  if (agenda === null) return null;

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: '-.02em' }}>{vista === 'dia' ? 'Hoje' : cabMes}</div>
        <div style={{ display: 'inline-flex', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 2, gap: 2 }}>
          {[['mes', 'Mês'], ['dia', 'Dia']].map(([v, rot]) => (
            <button key={v} onClick={() => { setVista(v); setDiaSel(hoje); }} style={{
              border: 'none', cursor: 'pointer', borderRadius: 8, padding: '5px 11px', fontSize: 12, fontWeight: 700,
              background: vista === v ? C.accent : 'transparent', color: vista === v ? '#06101F' : C.muted,
            }}>{rot}</button>
          ))}
        </div>
      </div>

      {vista === 'mes' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {LETRAS_SEMANA.map((w, i) => (
                <div key={'h' + i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: C.faint, paddingBottom: 4 }}>{w}</div>
              ))}
              {celulasMes.map((d, i) => {
                if (!d) return <div key={'c' + i} />;
                const sel = d === diaSel, ehHoje = d === hoje, passado = d < hoje, temEv = diasComEvento.has(d);
                return (
                  <button key={'c' + i} onClick={() => setDiaSel(d)} style={{
                    border: 'none', cursor: 'pointer', position: 'relative', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10,
                    background: sel ? C.accent : 'transparent', color: sel ? '#06101F' : (passado ? C.faint : C.text),
                    boxShadow: !sel && ehHoje ? `inset 0 0 0 1.5px ${C.accent}` : 'none',
                    fontSize: 13, fontWeight: sel || ehHoje ? 800 : 600, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {Number(d.slice(8))}
                    {temEv && !sel && <span style={{ position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: '50%', background: C.accent }} />}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.07em' }}>
              {diaSel === hoje ? 'Hoje' : diaSel === addDays(hoje, 1) ? 'Amanhã' : `${weekday(diaSel)}, ${fmtDate(diaSel)}`}
            </div>
            <div className="agenda-dia-lista">{listaDoDia(diaSel)}</div>
          </div>
        </div>
      ) : (
        listaDoDia(hoje)
      )}

      {!novoAberto ? (
        <button onClick={abrirNovo} style={{ marginTop: 12, width: '100%', background: 'transparent', border: `1px dashed ${C.line}`, color: C.accent, borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Adicionar ao Google Agenda</button>
      ) : (
        <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Novo compromisso</div>
          <div style={{ marginBottom: 10 }}><TextInput value={evTitulo} onChange={setEvTitulo} placeholder="Ex.: Reserva aniversário — 20 pessoas" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: evDiaTodo ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input type="date" value={evData} onChange={(e) => setEvData(e.target.value)} style={inputStyle} />
            {!evDiaTodo && <input type="time" value={evHora} onChange={(e) => setEvHora(e.target.value)} style={inputStyle} />}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.muted, marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={evDiaTodo} onChange={(e) => setEvDiaTodo(e.target.checked)} /> Dia todo
          </label>
          {evErro && <div style={{ color: C.red, fontSize: 12, marginBottom: 10 }}>{evErro}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn small onClick={salvarEvento}>{salvandoEv ? 'Adicionando…' : 'Adicionar'}</Btn>
            <Btn kind="ghost" small onClick={() => { setNovoAberto(false); setEvErro(''); }}>Cancelar</Btn>
          </div>
        </div>
      )}
    </Card>
  );
}
