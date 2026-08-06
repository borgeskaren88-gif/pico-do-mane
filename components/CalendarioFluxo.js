'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { C, Card, NumInput } from './ui';
import { num, brl, todayISO, fmtDate, limparNome, MESES } from '../lib/util';

const pad = (n) => String(n).padStart(2, '0');
const DIAS_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// Bolinha colorida da legenda (substitui os quadradinhos coloridos).
const Ponto = ({ cor }) => (
  <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 999, background: cor, marginRight: 4, flexShrink: 0 }} />
);

// Calendário de fluxo de caixa: cruza as contas a pagar (abertas) com os dias de
// vencimento, pintando cada dia pela soma a pagar e resumindo por semana — pra
// ver de relance as semanas em que o dinheiro aperta.
export default function CalendarioFluxo({ contas }) {
  const hoje = todayISO();
  const [ref, setRef] = useState(hoje.slice(0, 7)); // 'YYYY-MM'

  // Limite (R$) definido pela dona pra quando o dia fica vermelho. Fica salvo
  // no aparelho. Vazio/0 = automático (compara com o dia típico do mês).
  const [limiteStr, setLimiteStr] = useState('');
  useEffect(() => { try { const v = localStorage.getItem('pdm_fluxoLimite'); if (v != null) setLimiteStr(v); } catch { } }, []);
  const setLimite = (v) => { setLimiteStr(v); try { localStorage.setItem('pdm_fluxoLimite', v); } catch { } };
  const limite = num(limiteStr);

  // Dia selecionado (ao tocar num dia com boleto, mostra os fornecedores).
  const [selecionado, setSelecionado] = useState(null);

  const porDia = useMemo(() => {
    const m = {};
    for (const c of contas) {
      if (!c.vencimento) continue;
      m[c.vencimento] = (m[c.vencimento] || 0) + num(c.quantidade) * num(c.valorUnit);
    }
    return m;
  }, [contas]);

  // Itens agrupados por dia, pra mostrar os nomes ao tocar num dia.
  const itensPorDia = useMemo(() => {
    const m = {};
    for (const c of contas) {
      if (!c.vencimento) continue;
      (m[c.vencimento] = m[c.vencimento] || []).push(c);
    }
    return m;
  }, [contas]);

  // Fornecedores do dia selecionado (soma itens do mesmo fornecedor).
  const detalhe = useMemo(() => {
    if (!selecionado) return null;
    const map = new Map();
    for (const c of (itensPorDia[selecionado] || [])) {
      const nome = limparNome(c.fornecedor) || limparNome(c.produto) || 'Conta';
      const g = map.get(nome) || { nome, total: 0, nota: (c.nota || '').trim() };
      g.total += num(c.quantidade) * num(c.valorUnit);
      map.set(nome, g);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [selecionado, itensPorDia]);

  const [ano, mes] = ref.split('-').map(Number); // mes 1-12
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay(); // 0=Dom
  const diasNoMes = new Date(ano, mes, 0).getDate();

  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d);
  while (celulas.length % 7 !== 0) celulas.push(null);
  const semanas = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));

  const isoDe = (d) => `${ano}-${pad(mes)}-${pad(d)}`;
  const totalDia = (d) => (d ? (porDia[isoDe(d)] || 0) : 0);
  const maxDia = Math.max(1, ...celulas.map(totalDia));
  const totalSemana = (sem) => sem.reduce((s, d) => s + totalDia(d), 0);
  const maxSemana = Math.max(1, ...semanas.map(totalSemana));
  const totalMes = celulas.reduce((s, d) => s + totalDia(d), 0);
  const diasComConta = celulas.filter((d) => totalDia(d) > 0).length;
  const mediaDia = diasComConta ? totalMes / diasComConta : 0;
  const semanasComConta = semanas.filter((s) => totalSemana(s) > 0).length;
  const mediaSemana2 = semanasComConta ? totalMes / semanasComConta : 0;

  const mudarMes = (delta) => {
    let a = ano, m = mes + delta;
    if (m < 1) { m = 12; a--; } else if (m > 12) { m = 1; a++; }
    setRef(`${a}-${pad(m)}`);
    setSelecionado(null);
  };

  // Intensidade de azul: quanto mais a pagar no dia, mais forte o azul. Se você
  // definir um limite (R$), o azul "enche" ao chegar nele; senão compara com o
  // maior dia do mês. Assim dá pra ver de relance os dias que mais pesam.
  const intensidade = (t) => {
    if (t <= 0) return 0;
    return limite > 0 ? Math.min(1, t / limite) : t / maxDia;
  };
  const azul = (pct) => `color-mix(in srgb, ${C.accent} ${pct}%, transparent)`;
  const compacto = (n) => (n >= 1000 ? (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k' : String(Math.round(n)));
  const corDia = (t) => (t <= 0 ? azul(6) : azul(Math.round(16 + 60 * intensidade(t))));
  const btn = { background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, fontWeight: 800, lineHeight: 1 };

  return (
    <Card style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>Fluxo de caixa</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => mudarMes(-1)} style={btn} aria-label="Mês anterior">‹</button>
          <div style={{ minWidth: 96, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{MESES[mes - 1]}/{ano}</div>
          <button onClick={() => mudarMes(1)} style={btn} aria-label="Próximo mês">›</button>
        </div>
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
        A pagar no mês: <b style={{ color: totalMes > 0 ? C.text : C.faint }}>{brl(totalMes)}</b> · a cor mostra o quanto o dia aperta.
      </div>

      {/* Cabeçalho dos dias da semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {DIAS_CURTO.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: '.03em', fontWeight: 700 }}>{d}</div>
        ))}
      </div>

      {/* Grade do mês */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {celulas.map((d, i) => {
          if (!d) return <div key={i} />;
          const t = totalDia(d);
          const iso = isoDe(d);
          const ehHoje = iso === hoje;
          const vencido = t > 0 && iso < hoje;
          const temConta = t > 0;
          const sel = selecionado === iso;
          return (
            <div key={i}
              onClick={temConta ? () => setSelecionado((s) => (s === iso ? null : iso)) : undefined}
              style={{
                aspectRatio: '1 / 1', borderRadius: 8, background: corDia(t),
                border: ehHoje ? `2px solid ${C.accent}` : vencido ? `1px solid ${C.red}` : `1px solid ${C.hair}`,
                boxShadow: sel ? `0 0 0 2px ${C.accent2}` : 'none',
                cursor: temConta ? 'pointer' : 'default',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 2, minWidth: 0,
              }}>
              <div style={{ fontSize: 11, color: ehHoje ? C.accent : C.muted, fontWeight: ehHoje ? 800 : 500, lineHeight: 1 }}>{d}</div>
              {t > 0 && <div style={{ fontSize: 9, fontWeight: 800, color: C.text, marginTop: 2, whiteSpace: 'nowrap' }}>{compacto(t)}</div>}
            </div>
          );
        })}
      </div>

      {/* Detalhe do dia tocado: nomes dos fornecedores + valor */}
      {selecionado && detalhe && detalhe.length > 0 && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: C.raised, borderRadius: 10, border: `1px solid ${C.line}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>Vence {fmtDate(selecionado)}</div>
            <button onClick={() => setSelecionado(null)} aria-label="Fechar" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 17, lineHeight: 1, padding: 0 }}>×</button>
          </div>
          {detalhe.map((g, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, fontSize: 13, padding: '2px 0' }}>
              <span style={{ color: C.text, minWidth: 0 }}>{g.nome}{g.nota ? <span style={{ color: C.faint, fontSize: 12 }}> · {g.nota}</span> : null}</span>
              <b style={{ color: C.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(g.total)}</b>
            </div>
          ))}
        </div>
      )}

      {totalMes > 0 && (
        <div style={{ fontSize: 12, color: C.faint, marginTop: 8, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 4px' }}>
          <Ponto cor={azul(28)} />leve · <Ponto cor={azul(48)} />médio · <Ponto cor={C.accent} />pesado — {limite > 0 ? <>azul cheio a partir de {brl(limite)}.</> : 'quanto mais azul, mais pesa o dia.'}
        </div>
      )}

      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12, color: C.muted, fontWeight: 600 }}>Ajustar cores</summary>
        <div style={{ marginTop: 8, padding: 10, background: C.raised, borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, lineHeight: 1.4 }}>
            <b style={{ color: C.accent }}>Azul cheio</b> a partir de (R$) — os dias vão ficando mais azuis até chegar nesse valor. Deixe <b>0</b> (ou vazio) para automático, comparando com o maior dia do mês.
          </div>
          <div style={{ maxWidth: 170 }}><NumInput value={limiteStr} onChange={setLimite} placeholder="0 = automático" /></div>
        </div>
      </details>

      {/* Resumo por semana */}
      {totalMes > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', color: C.muted, fontWeight: 700, marginBottom: 8 }}>Por semana</div>
          {semanas.map((sem, i) => {
            const t = totalSemana(sem);
            if (t <= 0) return null;
            const dias = sem.filter(Boolean);
            const ini = dias[0], fim = dias[dias.length - 1];
            const ratio = t / maxSemana;
            const cor = C.accent;
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: C.muted }}>{pad(ini)}–{pad(fim)}/{pad(mes)}</span>
                  <b style={{ color: cor, fontVariantNumeric: 'tabular-nums' }}>{brl(t)}</b>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: `${C.hair}`, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(6, ratio * 100)}%`, height: '100%', background: cor, borderRadius: 999 }} />
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 12, color: C.faint, marginTop: 6, lineHeight: 1.4 }}>
            A cor mostra o quanto a semana pesa; a barra compara as semanas entre si.
          </div>
        </div>
      )}

      {totalMes === 0 && (
        <div style={{ fontSize: 13, color: C.faint, textAlign: 'center', padding: '12px 0 2px' }}>Nenhuma conta a vencer neste mês.</div>
      )}
    </Card>
  );
}
