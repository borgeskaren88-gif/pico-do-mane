'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, Field, QtdInput, Empty } from './ui';
import { brl, num, numQtd, diaOperacional, limparNome } from '../lib/util';
import { conferirFechamento, movimentoDoDia, ehContavel } from '../lib/fechamento';

// A conferência do fechamento: ela conta uns produtos na prateleira e o sistema
// diz se saiu alguma coisa que ninguém cobrou.
//
// Duas decisões de tela que importam:
//
// 1) A lista já vem com os produtos QUE MEXERAM HOJE, do que mais moveu
//    dinheiro pro que menos. Pedir pra ela escolher a dedo todo dia seria um
//    jeito garantido de ninguém usar.
// 2) A cor e a palavra mudam conforme a certeza. Item contável e vendido
//    direto vira acusação; peso, volume ou ficha faltando vira "confere".
//    Acusar errado uma vez faz ela parar de acreditar no sistema pra sempre.
const CORES = { certo: '#FF5A5A', duvidoso: '#F5A524', sobra: '#6AA9FF', ok: '#3FBF7F' };
const ROTULO = { certo: 'saiu sem ser cobrado', duvidoso: 'confere', sobra: 'sobrando', ok: 'bate' };

export default function ConferenciaFechamento({
  estoque = [], fichas = [], cardapio = [], vendas = [],
  dinheiroFinal = null, contado = '', onContagens, papel = 'dona', paraContar = null,
}) {
  // O atendimento conta ÀS CEGAS. Mostrar "o sistema diz 6" pra quem está
  // contando é pedir pra ele digitar 6 e ir embora — e aí a conferência vira
  // teatro. Ele vê só o nome do produto; o resultado é da dona.
  const cego = papel !== 'dona';
  const [contagens, setContagens] = useState({});
  const [verTodos, setVerTodos] = useState(false);
  const hoje = diaOperacional();

  // Os candidatos a contar: quem mexeu hoje vem primeiro, e o que mexeu mais
  // dinheiro vem no topo. É por onde vale começar a olhar.
  const candidatos = useMemo(() => {
    // O atendimento não recebe o estoque (nem deve). Pra ele, a lista de quem
    // contar vem pronta do servidor, com nome e unidade e mais nada.
    if (cego) return (paraContar || []).map((it) => ({ it, girou: 0, contavel: ehContavel(it) }));
    const comMov = estoque.map((it) => {
      const m = movimentoDoDia(it, hoje);
      const girou = m.venda + m.entrou + m.perda + m.cortesia + m.consumo + m.outras;
      return { it, girou, valor: girou * num(it.custo), contavel: ehContavel(it) };
    });
    const mexeram = comMov.filter((x) => x.girou > 0).sort((a, b) => b.valor - a.valor);
    if (verTodos) {
      const resto = comMov.filter((x) => x.girou <= 0).sort((a, b) => (a.it.nome || '').localeCompare(b.it.nome || ''));
      return [...mexeram, ...resto];
    }
    return mexeram.slice(0, 12);
  }, [estoque, hoje, verTodos, cego, paraContar]);

  const vendasHoje = useMemo(() => vendas.filter((v) => v && v.data === hoje), [vendas, hoje]);

  // A prévia na tela é só pra dona ver enquanto digita. Quem vale é a conta do
  // servidor, feita no fechamento com os mesmos números.
  const resultado = useMemo(() => (cego
    ? { veredito: { nivel: 'vazio', texto: '' }, linhas: [], semFicha: [], saidas: [], totais: {} }
    : conferirFechamento({
      estoque, fichas, cardapio, vendas: vendasHoje, contagens,
      caixa: dinheiroFinal == null ? null : { dinheiroFinal, contado },
      hoje,
    })), [cego, estoque, fichas, cardapio, vendasHoje, contagens, dinheiroFinal, contado, hoje]);

  // Entrega as CONTAGENS pro Caixa mandar no fechamento. Quem faz a conta é o
  // servidor — assim ela sai mesmo quando quem fechou foi o atendimento.
  React.useEffect(() => { if (onContagens) onContagens(contagens); }, [contagens, onContagens]);

  const setC = (id) => (v) => setContagens((m) => ({ ...m, [id]: v }));
  const limpar = (id) => setContagens((m) => { const n = { ...m }; delete n[id]; return n; });

  const { veredito, linhas, semFicha, saidas, totais } = resultado;
  const comFalta = linhas.filter((l) => l.nivel === 'certo' || l.nivel === 'duvidoso');
  const nadaPraContar = candidatos.length === 0;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', color: C.muted, fontWeight: 700, marginBottom: 6 }}>
        Conferir o estoque (opcional)
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
        {cego
          ? 'Conte na prateleira e digite o que tem de verdade. É rápido e ajuda a fechar a noite certa — a Karen confere depois.'
          : 'Conta na prateleira o que tu quiser conferir e digita aqui. Eu comparo com o que as vendas de hoje explicam. O que tu não contar, eu não palpito.'}
      </div>

      {nadaPraContar ? (
        <Empty>Nada mexeu no estoque hoje.</Empty>
      ) : (
        <div style={{ maxHeight: 250, overflowY: 'auto', margin: '0 -4px 10px', padding: '0 4px' }}>
          {candidatos.map(({ it, girou, contavel }) => {
            const linha = linhas.find((l) => l.id === it.id);
            const cor = linha ? CORES[linha.nivel] : C.line;
            return (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: `1px solid ${C.hair}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: C.text }}>
                    {limparNome(it.nome)}
                    {!contavel && <span style={{ color: C.faint, fontSize: 11 }}> · {it.unidade}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.faint }}>
                    {cego ? `em ${it.unidade || 'un'}` : `sistema: ${numQtd(it.saldo)} ${it.unidade || 'un'}`}
                    {!cego && girou > 0 ? ` · girou ${Math.round(girou * 1000) / 1000} hoje` : ''}
                  </div>
                </div>
                <div style={{ width: 96, flexShrink: 0 }}>
                  <QtdInput value={contagens[it.id] ?? ''} onChange={setC(it.id)} placeholder="contei" />
                </div>
                <div style={{ width: cego ? 0 : 96, flexShrink: 0, textAlign: 'right', fontSize: 11, fontWeight: 700, color: cor, overflow: 'hidden' }}>
                  {!cego && linha ? (
                    <>
                      {linha.nivel !== 'ok' && <div>{linha.falta > 0 ? '−' : '+'}{Math.abs(linha.falta)} {linha.unidade}</div>}
                      <div style={{ fontWeight: 600 }}>{ROTULO[linha.nivel]}</div>
                    </>
                  ) : (
                    <button onClick={() => limpar(it.id)} style={{ background: 'none', border: 'none', color: 'transparent', cursor: 'default' }}>·</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!cego && (
        <button onClick={() => setVerTodos((x) => !x)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 12 }}>
          {verTodos ? '▾ só o que mexeu hoje' : '▸ ver o estoque inteiro'}
        </button>
      )}

      {/* ---------- o recado (só pra dona) ---------- */}
      {!cego && veredito.nivel !== 'vazio' && (
        <Card style={{ padding: 12, marginBottom: 10, borderColor: veredito.nivel === 'ok' ? C.green : C.amber }}>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>
            <b style={{ color: veredito.nivel === 'ok' ? C.green : C.amber }}>
              {veredito.nivel === 'ok' ? 'Bateu: ' : 'Olha isso: '}
            </b>
            {veredito.texto}
          </div>

          {comFalta.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.hair}` }}>
              {comFalta.map((l) => (
                <div key={l.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12.5, color: C.text }}>
                    <b style={{ color: CORES[l.nivel] }}>{l.falta} {l.unidade} de {l.nome}</b>
                    {l.receitaPerdida > 0
                      ? <> — <b>{brl(l.receitaPerdida)}</b> que não entraram</>
                      : <> — {brl(l.custoPerdido)} de custo</>}
                  </div>
                  <div style={{ fontSize: 11, color: C.faint, lineHeight: 1.45 }}>{l.porque}</div>
                </div>
              ))}
            </div>
          )}

          {(totais.saidasNaMao > 0 || semFicha.length > 0) && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.hair}`, fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>
              {totais.saidasNaMao > 0 && (
                <div>Saídas lançadas na mão hoje: <b style={{ color: C.text }}>{brl(totais.saidasNaMao)}</b> ({saidas.map((s) => s.nome).slice(0, 3).join(', ')}). Isso é decisão tua, não furo.</div>
              )}
              {semFicha.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  Sem ficha técnica (não baixam estoque): {semFicha.map((p) => `${p.nome} ${p.qtd}×`).join(', ')}. Enquanto for assim, eu não consigo conferir o que eles consomem.
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
