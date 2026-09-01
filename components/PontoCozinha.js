'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { C, Card, Btn, Field, TextInput, Empty, SecTitle, KPI } from './ui';
import { mesLabel, fmtDate } from '../lib/util';

const norm = (s) => (s || '').trim().toLowerCase();
const horaBR = (iso) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); } catch { return ''; } };
const hojeBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const horasDe = (r) => (r.entrada && r.saida ? Math.max(0, (new Date(r.saida) - new Date(r.entrada)) / 3600000) : 0);
const fmtHoras = (h) => { const t = Math.round(Math.abs(h) * 60); const hh = Math.floor(t / 60), mm = t % 60; return `${hh}h${mm > 0 ? ` ${mm}min` : ''}`; };
const parseHHMM = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? (+m[1] + (+m[2]) / 60) : null; };
const horasJornada = (j) => { const e = parseHHMM(j?.entrada), s = parseHHMM(j?.saida); if (e == null || s == null) return 0; let d = s - e; if (d <= 0) d += 24; return d; };

// Ponto da cozinha (por pessoa): escreve o nome, bate Entrada ao chegar e Saída
// ao sair. A dona vê as horas no painel dela.
export default function PontoCozinha() {
  const [registros, setRegistros] = useState([]);
  const [jornadas, setJornadas] = useState({});
  const [papel, setPapel] = useState('');
  const [nome, setNome] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [carregado, setCarregado] = useState(false);
  const [verTurnos, setVerTurnos] = useState({});

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/ponto', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) { setRegistros(Array.isArray(j.registros) ? j.registros : []); setJornadas(j.jornadas && typeof j.jornadas === 'object' ? j.jornadas : {}); setPapel(j.papel || ''); }
    } catch { /* offline */ }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // Se o setor já tem UM nome conhecido, preenche sozinho (uma vez) — a pessoa
  // só toca em Entrada/Saída, sem redigitar e sem risco de escrever diferente.
  const preencheu = useRef(false);
  useEffect(() => {
    if (preencheu.current || !carregado) return;
    const nomes = [...new Set(registros.map((r) => r.nome).filter(Boolean))];
    if (nomes.length === 1) { setNome(nomes[0]); preencheu.current = true; }
  }, [carregado, registros]);

  const hoje = hojeBR();
  const doDia = registros.filter((r) => r.data === hoje);
  // Nome fixo do setor (a dona cadastra) — quando existe, a pessoa não digita nada.
  const nomeFixo = (jornadas[papel] && jornadas[papel].nome) ? jornadas[papel].nome : '';
  const nomeAtivo = nomeFixo || nome.trim();
  const abertoDoNome = nomeAtivo ? registros.find((r) => !r.saida && norm(r.nome) === norm(nomeAtivo)) : null;
  const trabalhandoAgora = registros.filter((r) => !r.saida);
  // Junta grafias diferentes do mesmo nome (FRANCINE/Francine) num botão só.
  const nomesRecentes = useMemo(() => {
    const vis = new Map();
    for (const r of registros) {
      const n = (r.nome || '').trim(); if (!n) continue;
      const k = norm(n);
      if (!vis.has(k)) vis.set(k, n.replace(/\s+/g, ' ').replace(/(^|\s)([\p{L}])/gu, (m, sp, c) => sp + c.toUpperCase()));
    }
    return [...vis.values()].slice(0, 6);
  }, [registros]);

  // Folha do mês: horas por pessoa neste mês + saldo (em haver / devendo) contra
  // a jornada do setor. A API já manda só o ponto deste setor.
  const ym = hoje.slice(0, 7);
  const esperadoMes = useMemo(() => {
    const j = jornadas[papel];
    if (!j || !Array.isArray(j.dias) || !j.dias.length) return null;
    const hd = horasJornada(j);
    const [yy, mm] = hoje.split('-').map(Number);
    const diaHoje = Number(hoje.slice(8, 10));
    let total = 0;
    for (let d = 1; d < diaHoje; d++) { if (j.dias.includes(new Date(yy, mm - 1, d).getDay())) total += hd; }
    return total;
  }, [jornadas, papel, hoje]);
  const pessoasMes = useMemo(() => {
    const map = new Map();
    for (const r of registros.filter((r) => (r.data || '').slice(0, 7) === ym)) {
      const k = norm(r.nome);
      if (!map.has(k)) map.set(k, { nome: r.nome, horas: 0, turnos: [] });
      const g = map.get(k); g.horas += horasDe(r); g.turnos.push(r);
    }
    for (const g of map.values()) g.turnos.sort((a, b) => (b.entrada || '').localeCompare(a.entrada || ''));
    return [...map.values()].sort((a, b) => b.horas - a.horas);
  }, [registros, ym]);
  const totalMes = pessoasMes.reduce((s, p) => s + p.horas, 0);
  const Saldo = ({ horas }) => {
    if (esperadoMes == null) return null;
    const saldo = horas - esperadoMes;
    const emDia = Math.abs(saldo) < 0.05;
    const cor = emDia ? C.muted : saldo > 0 ? C.green : C.red;
    const rot = emDia ? 'em dia' : saldo > 0 ? `+${fmtHoras(saldo)} em haver` : `−${fmtHoras(saldo)} devendo`;
    return <div style={{ fontSize: 12, fontWeight: 800, color: cor, marginTop: 2 }}>{rot} <span style={{ color: C.faint, fontWeight: 500 }}>· esperado {fmtHoras(esperadoMes)}</span></div>;
  };

  const bater = async (acao) => {
    const n = nomeFixo || nome.trim();
    if (!n) { setErro('Escreva seu nome primeiro.'); return; }
    setBusy(true); setErro(''); setMsg('');
    try {
      const r = await fetch('/api/ponto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, nome: n }) });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Não consegui registrar.'); }
      else { setMsg(acao === 'entrada' ? `Entrada registrada — bom trabalho, ${n}! 👋` : `Saída registrada. Até logo, ${n}! 👋`); setNome(''); await carregar(); }
    } catch { setErro('Sem conexão.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Ponto</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Ao chegar, escreva seu nome e toque em <b style={{ color: C.text }}>Entrada</b>. Ao ir embora, toque em <b style={{ color: C.text }}>Saída</b>.</div>
      </Card>

      {msg && <Card style={{ marginBottom: 12, borderColor: C.green }}><div style={{ color: C.green, fontSize: 14, fontWeight: 700 }}>{msg}</div></Card>}
      {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{erro}</div>}

      <Card style={{ marginBottom: 14 }}>
        {nomeFixo ? (
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>Olá, {nomeFixo} 👋</div>
        ) : (
        <><Field label="Seu nome"><TextInput value={nome} onChange={setNome} placeholder="Ex.: Maria" /></Field>
        {nomesRecentes.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: C.faint, marginBottom: 6 }}>Toque no seu nome (evita escrever diferente):</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {nomesRecentes.map((n) => {
                const sel = norm(n) === norm(nome);
                return (
                  <button key={n} onClick={() => { setNome(n); setErro(''); }} style={{ border: `1px solid ${sel ? C.accent : C.line}`, background: sel ? C.accent : 'transparent', color: sel ? '#06101F' : C.muted, borderRadius: 999, padding: '7px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{n}</button>
                );
              })}
            </div>
          </>
        )}
        </>
        )}
        {abertoDoNome ? (
          <>
            <div style={{ fontSize: 13, color: C.amber, fontWeight: 700, marginBottom: 8 }}>Entrada às {horaBR(abertoDoNome.entrada)} — em trabalho.</div>
            <Btn kind="danger" onClick={() => bater('saida')} disabled={busy}>{busy ? '…' : 'Registrar Saída'}</Btn>
          </>
        ) : (
          <Btn kind="ok" onClick={() => bater('entrada')} disabled={busy}>{busy ? '…' : 'Registrar Entrada'}</Btn>
        )}
      </Card>

      {trabalhandoAgora.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: C.green }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Trabalhando agora ({trabalhandoAgora.length})</div>
          {trabalhandoAgora.map((r) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14, padding: '4px 0' }}>
              <span style={{ fontWeight: 700 }}>{r.nome}</span>
              <span style={{ color: C.muted }}>desde {horaBR(r.entrada)}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Minha folha do mês: cada setor vê só a sua (a API já filtra). */}
      {carregado && pessoasMes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SecTitle>Minha folha · {mesLabel(ym)}</SecTitle>
          <div style={{ marginBottom: 10 }}>
            <KPI titulo="Horas no mês" valor={fmtHoras(totalMes)} cor={C.accent} sub={`${pessoasMes.reduce((s, p) => s + p.turnos.length, 0)} turno(s)`} />
          </div>
          {pessoasMes.map((p) => {
            const ab = !!verTurnos[norm(p.nome)];
            return (
              <div key={p.nome} style={{ marginBottom: 8 }}>
                <button onClick={() => setVerTurnos((m) => ({ ...m, [norm(p.nome)]: !m[norm(p.nome)] }))} style={{ width: '100%', textAlign: 'left', background: C.panel, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: C.accent, fontSize: 12, fontWeight: 800, width: 12, flexShrink: 0 }}>{ab ? '▾' : '▸'}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{p.nome}</span>
                    <span style={{ fontSize: 12, color: C.faint, display: 'block' }}>{p.turnos.length} turno(s)</span>
                    <Saldo horas={p.horas} />
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: C.accent, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmtHoras(p.horas)}</span>
                </button>
                {ab && (
                  <div style={{ marginTop: 6 }}>
                    {p.turnos.map((r) => (
                      <Card key={r.id} style={{ marginBottom: 6, padding: '9px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13 }}>
                          <span><b>{fmtDate(r.data)}</b> · {horaBR(r.entrada)} → {r.saida ? horaBR(r.saida) : 'em trabalho'}</span>
                          <b style={{ color: C.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{r.saida ? fmtHoras(horasDe(r)) : '—'}</b>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {esperadoMes == null && <div style={{ fontSize: 12, color: C.faint }}>A saldo (em haver/devendo) aparece quando a Karen configurar a jornada do setor.</div>}
        </div>
      )}

      <SecTitle>Pontos de hoje ({doDia.length})</SecTitle>
      {!carregado ? <Empty>Carregando…</Empty> : doDia.length === 0 ? <Empty>Nenhum ponto batido hoje ainda.</Empty> : doDia.map((r) => (
        <Card key={r.id} style={{ marginBottom: 8, padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700 }}>{r.nome}</span>
            <span style={{ fontSize: 13, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{horaBR(r.entrada)} → {r.saida ? horaBR(r.saida) : 'em trabalho'}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
