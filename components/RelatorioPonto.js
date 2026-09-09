'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { C, Card, Btn, Empty, SecTitle } from './ui';
import RelogioPonto from './RelogioPonto';
import { fmtDate, todayISO } from '../lib/util';

const norm = (s) => (s || '').trim().toLowerCase();
const horaBR = (iso) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); } catch { return ''; } };
const horasDe = (r) => (r.entrada && r.saida ? Math.max(0, (new Date(r.saida) - new Date(r.entrada)) / 3600000) : 0);
const fmtHoras = (h) => { const t = Math.round(Math.abs(h) * 60); const hh = Math.floor(t / 60), mm = t % 60; return `${hh}h${mm > 0 ? String(mm).padStart(2, '0') : ''}`; };
const SETORES = { cozinha: 'Cozinha', garcom: 'Atendimento', dona: 'Dona' };
const parseHHMM = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? (+m[1] + (+m[2]) / 60) : null; };
// Horas de um turno da jornada (16:00 → 00:00 = 8h; quando vira a meia-noite, soma 24).
const horasJornada = (j) => { const e = parseHHMM(j?.entrada), s = parseHHMM(j?.saida); if (e == null || s == null) return 0; let d = s - e; if (d <= 0) d += 24; return d; };
const MES_NOME = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (ym) => `${MES_NOME[Number(ym.slice(5, 7)) - 1] || ''}/${ym.slice(0, 4)}`;

