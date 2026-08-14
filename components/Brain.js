'use client';
import React, { useState } from 'react';
import { C, Card, Btn, PageTitle, inputStyle } from './ui';
import { uid, todayISO, fmtDate } from '../lib/util';
import AgendaCalendario from './AgendaCalendario';
import AgendaMes from './AgendaMes';

// Colunas do quadro de ideias (estilo Notion): id, rótulo e cor.
const COLS = [
  ['ideia', 'Ideias', C.accent2],
  ['executando', 'Executando', C.accent],
  ['delegado', 'Delegado', C.amber],
  ['feito', 'Feito', C.green],
];
const ORDEM = COLS.map((c) => c[0]);

export default function Brain({ tarefas = [], onTarefas, ideias = [], onIdeias }) {
  // ---- Quadro de ideias ----
  const [nova, setNova] = useState('');
  const addIdeia = () => {
    const t = nova.trim();
    if (!t || !onIdeias) return;
    onIdeias([{ id: uid(), texto: t, status: 'ideia', criadoEm: Date.now() }, ...ideias]);
    setNova('');
  };
  const moverIdeia = (id, status) => onIdeias(ideias.map((i) => (i.id === id ? { ...i, status } : i)));
  const mover = (i, dir) => { const idx = ORDEM.indexOf(i.status); const ni = idx + dir; if (ni < 0 || ni >= ORDEM.length) return; moverIdeia(i.id, ORDEM[ni]); };
  const excluirIdeia = (id) => onIdeias(ideias.filter((i) => i.id !== id));
  const limparFeitos = () => { if (typeof window !== 'undefined' && !window.confirm('Apagar todas as ideias da coluna Feito?')) return; onIdeias(ideias.filter((i) => i.status !== 'feito')); };

  // ---- Checklist ----
  const [novaTarefa, setNovaTarefa] = useState('');
  const [novaTarefaData, setNovaTarefaData] = useState('');
  const [verConcluidas, setVerConcluidas] = useState(false);
  const tarefasAbertas = tarefas.filter((t) => !t.feito).sort((a, b) => {
    if (a.data && b.data) return a.data.localeCompare(b.data);
    if (a.data) return -1;
    if (b.data) return 1;
    return (b.criadoEm || 0) - (a.criadoEm || 0);
  });
  const tarefasFeitas = tarefas.filter((t) => t.feito);
  const addTarefa = () => {
    const txt = novaTarefa.trim();
    if (!txt || !onTarefas) return;
    onTarefas([{ id: uid(), texto: txt, data: novaTarefaData || '', feito: false, criadoEm: Date.now() }, ...tarefas]);
    setNovaTarefa(''); setNovaTarefaData('');
  };
  const toggleTarefa = (id) => onTarefas(tarefas.map((t) => (t.id === id ? { ...t, feito: !t.feito, feitoEm: !t.feito ? Date.now() : null } : t)));
  const removerTarefa = (id) => onTarefas(tarefas.filter((t) => t.id !== id));
  const limparConcluidas = () => onTarefas(tarefas.filter((t) => !t.feito));

  const setaBtn = (ativo) => ({
    background: 'transparent', border: `1px solid ${C.line}`, color: ativo ? C.accent : C.faint,
    borderRadius: 8, width: 30, height: 28, cursor: ativo ? 'pointer' : 'default', fontSize: 15, fontWeight: 800, lineHeight: 1, opacity: ativo ? 1 : 0.4,
  });

  return (
    <div>
      <PageTitle sub="Calendário, tarefas e ideias — tudo num lugar só">Brain</PageTitle>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        {/* Coluna esquerda: calendário + checklist */}
        <div style={{ flex: '1 1 300px', minWidth: 0, maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AgendaMes />

          <Card style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Checklist</div>
              {tarefasAbertas.length > 0 && <div style={{ fontSize: 12, color: C.muted }}>{tarefasAbertas.length} pend.</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: tarefasAbertas.length || tarefasFeitas.length ? 12 : 0 }}>
              <input value={novaTarefa} onChange={(e) => setNovaTarefa(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addTarefa(); }}
                placeholder="Nova tarefa… (ex: pagar boleto Ambev)" style={{ ...inputStyle, flex: '1 1 100%' }} />
              <input type="date" value={novaTarefaData} onChange={(e) => setNovaTarefaData(e.target.value)}
                title="Data (opcional) — pra receber aviso no dia" style={{ ...inputStyle, flex: '1 1 120px' }} />
              <Btn small onClick={addTarefa}>Add</Btn>
            </div>

            {tarefasAbertas.length === 0 && tarefasFeitas.length === 0 && (
              <div style={{ fontSize: 13, color: C.faint, textAlign: 'center', padding: '10px 0 2px' }}>Nenhuma tarefa. Anote o que precisa fazer.</div>
            )}

            {tarefasAbertas.map((t) => {
              const atrasada = t.data && t.data < todayISO();
              const venceHoje = t.data === todayISO();
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${C.line}` }}>
                  <button onClick={() => toggleTarefa(t.id)} aria-label="Concluir" style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${C.line}`, background: 'transparent', cursor: 'pointer', flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 14, color: C.text }}>
                    {t.texto}
                    {t.data && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: atrasada ? C.red : venceHoje ? C.amber : C.faint, whiteSpace: 'nowrap' }}>
                        {atrasada ? `atrasada · ${fmtDate(t.data)}` : venceHoje ? 'hoje' : fmtDate(t.data)}
                      </span>
                    )}
                  </div>
                  <button onClick={() => removerTarefa(t.id)} aria-label="Excluir" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
                </div>
              );
            })}

            {tarefasFeitas.length > 0 && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button onClick={() => setVerConcluidas((v) => !v)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>
                    {verConcluidas ? '▾' : '▸'} Concluídas ({tarefasFeitas.length})
                  </button>
                  <button onClick={limparConcluidas} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}>limpar concluídas</button>
                </div>
                {verConcluidas && tarefasFeitas.map((t) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                    <button onClick={() => toggleTarefa(t.id)} aria-label="Reabrir" style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${C.green}`, background: C.green, color: '#052014', cursor: 'pointer', flexShrink: 0, fontWeight: 900, fontSize: 13, lineHeight: 1 }} />
                    <div style={{ flex: 1, fontSize: 14, color: C.faint, textDecoration: 'line-through' }}>{t.texto}</div>
                    <button onClick={() => removerTarefa(t.id)} aria-label="Excluir" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Coluna direita (maior): TO DO estilo Notion */}
        <div style={{ flex: '2 1 400px', minWidth: 0 }}>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Jogar uma ideia</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={nova} onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addIdeia(); }}
                placeholder="O que veio na cabeça agora…" style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
              <Btn onClick={addIdeia}>Add</Btn>
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            {COLS.map(([status, rot, cor]) => {
              const cards = ideias.filter((i) => i.status === status);
              return (
                <div key={status} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 14, padding: 10, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '2px 2px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: cor, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', color: cor, fontWeight: 800, whiteSpace: 'nowrap' }}>{rot}</span>
                      <span style={{ fontSize: 12, color: C.faint }}>{cards.length}</span>
                    </div>
                    {status === 'feito' && cards.length > 0 && (
                      <button onClick={limparFeitos} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: 0 }}>limpar</button>
                    )}
                  </div>
                  {cards.length === 0 ? (
                    <div style={{ fontSize: 12, color: C.faint, textAlign: 'center', padding: '10px 4px', border: `1px dashed ${C.line}`, borderRadius: 10 }}>—</div>
                  ) : cards.map((i) => {
                    const idx = ORDEM.indexOf(i.status);
                    return (
                      <div key={i.id} style={{ background: C.panel, border: `1px solid ${C.cardBorder}`, borderLeft: `3px solid ${cor}`, borderRadius: 10, padding: 10, marginBottom: 8, boxShadow: C.cardShadow }}>
                        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.4, marginBottom: 9, textDecoration: status === 'feito' ? 'line-through' : 'none', opacity: status === 'feito' ? 0.7 : 1 }}>{i.texto}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button onClick={() => mover(i, -1)} disabled={idx === 0} aria-label="Voltar" style={setaBtn(idx > 0)}>‹</button>
                          <button onClick={() => mover(i, 1)} disabled={idx === ORDEM.length - 1} aria-label="Avançar" style={setaBtn(idx < ORDEM.length - 1)}>›</button>
                          <button onClick={() => excluirIdeia(i.id)} aria-label="Excluir" style={{ marginLeft: 'auto', background: 'none', border: `1px solid ${C.line}`, color: C.faint, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '6px 10px', borderRadius: 8 }}>×</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Conexão do Google Agenda (discreto, no rodapé) */}
      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: C.muted, fontWeight: 700, padding: '4px 0' }}>Configurar / conectar o Google Agenda</summary>
        <div style={{ marginTop: 8 }}><AgendaCalendario /></div>
      </details>
    </div>
  );
}
