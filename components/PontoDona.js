'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { C, Card, Btn, Empty, SecTitle, PageTitle, KPI } from './ui';
import { fmtDate, todayISO } from '../lib/util';

const norm = (s) => (s || '').trim().toLowerCase();
const horaBR = (iso) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); } catch { return ''; } };
const horasDe = (r) => (r.entrada && r.saida ? Math.max(0, (new Date(r.saida) - new Date(r.entrada)) / 3600000) : 0);
const fmtHoras = (h) => { const t = Math.round(Math.abs(h) * 60); const hh = Math.floor(t / 60), mm = t % 60; return `${hh}h${mm > 0 ? ` ${mm}min` : ''}`; };

// Setores que batem ponto e têm jornada esperada. 'garcom' aparece como Atendimento.
const SETORES = [['cozinha', 'Cozinha'], ['garcom', 'Atendimento']];
const DIAS = [[0, 'Dom'], [1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb']];
const parseHHMM = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? (+m[1] + (+m[2]) / 60) : null; };
// Horas de um turno da jornada (16:00 → 00:00 = 8h; vira a meia-noite soma 24).
const horasJornada = (j) => { const e = parseHHMM(j?.entrada), s = parseHHMM(j?.saida); if (e == null || s == null) return 0; let d = s - e; if (d <= 0) d += 24; return d; };

// Ponto na visão da DONA: horas trabalhadas por pessoa no mês + saldo (em haver /
// devendo) contra a jornada esperada do setor. A dona configura a jornada aqui.
export default function PontoDona() {
  const [registros, setRegistros] = useState([]);
  const [jornadas, setJornadas] = useState({});
  const [carregado, setCarregado] = useState(false);
  const [aberto, setAberto] = useState('');
  const [busy, setBusy] = useState(false);
  const [configAberto, setConfigAberto] = useState(false);
  const [form, setForm] = useState({}); // cópia editável das jornadas
  const [msg, setMsg] = useState('');
  const [lancarAberto, setLancarAberto] = useState(false);
  const [lanc, setLanc] = useState({ nome: '', setor: 'cozinha', data: '', entrada: '16:00', saida: '00:00' });
  const [msgLanc, setMsgLanc] = useState('');

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/ponto', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) { setRegistros(Array.isArray(j.registros) ? j.registros : []); setJornadas(j.jornadas && typeof j.jornadas === 'object' ? j.jornadas : {}); }
    } catch { /* offline */ }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const excluir = async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Apagar este registro de ponto?')) return;
    setBusy(true);
    try { await fetch('/api/ponto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'excluir', id }) }); await carregar(); }
    catch { /* ignora */ }
    finally { setBusy(false); }
  };

  // ---- Config da jornada ----
  const abrirConfig = () => {
    const base = {};
    for (const [k] of SETORES) base[k] = jornadas[k] ? { nome: jornadas[k].nome || '', dias: [...(jornadas[k].dias || [])], entrada: jornadas[k].entrada || '16:00', saida: jornadas[k].saida || '00:00' } : { nome: '', dias: [], entrada: '16:00', saida: '00:00' };
    setForm(base); setMsg(''); setConfigAberto(true);
  };
  const toggleDia = (setor, d) => setForm((f) => {
    const j = f[setor] || { dias: [], entrada: '16:00', saida: '00:00' };
    const dias = j.dias.includes(d) ? j.dias.filter((x) => x !== d) : [...j.dias, d].sort((a, b) => a - b);
    return { ...f, [setor]: { ...j, dias } };
  });
  const setHora = (setor, campo, v) => setForm((f) => ({ ...f, [setor]: { ...(f[setor] || { dias: [], entrada: '16:00', saida: '00:00' }), [campo]: v } }));
  const salvarJornadas = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/ponto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'jornadas', jornadas: form }) });
      const j = await r.json();
      if (j.ok) { setJornadas(j.jornadas || {}); setMsg('Jornada salva!'); setConfigAberto(false); }
      else setMsg(j.erro || 'Não consegui salvar.');
    } catch { setMsg('Sem conexão.'); }
    finally { setBusy(false); }
  };

  // ---- Lançar turno passado (dias que faltaram) ----
  const nomesConhecidos = useMemo(() => [...new Set(registros.map((r) => r.nome).filter(Boolean))], [registros]);
  const abrirLancar = () => {
    const j = jornadas.cozinha;
    setLanc({ nome: '', setor: 'cozinha', data: todayISO(), entrada: j?.entrada || '16:00', saida: j?.saida || '00:00' });
    setMsgLanc(''); setLancarAberto(true);
  };
  const setLancSetor = (setor) => setLanc((l) => { const j = jornadas[setor]; return { ...l, setor, entrada: j?.entrada || l.entrada, saida: j?.saida || l.saida }; });
  const lancarTurno = async () => {
    if (!lanc.nome.trim() || !lanc.data) { setMsgLanc('Preencha o nome e o dia.'); return; }
    setBusy(true); setMsgLanc('');
    try {
      const r = await fetch('/api/ponto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'lancar', nome: lanc.nome.trim(), setor: lanc.setor, data: lanc.data, entrada: lanc.entrada, saida: lanc.saida }) });
      const j = await r.json();
      if (j.ok) { setMsgLanc('Turno lançado! Troque o dia e lance o próximo.'); await carregar(); }
      else setMsgLanc(j.erro || 'Não consegui lançar.');
    } catch { setMsgLanc('Sem conexão.'); }
    finally { setBusy(false); }
  };

  const ym = todayISO().slice(0, 7);
  // Horas esperadas do setor no mês, contando só os dias JÁ PASSADOS (antes de
  // hoje), pra não marcar "devendo" por um turno que ainda nem aconteceu.
  const esperadoDoPapel = useCallback((papel) => {
    const j = jornadas[papel];
    if (!j || !Array.isArray(j.dias) || !j.dias.length) return null;
    const hd = horasJornada(j);
    const hojeISO = todayISO();
    const [yy, mm] = hojeISO.split('-').map(Number);
    const diaHoje = Number(hojeISO.slice(8, 10));
    let total = 0;
    for (let d = 1; d < diaHoje; d++) {
      const wd = new Date(yy, mm - 1, d).getDay();
      if (j.dias.includes(wd)) total += hd;
    }
    return total;
  }, [jornadas]);

  const pessoas = useMemo(() => {
    const doMes = registros.filter((r) => (r.data || '').slice(0, 7) === ym);
    const map = new Map();
    for (const r of doMes) {
      const k = norm(r.nome);
      if (!map.has(k)) map.set(k, { nome: r.nome, horas: 0, turnos: [], papel: r.papel || '' });
      const g = map.get(k);
      if (!g.papel && r.papel) g.papel = r.papel;
      g.horas += horasDe(r);
      g.turnos.push(r);
    }
    for (const g of map.values()) g.turnos.sort((a, b) => (b.entrada || '').localeCompare(a.entrada || ''));
    return [...map.values()].sort((a, b) => b.horas - a.horas);
  }, [registros, ym]);

  const totalHoras = pessoas.reduce((s, p) => s + p.horas, 0);
  const trabalhandoAgora = registros.filter((r) => !r.saida);
  const rotuloSetor = (papel) => (SETORES.find(([k]) => k === papel)?.[1] || '');

  // Etiqueta de saldo (em haver / devendo / em dia) pra uma pessoa.
  const Saldo = ({ papel, horas }) => {
    const esp = esperadoDoPapel(papel);
    if (esp == null) return null; // sem jornada configurada pra esse setor
    const saldo = horas - esp;
    const emDia = Math.abs(saldo) < 0.05;
    const cor = emDia ? C.muted : saldo > 0 ? C.green : C.red;
    const rot = emDia ? 'em dia' : saldo > 0 ? `+${fmtHoras(saldo)} em haver` : `−${fmtHoras(saldo)} devendo`;
    return <span style={{ fontSize: 11, fontWeight: 800, color: cor, display: 'block' }}>{rot} <span style={{ color: C.faint, fontWeight: 500 }}>· esperado {fmtHoras(esp)}</span></span>;
  };

  return (
    <div>
      <PageTitle sub="Horas da equipe neste mês — a equipe bate o ponto, você acompanha aqui">Ponto</PageTitle>

      <KPI titulo="Horas no mês" valor={fmtHoras(totalHoras)} cor={C.accent} sub={`${pessoas.length} pessoa(s)`} />

      {/* Configurar a jornada esperada de cada setor */}
      <div style={{ margin: '14px 0' }}>
        {!configAberto ? (
          <button onClick={abrirConfig} style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Configurar jornada (horas esperadas)
          </button>
        ) : (
          <Card style={{ padding: 14, borderColor: C.accent }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>Jornada esperada</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.45 }}>Marque os dias e o horário de cada setor. O app usa isso pra calcular quem está <b style={{ color: C.green }}>em haver</b> (a mais) ou <b style={{ color: C.red }}>devendo</b> (a menos).</div>
            {SETORES.map(([k, rot]) => {
              const j = form[k] || { dias: [], entrada: '16:00', saida: '00:00' };
              const h = horasJornada(j);
              return (
                <div key={k} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12, marginTop: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>{rot}</div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, marginBottom: 4 }}>Nome do funcionário</div>
                    <input value={j.nome || ''} onChange={(e) => setForm((f) => ({ ...f, [k]: { ...(f[k] || { dias: [], entrada: '16:00', saida: '00:00' }), nome: e.target.value } }))} placeholder="Ex.: Francine" style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 8, padding: '9px 10px', fontSize: 14, width: '100%', boxSizing: 'border-box' }} />
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>A tela de Ponto dela já vem com esse nome — ela só toca em Entrada/Saída.</div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {DIAS.map(([d, dr]) => {
                      const on = j.dias.includes(d);
                      return (
                        <button key={d} onClick={() => toggleDia(k, d)} style={{ border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accent : 'transparent', color: on ? '#06101F' : C.muted, borderRadius: 999, padding: '7px 11px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{dr}</button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 13, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>Entra
                      <input type="time" value={j.entrada} onChange={(e) => setHora(k, 'entrada', e.target.value)} style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 8, padding: '6px 8px', fontSize: 14 }} />
                    </label>
                    <label style={{ fontSize: 13, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>Sai
                      <input type="time" value={j.saida} onChange={(e) => setHora(k, 'saida', e.target.value)} style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 8, padding: '6px 8px', fontSize: 14 }} />
                    </label>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{j.dias.length ? `${j.dias.length} dia(s) × ${fmtHoras(h)} = ${fmtHoras(h * j.dias.length)}/semana` : 'sem dias'}</span>
                  </div>
                </div>
              );
            })}
            {msg && <div style={{ fontSize: 13, color: msg.includes('salva') ? C.green : C.red, marginTop: 10 }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Btn onClick={salvarJornadas} disabled={busy}>{busy ? 'Salvando…' : 'Salvar jornada'}</Btn>
              <Btn kind="ghost" onClick={() => setConfigAberto(false)}>Cancelar</Btn>
            </div>
          </Card>
        )}
      </div>

      {/* Lançar turno passado (dias que faltaram antes de começar a bater ponto) */}
      <div style={{ marginBottom: 14 }}>
        {!lancarAberto ? (
          <button onClick={abrirLancar} style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + Lançar turno que faltou (semanas anteriores)
          </button>
        ) : (() => {
          const inp = { background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 8, padding: '9px 10px', fontSize: 14, width: '100%' };
          const h = horasJornada({ entrada: lanc.entrada, saida: lanc.saida });
          return (
            <Card style={{ padding: 14, borderColor: C.accent }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>Lançar turno à mão</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.45 }}>Pra registrar os dias que a equipe trabalhou <b style={{ color: C.text }}>antes</b> de começar a bater ponto. Preencha e salve; dá pra lançar vários dias seguidos (é só trocar o dia).</div>
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, marginBottom: 4 }}>Quem</div>
                  <input list="nomes-ponto" value={lanc.nome} onChange={(e) => setLanc((l) => ({ ...l, nome: e.target.value }))} placeholder="Nome" style={inp} />
                  <datalist id="nomes-ponto">{nomesConhecidos.map((n) => <option key={n} value={n} />)}</datalist>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, marginBottom: 4 }}>Setor</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {SETORES.map(([k, rot]) => (
                      <button key={k} onClick={() => setLancSetor(k)} style={{ flex: 1, border: `1px solid ${lanc.setor === k ? C.accent : C.line}`, background: lanc.setor === k ? C.accent : 'transparent', color: lanc.setor === k ? '#06101F' : C.muted, borderRadius: 9, padding: '9px 8px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{rot}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, marginBottom: 4 }}>Dia</div>
                  <input type="date" value={lanc.data} max={todayISO()} onChange={(e) => setLanc((l) => ({ ...l, data: e.target.value }))} style={inp} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <label style={{ flex: 1, fontSize: 12, color: C.muted, fontWeight: 700 }}>Entrou<input type="time" value={lanc.entrada} onChange={(e) => setLanc((l) => ({ ...l, entrada: e.target.value }))} style={{ ...inp, marginTop: 4 }} /></label>
                  <label style={{ flex: 1, fontSize: 12, color: C.muted, fontWeight: 700 }}>Saiu<input type="time" value={lanc.saida} onChange={(e) => setLanc((l) => ({ ...l, saida: e.target.value }))} style={{ ...inp, marginTop: 4 }} /></label>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>Esse turno = {fmtHoras(h)}</div>
              </div>
              {msgLanc && <div style={{ fontSize: 13, color: msgLanc.includes('lançado') ? C.green : C.red, marginTop: 10 }}>{msgLanc}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <Btn onClick={lancarTurno} disabled={busy}>{busy ? 'Lançando…' : 'Lançar turno'}</Btn>
                <Btn kind="ghost" onClick={() => setLancarAberto(false)}>Fechar</Btn>
              </div>
            </Card>
          );
        })()}
      </div>

      {trabalhandoAgora.length > 0 && (
        <Card style={{ margin: '14px 0', borderColor: C.green }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: C.green }}>Trabalhando agora ({trabalhandoAgora.length})</div>
          {trabalhandoAgora.map((r) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14, padding: '4px 0' }}>
              <span style={{ fontWeight: 700 }}>{r.nome}{rotuloSetor(r.papel) ? <span style={{ color: C.faint, fontWeight: 500 }}> · {rotuloSetor(r.papel)}</span> : null}</span>
              <span style={{ color: C.muted }}>desde {fmtDate(r.data)} {horaBR(r.entrada)}</span>
            </div>
          ))}
        </Card>
      )}

      <SecTitle>Por pessoa (este mês)</SecTitle>
      {!carregado ? <Empty>Carregando…</Empty> : pessoas.length === 0 ? (
        <Empty>Nenhum ponto batido este mês.<br />A equipe registra na aba Ponto do login dela.</Empty>
      ) : pessoas.map((p) => {
        const ab = aberto === norm(p.nome);
        return (
          <div key={p.nome} style={{ marginBottom: 10 }}>
            <button onClick={() => setAberto(ab ? '' : norm(p.nome))} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: C.panel, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '13px 14px', cursor: 'pointer', textAlign: 'left', boxShadow: C.cardShadow }}>
              <span style={{ color: C.accent, fontSize: 12, fontWeight: 800, width: 12, flexShrink: 0 }}>{ab ? '▾' : '▸'}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{p.nome}{rotuloSetor(p.papel) ? <span style={{ color: C.faint, fontWeight: 500, fontSize: 12 }}> · {rotuloSetor(p.papel)}</span> : null}</span>
                <span style={{ fontSize: 12, color: C.faint, display: 'block' }}>{p.turnos.length} turno(s)</span>
                <Saldo papel={p.papel} horas={p.horas} />
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.accent, flexShrink: 0 }}>{fmtHoras(p.horas)}</span>
            </button>
            {ab && (
              <div style={{ marginTop: 8 }}>
                {p.turnos.map((r) => (
                  <Card key={r.id} style={{ marginBottom: 6, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13 }}>
                        <b>{fmtDate(r.data)}</b> · {horaBR(r.entrada)} → {r.saida ? horaBR(r.saida) : 'em trabalho'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <b style={{ fontSize: 13, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{r.saida ? fmtHoras(horasDe(r)) : '—'}</b>
                        <button onClick={() => excluir(r.id)} disabled={busy} title="Apagar" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