// Ponto de cada funcionário, mês a mês — pra fechar pagamento e conferir com a
// pessoa. Tem mês próprio (o histórico do ponto não é o mesmo das Finanças) e
// abre turno por turno, com dia, entrada, saída e o total de horas.
export default function RelatorioPonto({ mesInicial }) {
  const [registros, setRegistros] = useState([]);
  const [jornadas, setJornadas] = useState({});
  const [carregado, setCarregado] = useState(false);
  const [mes, setMes] = useState(mesInicial || todayISO().slice(0, 7));
  const [aberto, setAberto] = useState('');
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/ponto', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) {
        setRegistros(Array.isArray(j.registros) ? j.registros : []);
        setJornadas(j.jornadas && typeof j.jornadas === 'object' ? j.jornadas : {});
      }
    } catch { /* sem conexão: mostra vazio */ }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // Os meses que existem no ponto (não os das Finanças) — assim dá pra voltar
  // em qualquer mês em que alguém bateu ponto.
  const meses = useMemo(() => {
    const s = new Set(registros.map((r) => (r.data || '').slice(0, 7)).filter(Boolean));
    s.add(todayISO().slice(0, 7));
    return [...s].sort().reverse();
  }, [registros]);

  // Horas que o setor devia trabalhar NAQUELE mês, pela jornada configurada.
  // No mês corrente conta só os dias já passados — senão a pessoa apareceria
  // devendo por um turno que ainda nem chegou.
  const esperadoNoMes = useCallback((papel) => {
    const j = jornadas[papel];
    if (!j || !Array.isArray(j.dias) || !j.dias.length) return null;
    const hd = horasJornada(j);
    if (!(hd > 0)) return null;
    const [yy, mm] = mes.split('-').map(Number);
    const hojeISO = todayISO();
    const mesAtual = mes === hojeISO.slice(0, 7);
    if (mes > hojeISO.slice(0, 7)) return 0;
    const ultimoDia = new Date(yy, mm, 0).getDate();
    const ate = mesAtual ? Number(hojeISO.slice(8, 10)) - 1 : ultimoDia;
    let total = 0;
    for (let d = 1; d <= ate; d++) {
      if (j.dias.includes(new Date(yy, mm - 1, d).getDay())) total += hd;
    }
    return total;
  }, [jornadas, mes]);

  const pessoas = useMemo(() => {
    const doMes = registros.filter((r) => (r.data || '').slice(0, 7) === mes);
    const map = new Map();
    for (const r of doMes) {
      const k = norm(r.nome);
      if (!k) continue;
      if (!map.has(k)) map.set(k, { nome: r.nome, papel: r.papel || '', horas: 0, turnos: [], dias: new Set(), abertos: 0 });
      const g = map.get(k);
      if (!g.papel && r.papel) g.papel = r.papel;
      if (r.saida) g.horas += horasDe(r); else g.abertos += 1;
      g.dias.add(r.data);
      g.turnos.push(r);
    }
    for (const g of map.values()) {
      g.turnos.sort((a, b) => (a.entrada || '').localeCompare(b.entrada || ''));
      g.esperado = esperadoNoMes(g.papel);
      g.saldo = g.esperado == null ? null : Math.round((g.horas - g.esperado) * 100) / 100;
    }
    return [...map.values()].sort((a, b) => b.horas - a.horas);
  }, [registros, mes, esperadoNoMes]);

  const totalHoras = pessoas.reduce((s, p) => s + p.horas, 0);
  const comSaldo = pessoas.filter((p) => p.saldo != null);
  const totalExtras = comSaldo.reduce((s, p) => s + Math.max(0, p.saldo), 0);
  const totalDevendo = comSaldo.reduce((s, p) => s + Math.max(0, -p.saldo), 0);

  // A etiqueta de saldo: verde pra hora extra, vermelho pra hora devendo.
  const Saldo = ({ saldo }) => {
    if (saldo == null) {
      return <span style={{ fontSize: 11.5, color: C.faint }}>sem jornada configurada</span>;
    }
    if (Math.abs(saldo) < 0.02) return <span style={{ fontSize: 11.5, fontWeight: 700, color: C.muted }}>fechou em dia</span>;
    const positivo = saldo > 0;
    return (
      <span style={{
        fontSize: 11.5, fontWeight: 800, color: positivo ? C.green : C.red,
        border: `1px solid ${positivo ? C.green : C.red}`, borderRadius: 999, padding: '2px 9px',
      }}>{positivo ? '+' : '−'}{fmtHoras(saldo)} {positivo ? 'extras' : 'devendo'}</span>
    );
  };

  const copiar = async () => {
    const linhas = [`Ponto — ${rotuloMes(mes)} · Pico do Mané`, ''];
    for (const p of pessoas) {
      const saldoTxt = p.saldo == null ? ''
        : Math.abs(p.saldo) < 0.02 ? ' — fechou em dia'
          : p.saldo > 0 ? ` — +${fmtHoras(p.saldo)} extras (esperado ${fmtHoras(p.esperado)})`
            : ` — ${fmtHoras(p.saldo)} devendo (esperado ${fmtHoras(p.esperado)})`;
      linhas.push(`${p.nome}${p.papel ? ` (${SETORES[p.papel] || p.papel})` : ''}: ${fmtHoras(p.horas)} em ${p.dias.size} dia(s), ${p.turnos.length} turno(s)${saldoTxt}`);
    }
    linhas.push('', `Total: ${fmtHoras(totalHoras)}`);
    try {
      await navigator.clipboard.writeText(linhas.join('\n'));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch { /* sem permissão de área de transferência */ }
  };

  return (
    <div style={{ marginTop: 22 }}>
      <SecTitle>Ponto da equipe</SecTitle>

      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '2px 0 10px' }}>
        {meses.map((m) => (
          <button key={m} onClick={() => { setMes(m); setAberto(''); }} style={{
            flexShrink: 0, border: `1px solid ${m === mes ? C.accent : C.line}`, cursor: 'pointer',
            background: m === mes ? C.accent : 'transparent', color: m === mes ? '#06101F' : C.muted,
            borderRadius: 999, padding: '6px 14px', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
          }}>{rotuloMes(m)}</button>
        ))}
      </div>

      {!carregado ? <Empty>Carregando o ponto…</Empty>
        : pessoas.length === 0 ? <Empty>Ninguém bateu ponto em {rotuloMes(mes)}.</Empty> : (
          <>
            {pessoas.map((p) => {
              const abertoAqui = aberto === norm(p.nome);
              return (
                <Card key={p.nome} style={{ marginBottom: 8, padding: 14 }}>
                  <button onClick={() => setAberto(abertoAqui ? '' : norm(p.nome))} style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
                        <span style={{ color: C.accent, fontSize: 12, marginRight: 6 }}>{abertoAqui ? '▾' : '▸'}</span>{p.nome}
                      </span>
                      <span style={{ display: 'block', fontSize: 12, color: C.faint, marginTop: 3 }}>
                        {p.papel ? `${SETORES[p.papel] || p.papel} · ` : ''}{p.dias.size} dia(s) · {p.turnos.length} turno(s)
                        {p.abertos > 0 ? ` · ${p.abertos} sem saída registrada` : ''}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        <Saldo saldo={p.saldo} />
                        {p.esperado != null && (
                          <span style={{ fontSize: 11.5, color: C.faint }}>esperado {fmtHoras(p.esperado)}</span>
                        )}
                      </span>
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 800, color: C.accent, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmtHoras(p.horas)}</span>
                  </button>

                  {abertoAqui && (
                    <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
                      {/* Como a pessoa fechou o mês, em desenho: verde fechou as
                          horas, vermelho ainda falta. */}
                      <div style={{ padding: '10px 0 14px' }}>
                        <RelogioPonto horas={p.horas} esperado={p.esperado} tamanho={166} />
                      </div>
                      {p.turnos.map((r) => (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', fontSize: 13, borderTop: `1px solid ${C.hair}` }}>
                          <span style={{ color: C.muted }}>
                            {fmtDate(r.data)} · {horaBR(r.entrada)}{r.saida ? `–${horaBR(r.saida)}` : ' · em aberto'}
                            {r.manual ? <span style={{ color: C.faint }}> · lançado à mão</span> : null}
                          </span>
                          <b style={{ color: r.saida ? C.text : C.amber, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{r.saida ? fmtHoras(horasDe(r)) : '—'}</b>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}

            <Card style={{ marginTop: 4, background: C.panel2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
                Total do mês <span style={{ color: C.faint, fontWeight: 500 }}>· {pessoas.length} pessoa(s)</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <b style={{ fontSize: 18, color: C.accent, fontVariantNumeric: 'tabular-nums' }}>{fmtHoras(totalHoras)}</b>
                <Btn kind="ghost" small onClick={copiar}>{copiado ? 'copiado!' : 'copiar resumo'}</Btn>
              </span>
              {comSaldo.length > 0 && (totalExtras > 0.02 || totalDevendo > 0.02) && (
                <span style={{ width: '100%', fontSize: 12.5, color: C.muted, borderTop: `1px solid ${C.hair}`, paddingTop: 8 }}>
                  Somando a equipe: <b style={{ color: C.green }}>{fmtHoras(totalExtras)} de hora extra</b> e{' '}
                  <b style={{ color: C.red }}>{fmtHoras(totalDevendo)} devendo</b>.
                </span>
              )}
            </Card>

            <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.5, marginTop: 10 }}>
              O saldo compara as horas batidas com a <b style={{ color: C.muted }}>jornada do setor</b> (que tu configura na aba Ponto). No mês corrente, conta só os dias que já passaram. As horas contam só os turnos com <b style={{ color: C.muted }}>entrada e saída</b> batidas. Turno esquecido em aberto aparece como “sem saída registrada” e não entra na soma — dá pra corrigir na aba Ponto.
            </div>
          </>
        )}
    </div>
  );
}
