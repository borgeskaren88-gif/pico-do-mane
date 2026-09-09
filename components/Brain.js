'use client';
import React, { useState } from 'react';
import { C, Card, Btn, PageTitle, inputStyle } from './ui';
import { uid, todayISO, fmtDate } from '../lib/util';
import AgendaCalendario from './AgendaCalendario';
import AgendaMes from './AgendaMes';

// O caderno: cada anotação tem um estado, e o estado é só uma bolinha colorida.
// Tocar na bolinha empurra a nota pro próximo estado — sem arrastar, sem menu.
const COLS = [
  ['ideia', 'Ideia', C.accent2],
  ['executando', 'Fazendo', C.accent],
  ['delegado', 'Passei pra alguém', C.amber],
  ['feito', 'Feito', C.green],
];
const ORDEM = COLS.map((c) => c[0]);
const infoCol = (status) => COLS.find(([k]) => k === status) || COLS[0];

export default function Brain({ tarefas = [], onTarefas, ideias = [], onIdeias }) {
  // ---- Caderno de notas ----
  const [nova, setNova] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const addIdeia = () => {
    const t = nova.trim();
    if (!t || !onIdeias) return;
    onIdeias([{ id: uid(), texto: t, status: 'ideia', criadoEm: Date.now() }, ...ideias]);
    setNova('');
  };
  const moverIdeia = (id, status) => onIdeias(ideias.map((i) => (i.id === id ? { ...i, status } : i)));
  // Toca na bolinha e a nota anda um passo (e do Feito volta pro começo).
  const avancar = (i) => { const idx = ORDEM.indexOf(i.status); moverIdeia(i.id, ORDEM[(idx + 1) % ORDEM.length]); };
  const excluirIdeia = (id) => onIdeias(ideias.filter((i) => i.id !== id));
  const limparFeitos = () => { if (typeof window !== 'undefined' && !window.confirm('Apagar todas as anotações já marcadas como feitas?')) return; onIdeias(ideias.filter((i) => i.status !== 'feito')); };
  // Edição da nota (título + o texto de dentro).
  const [editId, setEditId] = useState(null);
  const [editTexto, setEditTexto] = useState('');
  const [editNota, setEditNota] = useState('');
  // Privacidade: o texto de dentro fica ESCONDIDO; só aparece quando a dona toca
  // na linha. Assim, com a tela aberta no bar, ninguém lê o conteúdo.
  const [notaAberta, setNotaAberta] = useState({});
  const abrirEdit = (i) => { setEditId(i.id); setEditTexto(i.texto || ''); setEditNota(i.nota || ''); setNotaAberta((m) => ({ ...m, [i.id]: true })); };
  const salvarEdit = () => { onIdeias(ideias.map((x) => (x.id === editId ? { ...x, texto: editTexto.trim() || x.texto, nota: editNota.trim() } : x))); setEditId(null); };
  const cancelarEdit = () => setEditId(null);

  const contaDe = (status) => ideias.filter((i) => i.status === status).length;
  const visiveis = (filtro === 'todos' ? ideias : ideias.filter((i) => i.status === filtro))
    .slice()
    .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

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

  return (
    <div>
      <PageTitle sub="Calendário, checklist e o caderno de anotações — tudo num lugar só">Brain</PageTitle>

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

        {/* Coluna direita: o caderno — uma lista só, tudo o que vem na cabeça */}
        <div style={{ flex: '2 1 400px', minWidth: 0 }}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {/* Capa do caderno: escrever primeiro, organizar depois */}
            <div style={{ background: `linear-gradient(135deg, ${C.accent} 0%, ${C.roxo} 100%)`, padding: '15px 14px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-.01em' }}>Caderno</div>
                <div style={{ fontSize: 11.5, opacity: 0.85, fontWeight: 700 }}>{ideias.length} anotação(ões)</div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2, lineHeight: 1.4 }}>Tudo o que vem na cabeça. Escreve agora, organiza depois.</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input
                  value={nova}
                  onChange={(e) => setNova(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addIdeia(); }}
                  placeholder="Escreve aqui…"
                  className="caderno-input"
                  style={{
                    flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: 11, padding: '11px 13px', fontSize: 14.5, color: '#fff', outline: 'none',
                  }}
                />
                <button onClick={addIdeia} style={{ flexShrink: 0, background: '#fff', color: C.accent, border: 'none', borderRadius: 11, padding: '0 18px', fontSize: 14, fontWeight: 900, cursor: 'pointer' }}>Anotar</button>
              </div>
            </div>

            {/* Folha do caderno */}
            <div style={{ padding: 14 }}>
              {/* Peneira: mostra tudo ou só um estado */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                <button onClick={() => setFiltro('todos')} style={chip(filtro === 'todos', C.text)}>Tudo <span style={{ opacity: 0.6 }}>{ideias.length}</span></button>
                {COLS.map(([status, rot, cor]) => (
                  <button key={status} onClick={() => setFiltro(filtro === status ? 'todos' : status)} style={chip(filtro === status, cor)}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: cor, display: 'inline-block', marginRight: 6 }} />
                    {rot} <span style={{ opacity: 0.6 }}>{contaDe(status)}</span>
                  </button>
                ))}
                {contaDe('feito') > 0 && (
                  <button onClick={limparFeitos} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 11.5, fontWeight: 700 }}>limpar feitas</button>
                )}
              </div>

              {visiveis.length === 0 ? (
                <div style={{ textAlign: 'center', color: C.faint, fontSize: 13, lineHeight: 1.6, padding: '26px 10px 18px' }}>
                  {ideias.length === 0
                    ? <>O caderno está em branco.<br /><span style={{ fontSize: 12 }}>Escreve lá em cima o que veio na cabeça — nem que seja meia frase.</span></>
                    : 'Nada nesse estado.'}
                </div>
              ) : visiveis.map((i) => {
                const [, rot, cor] = infoCol(i.status);
                const editando = editId === i.id;
                const aberta = !!notaAberta[i.id];
                const feita = i.status === 'feito';
                return (
                  <div key={i.id} style={{ borderTop: `1px solid ${C.hair}`, padding: '11px 0 10px' }}>
                    {editando ? (
                      <div style={{ paddingLeft: 2 }}>
                        <input value={editTexto} onChange={(e) => setEditTexto(e.target.value)} placeholder="A anotação" style={{ ...inputStyle, fontSize: 14, fontWeight: 700, padding: '9px 11px', marginBottom: 8 }} />
                        <textarea value={editNota} onChange={(e) => setEditNota(e.target.value)} rows={4} placeholder="O texto de dentro… (fica escondido até você tocar na linha)" style={{ ...inputStyle, fontSize: 13.5, padding: '9px 11px', marginBottom: 8, resize: 'vertical', lineHeight: 1.5 }} />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Btn small onClick={salvarEdit}>Salvar</Btn>
                          <Btn kind="ghost" small onClick={cancelarEdit}>Cancelar</Btn>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                        {/* A bolinha é o estado: um toque e a nota anda um passo. */}
                        <button
                          onClick={() => avancar(i)}
                          title={`${rot} — toque pra mudar`}
                          style={{
                            marginTop: 2, flexShrink: 0, width: 17, height: 17, borderRadius: 999, cursor: 'pointer',
                            border: `2.5px solid ${cor}`, background: feita ? cor : 'transparent', padding: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <button onClick={() => setNotaAberta((m) => ({ ...m, [i.id]: !m[i.id] }))} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                            <div style={{ fontSize: 14.5, color: feita ? C.faint : C.text, lineHeight: 1.4, fontWeight: 600, overflowWrap: 'anywhere', textDecoration: feita ? 'line-through' : 'none' }}>
                              {i.texto}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                              <span style={{ fontSize: 10.5, fontWeight: 800, color: cor, letterSpacing: '.03em' }}>{rot}</span>
                              {i.nota && !aberta && <span style={{ fontSize: 10.5, color: C.faint, fontWeight: 700 }}>· tem recado escondido</span>}
                            </div>
                          </button>
                          {aberta && (
                            <div style={{ marginTop: 8 }}>
                              {i.nota
                                ? <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.55, whiteSpace: 'pre-wrap', borderLeft: `2px solid ${C.line}`, paddingLeft: 10 }}>{i.nota}</div>
                                : <div style={{ fontSize: 12.5, color: C.faint }}>Sem texto por dentro. Toque em “escrever”.</div>}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
                                <button onClick={() => abrirEdit(i)} style={acaoBtn}>{i.nota ? 'editar' : 'escrever'}</button>
                                <button onClick={() => avancar(i)} style={acaoBtn}>mudar estado ›</button>
                                <button onClick={() => excluirIdeia(i.id)} style={{ ...acaoBtn, marginLeft: 'auto', color: C.red, borderColor: C.line }}>apagar</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
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

const chip = (ativo, cor) => ({
  border: `1px solid ${ativo ? cor : C.line}`, cursor: 'pointer', borderRadius: 999,
  background: ativo ? `color-mix(in srgb, ${cor} 16%, transparent)` : 'transparent',
  color: ativo ? cor : C.muted, padding: '5px 11px', fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap',
  display: 'inline-flex', alignItems: 'center',
});
const acaoBtn = {
  background: 'none', border: `1px solid ${C.line}`, color: C.muted, cursor: 'pointer',
  fontSize: 11.5, fontWeight: 700, padding: '5px 11px', borderRadius: 8,
};
