'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, Btn, inputStyle } from './ui';
import { todayISO, fmtDate } from '../lib/util';

// O CALENDÁRIO DE TAREFAS DA GERENTE — o mesmo componente nas duas pontas.
//
// "Quero que nesta tela inicial dela tenha um calendário no qual eu possa pôr
// tarefas e aparece para ela."
//
//   modo 'dona'    — ela escolhe o dia, escreve e adiciona; pode apagar; vê o
//                    que já foi feito.
//   modo 'gerente' — vê o mês, toca no dia, marca como feita. Não cria nem
//                    apaga: a lista é de quem passa a tarefa.
//
// Um componente só, de propósito: as duas telas mostram o MESMO mês do mesmo
// jeito, então "a tarefa de sexta" é a mesma coisa pra quem passou e pra quem
// faz.

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export default function CalendarioTarefas({ tarefas = [], modo = 'gerente', onAdicionar, onRemover, onMarcar, titulo }) {
  const hoje = todayISO();
  const [mes, setMes] = useState(() => ({ y: Number(hoje.slice(0, 4)), m: Number(hoje.slice(5, 7)) - 1 }));
  const [dia, setDia] = useState(hoje);
  const [texto, setTexto] = useState('');
  const ehDona = modo === 'dona';

  const porDia = useMemo(() => {
    const m = new Map();
    for (const t of tarefas) {
      if (!t || !t.data) continue;
      if (!m.has(t.data)) m.set(t.data, []);
      m.get(t.data).push(t);
    }
    return m;
  }, [tarefas]);
  // Atrasada é a que tinha dia e o dia passou sem ela ser feita. É a primeira
  // coisa que a gerente precisa ver ao abrir — antes do mês inteiro.
  const atrasadas = tarefas.filter((t) => t && t.data && t.data < hoje && !t.feito).sort((a, b) => a.data.localeCompare(b.data));

  const primeiro = new Date(Date.UTC(mes.y, mes.m, 1)).getUTCDay();
  const diasNoMes = new Date(Date.UTC(mes.y, mes.m + 1, 0)).getUTCDate();
  const celulas = [...Array(primeiro).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)];
  const anda = (d) => setMes(({ y, m }) => { const n = new Date(Date.UTC(y, m + d, 1)); return { y: n.getUTCFullYear(), m: n.getUTCMonth() }; });
  const corDoDia = (lista, d) => {
    if (!lista || !lista.length) return null;
    if (lista.every((t) => t.feito)) return C.green;
    if (d < hoje) return C.red;
    if (d === hoje) return C.amber;
    return C.accent;
  };
  const doDia = (porDia.get(dia) || []).slice().sort((a, b) => Number(a.feito) - Number(b.feito));
  const adicionar = () => {
    const t = texto.trim();
    if (!t || !onAdicionar) return;
    onAdicionar(t, dia);
    setTexto('');
  };
  const rotDia = dia === hoje ? 'Hoje' : fmtDate(dia);

  const linha = (t) => (
    <div key={t.id} data-tarefa={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${C.hair}` }}>
      {ehDona ? (
        <span style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${t.feito ? C.green : C.line}`, background: t.feito ? C.green : 'transparent', color: '#06101F', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{t.feito ? '✓' : ''}</span>
      ) : (
        <button aria-label={t.feito ? 'Desmarcar' : 'Marcar como feita'} data-marcar={t.id} onClick={() => onMarcar && onMarcar(t.id, !t.feito)}
          style={{ width: 26, height: 26, borderRadius: 8, border: `2px solid ${t.feito ? C.green : C.accent}`, background: t.feito ? C.green : 'transparent', color: '#06101F', fontSize: 15, fontWeight: 900, cursor: 'pointer', flexShrink: 0, padding: 0 }}>{t.feito ? '✓' : ''}</button>
      )}
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: t.feito ? C.faint : C.text, textDecoration: t.feito ? 'line-through' : 'none' }}>{t.texto}</span>
      {ehDona && t.feito && <span style={{ fontSize: 11, color: C.green, fontWeight: 800, flexShrink: 0 }}>feita</span>}
      {ehDona && onRemover && (
        <button aria-label="Apagar tarefa" onClick={() => onRemover(t.id)} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, padding: '0 2px', flexShrink: 0 }}>×</button>
      )}
    </div>
  );

  return (
    <Card data-calendario={modo} style={{ marginBottom: 14, padding: 14 }}>
      {titulo && <div style={{ fontSize: 15.5, fontWeight: 900, marginBottom: 8 }}>{titulo}</div>}

      {!ehDona && atrasadas.length > 0 && (
        <div data-atrasadas style={{ borderLeft: `4px solid ${C.red}`, background: `color-mix(in srgb, ${C.red} 9%, transparent)`, borderRadius: 8, padding: '8px 11px', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.red, marginBottom: 2 }}>{atrasadas.length === 1 ? '1 tarefa atrasada' : `${atrasadas.length} tarefas atrasadas`}</div>
          {atrasadas.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '3px 0' }}>
              <button aria-label="Marcar como feita" onClick={() => onMarcar && onMarcar(t.id, true)} style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${C.red}`, background: 'transparent', cursor: 'pointer', flexShrink: 0, padding: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>{t.texto}</span>
              <span style={{ color: C.faint, fontSize: 11.5, flexShrink: 0 }}>{fmtDate(t.data).slice(0, 5)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button aria-label="Mês anterior" onClick={() => anda(-1)} style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 9, width: 34, height: 30, cursor: 'pointer', fontSize: 16 }}>‹</button>
        <div style={{ fontSize: 14.5, fontWeight: 900 }}>{MESES[mes.m]} {mes.y}</div>
        <button aria-label="Próximo mês" onClick={() => anda(1)} style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 9, width: 34, height: 30, cursor: 'pointer', fontSize: 16 }}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {SEMANA.map((s, i) => <div key={i} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 800, color: C.faint, padding: '2px 0' }}>{s}</div>)}
        {celulas.map((d, i) => {
          if (d == null) return <div key={`v${i}`} />;
          const k = iso(mes.y, mes.m, d);
          const cor = corDoDia(porDia.get(k), k);
          const sel = k === dia;
          return (
            <button key={k} data-dia={k} onClick={() => setDia(k)} style={{
              height: 38, borderRadius: 9, cursor: 'pointer', padding: 0, position: 'relative',
              border: `1px solid ${sel ? C.accent : k === hoje ? C.line : 'transparent'}`,
              background: sel ? `color-mix(in srgb, ${C.accent} 20%, transparent)` : 'transparent',
              color: k < hoje ? C.muted : C.text, fontSize: 13.5, fontWeight: k === hoje ? 900 : 600,
            }}>
              {d}
              {cor && <span style={{ position: 'absolute', left: '50%', bottom: 4, transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: 999, background: cor }} />}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.muted, marginBottom: 2 }}>{rotDia}</div>
        {doDia.length === 0 && <div style={{ fontSize: 12.5, color: C.faint, padding: '6px 0' }}>Nenhuma tarefa neste dia.</div>}
        {doDia.map(linha)}
        {ehDona && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') adicionar(); }}
              placeholder={`Tarefa pra ${rotDia.toLowerCase() === 'hoje' ? 'hoje' : rotDia}…`} style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
            <Btn small onClick={adicionar}>Adicionar</Btn>
          </div>
        )}
      </div>
    </Card>
  );
}
