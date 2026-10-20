'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, Btn, Label, NumInput, Select } from './ui';
import { brl, num, numQtd, fmtDate } from '../lib/util';
import { fatorEntre } from '../lib/estoque';
import { porcoesFritasPorDia, contaDoOleo, litrosParaMl, duracaoDoGalao } from '../lib/fritadeira';
import ListaDePratos from './ListaDePratos';

// "EU PAGO ISSO EM ÓLEO PORÉM EU NÃO COLOCO ÓLEO NA FICHA TÉCNICA."
//
// A ficha da Batata Frita Clássica dela tem um ingrediente: batata. O galão de
// R$ 189 não aparece em custo nenhum. E não é descuido — ninguém sabe dizer de
// cabeça quantos ml de óleo tem numa porção.
//
// Este ajudante faz as perguntas que ELA sabe responder, conta o resto sozinho,
// e põe o óleo na ficha de todos os fritos de uma vez.

export default function AjudanteFritadeira({ cardapio = [], estoque = [], fichas = [], vendas = [], compras = [], config, onConfig, onAcao }) {
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [feito, setFeito] = useState(null);

  const cfg = config || {};
  const set = (p) => onConfig && onConfig({ ...cfg, ...p });

  const oleo = estoque.find((e) => e.id === cfg.oleoId) || null;
  // Litros da embalagem: do estoque se já estiver lá, senão o que ela digitar.
  const litrosGuardados = oleo && num(oleo.conteudo) > 0 && oleo.conteudoUnid === 'ml' ? num(oleo.conteudo) / 1000 : 0;
  const litros = cfg.litros != null && cfg.litros !== '' ? cfg.litros : (litrosGuardados ? String(litrosGuardados).replace('.', ',') : '');
  const conteudoMl = litrosParaMl(litros);

  const fritos = Array.isArray(cfg.pratos) ? cfg.pratos : [];
  const contagem = useMemo(() => porcoesFritasPorDia(vendas, fritos, 30, cardapio), [vendas, fritos, cardapio]);
  // A contagem manda; ela pode corrigir se achar que o mês foi atípico.
  const porDia = cfg.porDiaManual != null && cfg.porDiaManual !== '' ? numQtd(cfg.porDiaManual) : contagem.porDia;

  // Quanto dura um galão, tirado das notas de compra — a pergunta que ela
  // errou duas vezes por ser ambígua no balcão, e que as notas respondem sem
  // depender de memória nenhuma.
  const duracao = useMemo(
    () => duracaoDoGalao({ compras, oleo, conteudoMl, fatorEntre }),
    [compras, oleo, conteudoMl],
  );

  const conta = useMemo(
    () => contaDoOleo({ conteudoMl, precoGalao: oleo ? num(oleo.custo) : 0, diasAteTrocar: cfg.dias, porcoesPorDia: porDia }),
    [conteudoMl, oleo, cfg.dias, porDia],
  );

  const ativos = useMemo(() => cardapio.filter((c) => c && c.ativo !== false), [cardapio]);
  const fichaDe = (id) => (fichas.find((f) => f.cardapioId === id)?.itens) || [];
  const jaTemOleo = (id) => fichaDe(id).some((i) => i.estoqueId === cfg.oleoId);
  const marcados = ativos.filter((c) => fritos.includes(c.id));
  const faltam = marcados.filter((c) => !jaTemOleo(c.id));

  const alternar = (id) => set({ pratos: fritos.includes(id) ? fritos.filter((x) => x !== id) : [...fritos, id] });

  // Põe o óleo na ficha de todos os marcados, de uma vez. É o trabalho que ela
  // não faria à mão em doze pratos.
  const aplicar = async () => {
    if (!conta.ok || !oleo || salvando) return;
    setSalvando(true);
    // O estoque precisa saber o tamanho da embalagem, senão "52 ml" não tem
    // como virar fração de galão na hora de baixar.
    if (!(num(oleo.conteudo) > 0) || oleo.conteudoUnid !== 'ml') {
      await onAcao({ acao: 'edit', id: oleo.id, campos: { nome: oleo.nome, categoria: oleo.categoria, unidade: oleo.unidade || 'un', minimo: num(oleo.minimo), custo: num(oleo.custo), conteudo: conteudoMl, conteudoUnid: 'ml', validade: oleo.validade || '' } });
    }
    const novas = [...fichas];
    for (const c of marcados) {
      const atual = fichaDe(c.id).filter((i) => i.estoqueId !== oleo.id);
      const itens = [...atual, { estoqueId: oleo.id, qtd: String(conta.mlPorPorcao), unidade: 'ml' }];
      const i = novas.findIndex((f) => f.cardapioId === c.id);
      if (i >= 0) novas[i] = { ...novas[i], itens };
      else novas.push({ cardapioId: c.id, itens });
    }
    await onAcao({ acao: 'fichas', fichas: novas });
    setSalvando(false);
    setFeito({ n: marcados.length, ml: conta.mlPorPorcao, custo: conta.custoPorPorcao, suspeito: !!conta.suspeito });
  };

  const opcoesOleo = useMemo(
    () => [...estoque].filter((e) => /[óo]leo|gordura|banha/i.test(e.nome || ''))
      .concat([...estoque].filter((e) => !/[óo]leo|gordura|banha/i.test(e.nome || '')))
      .map((e) => ({ value: e.id, label: `${e.nome}${num(e.custo) > 0 ? ` · ${brl(num(e.custo))}` : ' · sem custo'}` })),
    [estoque],
  );

  return (
    <Card style={{ marginBottom: 14, borderColor: aberto ? C.accent : C.cardBorder }}>
      <button onClick={() => setAberto((v) => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
        <span style={{ color: C.accent, fontSize: 12, fontWeight: 800, width: 12, flexShrink: 0 }}>{aberto ? '▾' : '▸'}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>Ajudante da fritadeira — o óleo que falta nas fichas</span>
          <span style={{ fontSize: 12, color: C.muted, display: 'block', marginTop: 1, lineHeight: 1.45 }}>
            {conta.ok
              ? `${conta.mlPorPorcao} ml por porção · ${brl(conta.custoPorPorcao)} de óleo em cada frito`
              : 'Tu paga o galão e ele não aparece em custo nenhum. Eu calculo pra ti.'}
          </span>
        </span>
      </button>

      {aberto && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.hair}` }}>
          <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 14 }}>
            Ninguém sabe dizer quantos ml de óleo tem numa porção — a pergunta não tem resposta direta.
            Mas tem indireta: o óleo não se gasta porção por porção, <b style={{ color: C.text }}>se gasta até a hora de
            trocar</b>. Então o que custa é o galão inteiro dividido por tudo que foi frito até lá.
          </div>

          {/* 1 — QUAL ÓLEO */}
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: C.accent, fontWeight: 800, marginBottom: 8 }}>1 · Qual óleo tu usa</div>
          <div style={{ marginBottom: 10 }}>
            <Select value={cfg.oleoId || ''} onChange={(v) => set({ oleoId: v })} options={opcoesOleo} placeholder="Escolhe no estoque…" />
          </div>
          {oleo && !(num(oleo.custo) > 0) && (
            <div style={{ fontSize: 12.5, color: C.amber, marginBottom: 10, lineHeight: 1.5 }}>
              ⚠️ Esse item está <b>sem custo</b> no estoque. Põe o preço do galão lá que o cálculo aparece aqui.
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <Label>Quantos litros tem a embalagem?</Label>
            <NumInput value={litros} onChange={(v) => set({ litros: v })} placeholder="ex.: 14,5" />
            {litrosGuardados > 0 && <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4 }}>já estava no estoque</div>}
          </div>

          {/* 2 — DE QUANTO EM QUANTO TEMPO TROCA */}
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: C.accent, fontWeight: 800, marginBottom: 8 }}>2 · A troca do óleo</div>
          <div style={{ marginBottom: 14 }}>
            {/* Rótulo próprio, não só o título da seção: campo sem nome não é
                achável por quem usa leitor de tela nem por um teste. */}
            {/* A PERGUNTA ESTAVA AMBÍGUA E DEU 513 ml POR PORÇÃO.
                Eu perguntava "de quantos em quantos dias tu troca o óleo?" e
                ela respondeu 10 — que é quando troca a FRITADEIRA. A conta
                precisa de outra coisa: quanto tempo dura um GALÃO. Se a
                fritadeira leva 5 L e ela troca a cada 10 dias, o galão de 14 L
                dura quase um mês. Usando 10, o galão inteiro era dividido por
                um terço das porções, e o óleo de cada batata ficou do tamanho
                de meia garrafa.
                A nota antiga já falava em "gastar um galão inteiro", mas vinha
                depois, em letra miúda, contradizendo o rótulo. Quando o rótulo
                e a nota brigam, ganha o rótulo. */}
            <Label>Quantos dias dura UM GALÃO inteiro?</Label>
            <NumInput value={cfg.dias || ''} onChange={(v) => set({ dias: v })} placeholder="ex.: 30" />
            {/* A PERGUNTA ERRADA DUAS VEZES É PROBLEMA DA PERGUNTA.
                Eu reescrevi o rótulo, pus a explicação embaixo e mandei ela
                olhar em Compras — e ela respondeu 10 de novo, que é a troca da
                fritadeira. Mandar a dona do bar folhear as próprias notas pra
                achar uma data é trabalho meu, não dela: as notas estão aqui. */}
            {duracao && duracao.ok ? (
              <div style={{ marginTop: 8, borderRadius: 11, padding: '10px 12px', background: C.panel2, border: `1px solid ${C.hair}` }}>
                <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6 }}>
                  Pelas tuas notas, um galão dura{' '}
                  <b style={{ color: C.accent }}>{duracao.diasPorGalao} dias</b>.
                  <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4 }}>
                    {duracao.compras} compras de óleo entre {fmtDate(duracao.de)} e {fmtDate(duracao.ate)} —{' '}
                    {duracao.galoes} {duracao.galoes === 1 ? 'galão gasto' : 'galões gastos'} em {duracao.dias} dias.
                    {duracao.magro && ' Com só duas compras isso ainda é um esboço; vai ficando melhor a cada nota que tu lança.'}
                  </div>
                </div>
                {numQtd(cfg.dias) !== duracao.diasPorGalao && (
                  <div style={{ marginTop: 8 }}>
                    <Btn small onClick={() => set({ dias: String(duracao.diasPorGalao).replace('.', ',') })}>
                      Usar {duracao.diasPorGalao} dias
                    </Btn>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4, lineHeight: 1.5 }}>
                Do galão novo até acabar o galão — <b style={{ color: C.muted }}>não</b> é de quanto em quanto tempo tu
                troca a fritadeira. Se a fritadeira leva 5 L, tu troca a cada 10 dias e o galão tem 14 L, então o galão
                dura uns <b style={{ color: C.muted }}>28 dias</b>.
                {duracao && duracao.motivo === 'uma-compra' && ' Quando tu lançar a próxima compra de óleo eu calculo isso sozinho.'}
                {duracao && duracao.motivo === 'sem-compra' && ' Lançando as compras de óleo em Compras, eu passo a calcular isso sozinho.'}
              </div>
            )}
          </div>

          {/* 3 — QUAIS PRATOS VÃO NA FRITADEIRA */}
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: C.accent, fontWeight: 800, marginBottom: 4 }}>3 · Quais pratos vão na fritadeira</div>
          <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 10, lineHeight: 1.45 }}>
            Marca todos — o óleo é dividido entre eles. Com isso eu conto nas tuas vendas quantas porções fritas saem
            por dia, que é a parte que tu não teria como calcular.
          </div>
          <ListaDePratos itens={ativos} marcados={fritos} onAlternar={alternar} jaTem={jaTemOleo} rotuloJaTem="já tem óleo" />

          {fritos.length > 0 && (
            <div style={{ background: C.panel2, borderRadius: 12, padding: '11px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
                Nos últimos 30 dias saíram <b style={{ color: C.text }}>{contagem.total}</b> porções desses pratos —{' '}
                <b style={{ color: C.text }}>{contagem.porDia} por dia</b>.
                {contagem.total === 0 && <> Ainda não tenho venda desses itens; preenche abaixo quantas tu acha que saem.</>}
              </div>
              {/* DE ONDE VEM O NÚMERO.
                  Ela olhou "2,73 por dia" e não tinha como julgar, mas sabe de
                  cor que num sábado saem 20 a 30 batatas. Com a lista aberta
                  ela vê num segundo o que eu não vejo daqui: prato marcado que
                  nunca vendeu, ou campeão que ficou de fora. */}
              {contagem.porPrato && contagem.porPrato.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${C.hair}` }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em', color: C.faint, fontWeight: 800, marginBottom: 6 }}>
                    De onde vem essa conta
                  </div>
                  {contagem.porPrato.slice(0, 12).map((p) => (
                    <div key={p.nome} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '3px 0', fontSize: 12.5 }}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: p.qtd > 0 ? C.text : C.faint }}>{p.nome}</span>
                      <b style={{ flexShrink: 0, color: p.qtd > 0 ? C.text : C.amber, fontVariantNumeric: 'tabular-nums' }}>
                        {p.qtd > 0 ? `${p.qtd} em 30 dias` : 'nenhuma venda'}
                      </b>
                    </div>
                  ))}
                  <div style={{ fontSize: 11.5, color: C.faint, marginTop: 7, lineHeight: 1.5 }}>
                    Se algum prato que sai muito aparecer com pouca ou nenhuma venda, a conta vai sair errada — e aí o
                    número de baixo é melhor que a contagem.
                  </div>
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                <Label>Porções fritas por dia (deixa vazio pra usar a contagem)</Label>
                <NumInput value={cfg.porDiaManual || ''} onChange={(v) => set({ porDiaManual: v })} placeholder={String(contagem.porDia || '')} />
              </div>
            </div>
          )}

          {/* O RESULTADO */}
          {conta.ok ? (
            <div style={{ borderRadius: 14, padding: '13px 14px', background: `color-mix(in srgb, ${C.green} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${C.green} 40%, transparent)` }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: C.green, fontWeight: 800 }}>O óleo de cada porção</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                <span style={{ fontSize: 26, fontWeight: 900, color: C.green, fontVariantNumeric: 'tabular-nums' }}>{conta.mlPorPorcao} ml</span>
                {conta.custoPorPorcao > 0 && <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>= {brl(conta.custoPorPorcao)}</span>}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 7, lineHeight: 1.6 }}>
                Um galão de {litros} L dá <b style={{ color: C.text }}>{conta.porcoesPorGalao}</b> porções antes da troca
                ({cfg.dias} dias × {porDia} por dia). É uma <b style={{ color: C.text }}>aproximação</b>: uma isca de
                tilápia não castiga o óleo igual a uma batata. Mas errar junto é muito melhor que o custo de hoje, que
                é zero.
              </div>

              {conta.suspeito && (
                <div style={{ marginTop: 11, borderRadius: 11, padding: '11px 13px', background: `color-mix(in srgb, ${C.amber} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${C.amber} 45%, transparent)` }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.amber }}>Esse número parece grande demais</div>
                  <div style={{ fontSize: 12.5, color: C.text, marginTop: 5, lineHeight: 1.6 }}>
                    Uma porção na fritadeira costuma levar de <b>10 a 30 ml</b> de óleo, contando a parte dela no galão
                    que se joga fora. {conta.mlPorPorcao} ml é muito mais que isso, e quase sempre significa uma destas duas:
                    <div style={{ marginTop: 7 }}>
                      <b style={{ color: C.text }}>1.</b> O galão dura mais do que tu disse. Lembra: é quanto tempo dura o
                      <b> galão</b>, não de quanto em quanto tempo tu troca a fritadeira.
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <b style={{ color: C.text }}>2.</b> Saem mais fritos do que o sistema contou ({porDia} por dia).
                      Se vocês vendem mais que isso, pode ser comanda que não passou pelo app — ou prato frito que
                      faltou marcar aí em cima.
                    </div>
                    <div style={{ fontSize: 11.5, color: C.faint, marginTop: 8 }}>
                      Dá pra aplicar assim mesmo, mas o custo de todo frito vai sair inflado — e o preço, junto.
                    </div>
                  </div>
                </div>
              )}

              {feito ? (
                /* A TELA NÃO PODE COMEMORAR O QUE ELA MESMA REPROVOU.
                   Ela aplicou com o aviso aberto, e logo abaixo apareceu um ✓
                   verde dizendo "agora o CMV conta o óleo" — como se estivesse
                   tudo certo. Duas mensagens opostas na mesma tela: a de baixo
                   é a última que se lê, e é a que fica. */
                feito.suspeito ? (
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginTop: 12, lineHeight: 1.6, background: `color-mix(in srgb, ${C.amber} 16%, transparent)`, border: `1px solid color-mix(in srgb, ${C.amber} 50%, transparent)`, borderRadius: 11, padding: '11px 13px' }}>
                    <b style={{ color: C.amber }}>Apliquei, mas com o número fora da faixa.</b> Os {feito.ml} ml entraram
                    na ficha de {feito.n} prato(s) e cada um ficou {brl(feito.custo)} mais caro — o que é muito, e vai
                    inflar o CMV do relatório e o preço sugerido de todo frito.
                    <div style={{ marginTop: 7 }}>
                      Arruma os dois campos acima e aplica de novo: <b>a ficha é substituída</b>, não somada. Enquanto
                      não arrumar, não usa o preço desses pratos pra decidir nada.
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: C.green, fontWeight: 700, marginTop: 12, lineHeight: 1.55 }}>
                    ✓ Pus {feito.ml} ml de óleo na ficha de {feito.n} prato(s). O custo de cada um subiu {brl(feito.custo)} —
                    e agora o CMV do relatório conta o óleo.
                  </div>
                )
              ) : (
                <div style={{ marginTop: 12 }}>
                  <Btn kind="ok" small onClick={aplicar} disabled={salvando || marcados.length === 0}>
                    {salvando ? 'Pondo…' : `Pôr o óleo na ficha de ${marcados.length} prato(s)`}
                  </Btn>
                  {faltam.length < marcados.length && (
                    <div style={{ fontSize: 11.5, color: C.faint, marginTop: 7 }}>
                      {marcados.length - faltam.length} já tem óleo na ficha — vou atualizar a quantidade deles também.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.55 }}>
              {conta.falta === 'tamanho' ? 'Falta dizer quantos litros tem a embalagem.'
                : conta.falta === 'dias' ? 'Falta dizer de quantos em quantos dias tu troca o óleo.'
                  : 'Falta marcar os pratos fritos (ou dizer quantas porções saem por dia).'}
            </div>
          )}

          {/* O QUE NÃO VAI NA FICHA — ela pediu luz e gás, e é importante dizer
              por que não vão, senão parece que eu ignorei o pedido. */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
            <b style={{ color: C.text }}>E a luz da fritadeira, e o gás?</b> Esses <b>não</b> entram na ficha, e não é
            esquecimento. O óleo só existe porque fritou — sobe quando tu frita mais. Luz, gás e aluguel chegam iguais
            no mês parado, e <b style={{ color: C.text }}>já estão contados</b> nas despesas, em "Energia elétrica" e
            "Gás". Pondo de novo aqui, o mesmo dinheiro sairia duas vezes do teu resultado e o CMV deixaria de poder
            ser comparado com qualquer coisa. Pra ver o custo com o fixo junto, usa o campo{' '}
            <b style={{ color: C.text }}>rateio de custo fixo</b> na calculadora de Preço certo.
          </div>
        </div>
      )}
    </Card>
  );
}
