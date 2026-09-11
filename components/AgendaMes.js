'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { C, Card, Btn, TextInput, inputStyle } from './ui';
import { todayISO, addDays, weekday, fmtDate, ymOf } from '../lib/util';

const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const LETRAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']; // domingo a sábado
const SEM_CURTO = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const diaDaSemana = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
// Os 7 dias da semana (domingo a sábado) em que o dia escolhido cai.
const semanaDe = (iso) => { const ini = addDays(iso, -diaDaSemana(iso)); return Array.from({ length: 7 }, (_, i) => addDays(ini, i)); };

// Calendário do mês (Google Agenda): a faixa da semana pra bater o olho no dia,
// e o mês inteiro quando quiser a visão larga. Self-contained — busca os
// próprios eventos. Só aparece quando o Google Agenda está conectado (senão
// devolve null e quem usa mostra a tela de conexão).
export default function AgendaMes() {
  const hoje = todayISO();
  const [agenda, setAgenda] = useState(null); // null = não conectado / carregando
  const [reservas, setReservas] = useState([]); // mesas reservadas (da Mari)
  const [diaSel, setDiaSel] = useState(hoje);
  const [mesAberto, setMesAberto] = useState(false); // o quadradão do mês inteiro
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
  // As mesas reservadas vêm do PicoOS, não do Google — então aparecem no
  // calendário mesmo que a agenda do Google não esteja conectada.
  const carregarReservas = async () => {
    try {
      const r = await fetch('/api/reservas', { cache: 'no-store' });
      const j = await r.json();
      setReservas(j.ok && Array.isArray(j.reservas) ? j.reservas : []);
    } catch { setReservas([]); }
  };
  useEffect(() => { carregarAgenda(); carregarReservas(); }, []);

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

  const porDia = useMemo(() => {
    const m = new Map();
    // A reserva que já virou compromisso no Google chegaria duas vezes (uma por
    // aqui, outra pela agenda). Fica valendo a nossa, que sabe quantas pessoas
    // são e traz a observação.
    const idsNoGoogle = new Set(reservas.map((r) => r && r.googleId).filter(Boolean));
    const põe = (d, item) => { if (!m.has(d)) m.set(d, []); m.get(d).push(item); };
    for (const ev of (agenda || [])) {
      const d = (ev.inicio || '').slice(0, 10);
      if (!d || idsNoGoogle.has(ev.id)) continue;
      põe(d, ev);
    }
    for (const r of reservas) {
      if (!r || !r.data) continue;
      const q = Number(r.pessoas) || 1;
      põe(r.data, {
        id: 'reserva-' + r.id,
        titulo: `${r.nome} · ${q} ${q === 1 ? 'pessoa' : 'pessoas'}`,
        inicio: r.hora ? `${r.data}T${r.hora}:00` : r.data,
        diaTodo: !r.hora,
        tarefa: false,
        reserva: true,
        obs: r.obs || '',
      });
    }
    for (const evs of m.values()) evs.sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
    return m;
  }, [agenda, reservas]);
  const diasComEvento = useMemo(() => new Set(porDia.keys()), [porDia]);
  const diasComReserva = useMemo(() => new Set(reservas.map((r) => r && r.data).filter(Boolean)), [reservas]);

  const mes = ymOf(diaSel);
  const cabMes = (() => { const [y, m] = diaSel.split('-'); return `${MESES_LONGOS[Number(m) - 1]}, ${y}`; })();
  const semana = useMemo(() => semanaDe(diaSel), [diaSel]);

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
  const corEvento = (ev) => (ev.reserva ? C.green : ehBoleto(ev) ? C.amber : ev.tarefa ? C.roxo : ev.diaTodo ? C.accent2 : C.accent);
  const etiquetaEvento = (ev) => (ev.reserva ? 'Mesa reservada' : ehBoleto(ev) ? 'A pagar' : ev.tarefa ? 'Tarefa' : ev.diaTodo ? 'Dia todo' : ev.inicio.slice(11, 16));
  const horaEvento = (ev) => (ev.diaTodo || !ev.inicio || ev.inicio.length < 16 ? '' : ev.inicio.slice(11, 16));

  // A lista do dia em forma de linha do tempo: bolinha, fio ligando e o cartão
  // colorido — dá pra ver a sequência do dia sem ler tudo.
  const listaDoDia = (dia) => {
    const evs = porDia.get(dia) || [];
    if (!evs.length) {
      return (
        <div style={{ textAlign: 'center', padding: '22px 10px', border: `1px dashed ${C.line}`, borderRadius: 14, color: C.faint, fontSize: 13, lineHeight: 1.5 }}>
          Nada marcado {dia === hoje ? 'pra hoje' : 'nesse dia'}.<br />
          <span style={{ fontSize: 12 }}>Toque em “+ Novo compromisso” pra marcar.</span>
        </div>
      );
    }
    return (
      <div>
        {evs.map((ev, idx) => {
          const cor = corEvento(ev);
          const ultimo = idx === evs.length - 1;
          return (
            <div key={ev.id} style={{ display: 'flex', gap: 11, alignItems: 'stretch' }}>
              {/* trilho: bolinha do evento + fio até o próximo */}
              <div style={{ width: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 14 }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 999, flexShrink: 0,
                  background: ev.concluida ? cor : 'transparent', border: `3px solid ${cor}`,
                }} />
                {!ultimo && <span style={{ flex: 1, width: 2, background: C.line, borderRadius: 2, marginTop: 4 }} />}
              </div>
              <div style={{
                flex: 1, minWidth: 0, marginBottom: ultimo ? 0 : 10, borderRadius: 14, padding: '11px 14px',
                background: `color-mix(in srgb, ${cor} 13%, transparent)`,
                borderLeft: `3px solid ${cor}`, opacity: ev.concluida ? 0.7 : 1,
              }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: cor, fontVariantNumeric: 'tabular-nums' }}>
                  {horaEvento(ev) || etiquetaEvento(ev)}
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text, lineHeight: 1.35, margin: '3px 0 7px', textDecoration: ev.concluida ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>
                  {ev.titulo}
                  {ev.obs ? <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: C.faint, marginTop: 3, lineHeight: 1.45 }}>{ev.obs}</span> : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: cor, background: `color-mix(in srgb, ${cor} 20%, transparent)`, borderRadius: 999, padding: '3px 10px' }}>
                    {etiquetaEvento(ev)}
                  </span>
                  {ev.tarefa && !ehBoleto(ev) && (
                    <button onClick={() => alternarTarefaAg(ev)} disabled={concluindo === ev.id} title={ev.concluida ? 'Desmarcar' : 'Marcar como feito'}
                      style={{ marginLeft: 'auto', border: `1px solid ${cor}`, background: ev.concluida ? cor : 'transparent', color: ev.concluida ? '#fff' : cor, borderRadius: 999, padding: '4px 13px', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {concluindo === ev.id ? '…' : ev.concluida ? '✓ feito' : 'ok'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const abrirNovo = () => { setEvData(diaSel); setEvErro(''); setNovoAberto(true); };
  const salvarEvento = async () => {
    if (!evTitulo.trim() || salvandoEv) return;
    setSalvandoEv(true); setEvErro('');
    try {
      const r = await fetch('/api/google/criar-evento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: evTitulo.trim(), data: evData, hora: evHora, diaTodo: evDiaTodo }) });
      const j = await r.json();
      if (j.ok) { setNovoAberto(false); setEvTitulo(''); setEvDiaTodo(false); setDiaSel(evData); await carregarAgenda(); await carregarReservas(); }
      else setEvErro(j.erro || 'Não consegui criar o evento.');
    } catch { setEvErro('Não consegui criar o evento.'); }
    setSalvandoEv(false);
  };

  // Antes o calendário sumia quando o Google não estava conectado. Agora, se
  // houver mesa reservada, ele fica: a reserva é do PicoOS e não depende disso.
  if (agenda === null && reservas.length === 0) return null;

  const tituloDoDia = diaSel === hoje ? 'Hoje' : diaSel === addDays(hoje, 1) ? 'Amanhã' : diaSel === addDays(hoje, -1) ? 'Ontem' : `${weekday(diaSel)}, ${fmtDate(diaSel)}`;
  const quantosNoDia = (porDia.get(diaSel) || []).length;

  return (
    <Card style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
      {/* Cabeçalho colorido: o mês, a semana e o dia escolhido */}
      <div style={{ background: `linear-gradient(135deg, ${C.accent} 0%, ${C.roxo} 100%)`, padding: '16px 14px 26px', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button onClick={() => setDiaSel(addDays(diaSel, -7))} aria-label="Semana anterior" style={setaTopo}>‹</button>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cabMes}</div>
          </div>
          <button onClick={() => setDiaSel(addDays(diaSel, 7))} aria-label="Próxima semana" style={setaTopo}>›</button>
        </div>

        {/* Faixa da semana: cada dia é uma pastilha; a escolhida fica branca */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
          {semana.map((d) => {
            const sel = d === diaSel, ehHoje = d === hoje, temEv = diasComEvento.has(d);
            return (
              <button key={d} onClick={() => setDiaSel(d)} style={{
                border: 'none', cursor: 'pointer', borderRadius: 13, padding: '8px 0 7px',
                background: sel ? '#fff' : 'rgba(255,255,255,0.16)',
                color: sel ? C.accent : '#fff',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                boxShadow: !sel && ehHoje ? 'inset 0 0 0 1.5px rgba(255,255,255,0.85)' : 'none',
              }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.06em', opacity: sel ? 0.75 : 0.85 }}>{SEM_CURTO[diaDaSemana(d)]}</span>
                <span style={{ fontSize: 15, fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{Number(d.slice(8))}</span>
                <span style={{ width: 4, height: 4, borderRadius: 999, background: temEv ? (sel ? C.accent : '#fff') : 'transparent' }} />
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
          <button onClick={() => setDiaSel(hoje)} style={pilulaTopo(diaSel === hoje)}>hoje</button>
          <button onClick={() => setMesAberto((v) => !v)} style={pilulaTopo(mesAberto)}>{mesAberto ? 'fechar o mês' : 'ver o mês inteiro'}</button>
        </div>
      </div>

      {/* Folha branca por cima do cabeçalho, como um bloco de anotações */}
      <div style={{ background: C.panel, borderRadius: '20px 20px 0 0', marginTop: -16, position: 'relative', padding: 14 }}>
        {mesAberto && (
          <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.line}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {LETRAS_SEMANA.map((w, i) => (
                <div key={'h' + i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, color: C.faint, paddingBottom: 4 }}>{w}</div>
              ))}
              {celulasMes.map((d, i) => {
                if (!d) return <div key={'c' + i} />;
                const sel = d === diaSel, ehHoje = d === hoje, passado = d < hoje, temEv = diasComEvento.has(d);
                return (
                  <button key={'c' + i} onClick={() => setDiaSel(d)} style={{
                    border: 'none', cursor: 'pointer', position: 'relative', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 11,
                    background: sel ? C.accent : 'transparent', color: sel ? '#fff' : (passado ? C.faint : C.text),
                    boxShadow: !sel && ehHoje ? `inset 0 0 0 1.5px ${C.accent}` : 'none',
                    fontSize: 13, fontWeight: sel || ehHoje ? 800 : 600, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {Number(d.slice(8))}
                    {temEv && !sel && <span style={{ position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: '50%', background: diasComReserva.has(d) ? C.green : C.accent }} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.text, letterSpacing: '-.01em' }}>{tituloDoDia}</div>
          <div style={{ fontSize: 12, color: C.faint, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {quantosNoDia > 0 ? `${quantosNoDia} compromisso(s)` : 'dia livre'}
          </div>
        </div>

        <div className="agenda-dia-lista">{listaDoDia(diaSel)}</div>

        {!novoAberto ? (
          <button onClick={abrirNovo} style={{ marginTop: 14, width: '100%', background: 'transparent', border: `1px dashed ${C.line}`, color: C.accent, borderRadius: 12, padding: '11px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>+ Novo compromisso</button>
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
      </div>
    </Card>
  );
}

const setaTopo = {
  width: 30, height: 30, borderRadius: 10, flexShrink: 0, cursor: 'pointer',
  background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', fontSize: 17, fontWeight: 900, lineHeight: 1,
};
const pilulaTopo = (ativo) => ({
  border: 'none', cursor: 'pointer', borderRadius: 999, padding: '5px 13px', fontSize: 11.5, fontWeight: 800,
  background: ativo ? '#fff' : 'rgba(255,255,255,0.18)', color: ativo ? C.accent : '#fff',
});
