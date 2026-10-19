'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, Btn, Label, NumInput, Select } from './ui';
import { brl, num, numQtd } from '../lib/util';
import { UNIDADES } from '../lib/estoque';
import { porPorcao, porNasFichas } from '../lib/acompanhamentos';
import ListaDePratos from './ListaDePratos';

// "TEM O KETCHUP QUE VAI, TEM LIMÃO FATIA QUE VAI NAS PORÇÕES."
//
// Ela está auditando as próprias fichas e achando o que falta. Estes dois são
// ingrediente de verdade — só saem porque a porção saiu — e entram no CMV.
//
// O que trava não é saber que vão. É que pôr "1 sachê" em doze fichas, uma por
// uma, é trabalho que ninguém faz duas vezes. Então aqui se faz de uma vez.

const SUGESTOES = ['ketchup', 'limão', 'limao', 'maionese', 'molho', 'guardanapo', 'palito', 'mostarda', 'barbecue', 'sal', 'tempero'];

export default function AjudanteAcompanhamentos({ cardapio = [], estoque = [], fichas = [], onAcao }) {
  const [aberto, setAberto] = useState(false);
  const [estoqueId, setEstoqueId] = useState('');
  const [modo, setModo] = useState('direto'); // 'direto' | 'rendimento'
  const [qtd, setQtd] = useState('');
  const [unidade, setUnidade] = useState('');
  const [rendimento, setRendimento] = useState('');
  const [pratos, setPratos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [feito, setFeito] = useState(null);

  const item = estoque.find((e) => e.id === estoqueId) || null;
  const ativos = useMemo(() => cardapio.filter((c) => c && c.ativo !== false), [cardapio]);
  const fichaDe = (id) => (fichas.find((f) => f.cardapioId === id)?.itens) || [];
  const jaTem = (id) => fichaDe(id).some((i) => i.estoqueId === estoqueId);

  // Os candidatos óbvios primeiro, pra ela não caçar numa lista de cem itens.
  const opcoes = useMemo(() => {
    const chave = (e) => (e.nome || '').toLowerCase();
    const sugeridos = estoque.filter((e) => SUGESTOES.some((s) => chave(e).includes(s)));
    const resto = estoque.filter((e) => !sugeridos.includes(e));
    const rot = (e) => `${e.nome}${num(e.custo) > 0 ? ` · ${brl(num(e.custo))}/${e.unidade || 'un'}` : ' · sem custo'}`;
    return [...sugeridos, ...resto].map((e) => ({ value: e.id, label: rot(e) }));
  }, [estoque]);

  const calc = useMemo(() => {
    if (!item) return null;
    if (modo === 'rendimento') return porPorcao({ unidadeItem: item.unidade, rendimento });
    const q = numQtd(qtd);
    if (!(q > 0)) return null;
    const u = unidade || item.unidade || 'un';
    return { qtd: String(qtd), unidade: u, legivel: `${qtd} ${u}` };
  }, [item, modo, qtd, unidade, rendimento]);

  // Quanto isso custa por porção — é o que transforma "é só um limãozinho" em
  // número. Em cima de 100 porções no mês, "só um limãozinho" vira dinheiro.
  const custoPorPorcao = useMemo(() => {
    if (!item || !calc || !(num(item.custo) > 0)) return null;
    const u = item.unidade;
    const q = numQtd(String(calc.qtd).replace(',', '.'));
    let emUnidadeDoItem = q;
    if ((u === 'kg' && calc.unidade === 'g') || (u === 'L' && calc.unidade === 'ml')) emUnidadeDoItem = q / 1000;
    else if (calc.unidade !== u) return null; // conversão que eu não sei fazer: melhor não chutar
    return Math.round(emUnidadeDoItem * num(item.custo) * 100) / 100;
  }, [item, calc]);

  const alternar = (id) => setPratos((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const aplicar = async () => {
    if (!item || !calc || !pratos.length || salvando) return;
    setSalvando(true);
    await onAcao({ acao: 'fichas', fichas: porNasFichas({ fichas, cardapioIds: pratos, estoqueId, qtd: calc.qtd, unidade: calc.unidade }) });
    setSalvando(false);
    setFeito({ n: pratos.length, nome: item.nome, legivel: calc.legivel, custo: custoPorPorcao });
  };

  const limpar = () => { setFeito(null); setEstoqueId(''); setQtd(''); setUnidade(''); setRendimento(''); setPratos([]); };

  return (
    <Card style={{ marginBottom: 14, borderColor: aberto ? C.accent : C.cardBorder }}>
      <button onClick={() => setAberto((v) => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
        <span style={{ color: C.accent, fontSize: 12, fontWeight: 800, width: 12, flexShrink: 0 }}>{aberto ? '▾' : '▸'}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>Acompanhamentos — ketchup, limão, molho</span>
          <span style={{ fontSize: 12, color: C.muted, display: 'block', marginTop: 1, lineHeight: 1.45 }}>
            Sai junto com a porção, custa, e quase nunca está na ficha. Põe em vários pratos de uma vez.
          </span>
        </span>
      </button>

      {aberto && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.hair}` }}>
          {feito ? (
            <div>
              <div style={{ fontSize: 13.5, color: C.green, fontWeight: 700, lineHeight: 1.6 }}>
                ✓ Pus {feito.legivel} de {feito.nome} na ficha de {feito.n} prato(s).
                {feito.custo != null && <> O custo de cada um subiu <b>{brl(feito.custo)}</b>.</>}
              </div>
              <div style={{ marginTop: 12 }}><Btn kind="ghost" small onClick={limpar}>Pôr outro acompanhamento</Btn></div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 14 }}>
                Diferente do gás e do salário, <b style={{ color: C.text }}>estes são ingrediente</b>: só existem porque a
                porção saiu, e somem no dia parado. Entram na ficha e no CMV, igual à batata.
              </div>

              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: C.accent, fontWeight: 800, marginBottom: 8 }}>1 · O que vai junto</div>
              <div style={{ marginBottom: 14 }}>
                <Select value={estoqueId} onChange={(v) => { setEstoqueId(v); setUnidade(''); }} options={opcoes} placeholder="Escolhe no estoque…" />
              </div>

              {item && (
                <>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: C.accent, fontWeight: 800, marginBottom: 8 }}>2 · Quanto vai em cada porção</div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                    {[['direto', 'Sei a quantidade'], ['rendimento', 'Sei quantas porções rende']].map(([v, rot]) => (
                      <button key={v} onClick={() => setModo(v)} style={{
                        borderRadius: 999, padding: '7px 13px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
                        border: `1px solid ${modo === v ? C.accent : C.line}`,
                        background: modo === v ? C.accent : 'transparent',
                        color: modo === v ? '#06101F' : C.muted,
                      }}>{rot}</button>
                    ))}
                  </div>

                  {modo === 'direto' ? (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Label>Quantidade</Label>
                        <NumInput value={qtd} onChange={setQtd} placeholder="ex.: 1" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Label>Unidade</Label>
                        <Select value={unidade || item.unidade || 'un'} onChange={setUnidade} options={UNIDADES} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 6 }}>
                      {/* A PERGUNTA QUE ELA CONSEGUE RESPONDER.
                          Ninguém sabe dizer "23 g de limão". Todo mundo sabe
                          estimar quantas porções saem de um quilo. */}
                      <Label>{`1 ${item.unidade || 'un'} de ${item.nome} dá quantas porções?`}</Label>
                      <NumInput value={rendimento} onChange={setRendimento} placeholder="ex.: 40" />
                      <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4, lineHeight: 1.45 }}>
                        Chute de cozinha serve. Um limão dá umas 8 fatias e um quilo tem uns 7 limões — então
                        um quilo dá quase 60 fatias.
                      </div>
                    </div>
                  )}

                  {calc && (
                    <div style={{ background: C.panel2, borderRadius: 12, padding: '11px 14px', margin: '12px 0 14px', fontSize: 13, color: C.text, lineHeight: 1.6 }}>
                      Vai <b style={{ color: C.accent }}>{calc.legivel}</b> de {item.nome} em cada porção
                      {custoPorPorcao != null && <> — <b style={{ color: C.accent }}>{brl(custoPorPorcao)}</b></>}.
                      {custoPorPorcao != null && custoPorPorcao > 0 && (
                        <div style={{ fontSize: 11.5, color: C.faint, marginTop: 5 }}>
                          Parece pouco, mas em 500 porções no mês são {brl(Math.round(custoPorPorcao * 500 * 100) / 100)}.
                        </div>
                      )}
                      {custoPorPorcao == null && (
                        <div style={{ fontSize: 11.5, color: C.amber, marginTop: 5 }}>
                          Não consigo converter {calc.unidade} pra {item.unidade} aqui, então não mostro o custo — mas a
                          ficha fica certa e o estoque faz a conta na hora de baixar.
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: C.accent, fontWeight: 800, marginBottom: 4 }}>3 · Em quais pratos</div>
                  <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 10, lineHeight: 1.45 }}>
                    Marca todas as porções que saem com isso. Se já tiver na ficha, a quantidade é atualizada.
                  </div>
                  <ListaDePratos itens={ativos} marcados={pratos} onAlternar={alternar} jaTem={jaTem} />

                  <Btn kind="ok" small onClick={aplicar} disabled={salvando || !calc || !pratos.length}>
                    {salvando ? 'Pondo…' : `Pôr em ${pratos.length} prato(s)`}
                  </Btn>
                </>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
