import { brl, num, addDays, ymOf, limparNome } from './util';
import { analisarBar } from './darci';
import { cmvDoMes, estoqueNoMes } from './cmv';

// A FICHA DO BAR: os números reais da Karen, escritos em texto, pra ir junto
// com a pergunta quando o Darci usa a IA pra entender.
//
// Essa é a peça central da coisa. A IA NÃO tem acesso ao banco, não busca nada
// e não sabe nada do Pico do Mané além do que estiver escrito aqui. Então tudo
// que ela responder sai daqui — dos mesmos números que aparecem nas telas.
// Se um número não estiver nessa ficha, a resposta certa é "não sei".
//
// Fica compacta de propósito: cada linha a mais é dinheiro a cada pergunta.
const arr = (v) => (Array.isArray(v) ? v : []);
const cent = (v) => Math.round(num(v) * 100) / 100;
const ddmm = (d) => (d && d.length >= 10 ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');
const pct = (v) => `${v > 0 ? '+' : ''}${v}%`;

// Soma um campo por chave e devolve os maiores, já em reais.
function maiores(itens, chave, valor, quantos = 8) {
  const m = new Map();
  for (const it of itens) {
    const k = limparNome(it && it[chave]) || 'Sem nome';
    m.set(k, (m.get(k) || 0) + num(it[valor]));
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, quantos);
}

export function fichaDoBar(dados = {}, vendas = [], reservas = []) {
  const n = analisarBar({ ...dados, vendas, reservas, desdeMs: 0 });
  const L = [];
  const põe = (s) => { if (s) L.push(s); };

  põe(`DATA DE HOJE: ${n.hoje} (dia operacional; o dia do bar vira às 6h da manhã).`);
  põe('BAR: Pico do Mané, Florianópolis. Dona: Karen. Sócio: Tiago. Esposa da Karen e coordenadora de operações: Mariele ("Mari"), que cuida das reservas.');

  // --- o dia e a comparação ---
  põe('\n## ONTEM');
  põe(`Ontem (${ddmm(n.ontem)}): ${brl(n.caixaOntem)} no caixa + ${brl(n.fiadoOntem)} em fiado = ${brl(n.totalOntem)}. ${n.pedidosOntem} comanda(s), ticket médio ${brl(n.ticketOntem)}.`);
  if (n.cmpOntem) põe(`Comparado: ${n.cmpOntem.dia} costuma dar ${brl(n.cmpOntem.media)} (média de ${n.cmpOntem.dias} dias iguais). Ontem ficou ${pct(n.cmpOntem.pct)} disso.`);
  põe(`Hoje até agora: ${brl(n.hojeAteAgora)}.`);

  põe('\n## PREVISÃO DE HOJE');
  if (n.previsao && n.previsao.dias) {
    põe(`Hoje é ${n.previsao.diaSemana}. Esperado ${brl(n.previsao.total)} (faixa ${brl(n.previsao.min)} a ${brl(n.previsao.max)}), base ${n.previsao.dias} dias iguais. Deve sair: ${(n.previsao.itens || []).slice(0, 6).map((i) => `${i.qtd} ${i.nome}`).join(', ') || '—'}.`);
  } else põe('Sem histórico suficiente pra prever hoje.');

  põe('\n## MÉDIA POR DIA DA SEMANA (últimas 8 semanas)');
  põe(arr(n.porDiaSemana).length
    ? arr(n.porDiaSemana).map((d) => `${d.dia}: ${brl(d.media)} (${d.dias} dias)`).join(' | ')
    : 'Sem dados suficientes.');

  põe('\n## SEMANA E MÊS');
  if (n.cmpSemana) põe(`Últimos 7 dias: ${brl(n.cmpSemana.atual)}. Os 7 anteriores: ${brl(n.cmpSemana.antes)} (${pct(n.cmpSemana.pct)}).`);
  põe(`Mês atual (${ymOf(n.hoje)}): receita ${brl(n.recMes)}, despesa ${brl(n.despMes)}, resultado ${brl(n.resultado)}.`);
  if (n.cmpMes) põe(`Mesmo pedaço do mês passado (dia 1 ao ${n.cmpMes.ateDia}): receita ${brl(n.cmpMes.recAnt)} (${pct(n.cmpMes.pctRec)}), despesa ${brl(n.cmpMes.despAnt)} (${pct(n.cmpMes.pctDesp)}).`);
  if (n.maiorCat) põe(`Maior categoria de gasto no mês: ${n.maiorCat[0]}, ${brl(n.maiorCat[1])}.`);

  // CMV do mês. Vem junto porque é a pergunta de dinheiro que ela mais vai
  // fazer em voz alta ("meu CMV tá alto?") — e porque sem estar escrito aqui o
  // Darci é obrigado a responder "não sei".
  const mesCMV = ymOf(n.hoje);
  // Mesmo custo-da-época das telas: se o Darci falasse um número e a tela
  // mostrasse outro, ela pararia de confiar nos dois.
  const cmvMes = cmvDoMes({
    vendas,
    fichas: arr(dados.fichas),
    estoque: estoqueNoMes(arr(dados.estoque), arr(dados.compras), mesCMV).estoque,
    cardapio: arr(dados.cardapio),
    mes: mesCMV,
  });
  põe(cmvMes.pct == null
    ? 'CMV do mês: não dá pra calcular ainda (precisa de venda de comanda e de ficha técnica nos produtos).'
    : `CMV do mês (custo do ingrediente do que foi vendido): ${brl(cmvMes.cmv)}, que é ${cmvMes.pct.toFixed(0)}% da receita dos produtos (${brl(cmvMes.receitaCoberta)}). Margem bruta ${brl(cmvMes.margemBruta)} (${cmvMes.margemBrutaPct.toFixed(0)}%). Referência de bar: saudável até 35%; acima de 45% tem problema. ISSO NÃO É o "custo variável" do DRE, que é o que ela PAGOU de mercadoria no mês — o CMV é o que ela CONSUMIU vendendo.${cmvMes.cobertura != null && cmvMes.cobertura < 100 ? ` Só ${cmvMes.cobertura.toFixed(0)}% do que foi vendido entrou nessa conta; o resto é produto sem ficha técnica${cmvMes.semFicha.length ? ` (${cmvMes.semFicha.slice(0, 5).map((s) => limparNome(s.nome)).join(', ')})` : ''}.` : ''}${cmvMes.insumosSemCusto.length ? ` Insumos sem custo cadastrado deixam o CMV menor do que é: ${cmvMes.insumosSemCusto.slice(0, 5).join(', ')}.` : ''}`);

  // Gasto por categoria e por fornecedor — pra responder "quanto gastei com X".
  const despMes = arr(dados.despesas).filter((d) => d && ymOf(d.data) === ymOf(n.hoje));
  const despAno = arr(dados.despesas).filter((d) => d && String(d.data || '').slice(0, 4) === n.hoje.slice(0, 4));
  if (despMes.length) põe(`Gasto do mês por categoria: ${maiores(despMes, 'categoria', 'valor').map(([k, v]) => `${k} ${brl(v)}`).join(', ')}.`);
  if (despAno.length) põe(`Gasto do ANO por categoria: ${maiores(despAno, 'categoria', 'valor', 12).map(([k, v]) => `${k} ${brl(v)}`).join(', ')}.`);
  const comprasAno = arr(dados.compras).filter((c) => c && String(c.data || '').slice(0, 4) === n.hoje.slice(0, 4))
    .map((c) => ({ fornecedor: c.fornecedor || c.produto, total: num(c.quantidade) * num(c.valorUnit) }));
  if (comprasAno.length) põe(`Compras do ANO por fornecedor: ${maiores(comprasAno, 'fornecedor', 'total', 12).map(([k, v]) => `${k} ${brl(v)}`).join(', ')}.`);

  // --- contas ---
  põe('\n## CONTAS A PAGAR');
  const linhaConta = (c) => `${limparNome(c.fornecedor) || limparNome(c.produto) || 'Conta'} ${brl(num(c.quantidade) * num(c.valorUnit))} vence ${ddmm(c.vencimento)}`;
  põe(arr(n.vencidas).length ? `VENCIDAS (${n.vencidas.length}, total ${brl(n.somaC(n.vencidas))}): ${n.vencidas.slice(0, 10).map(linhaConta).join('; ')}.` : 'Nenhuma conta vencida.');
  põe(arr(n.venceHoje).length ? `VENCE HOJE: ${n.venceHoje.map(linhaConta).join('; ')}.` : '');
  põe(arr(n.vence7).length ? `Vence nos próximos 7 dias (total ${brl(n.somaC(n.vence7))}): ${n.vence7.slice(0, 10).map(linhaConta).join('; ')}.` : 'Nada vencendo nos próximos 7 dias.');
  põe(arr(n.salarios).length ? `Pagamento de pessoal chegando: ${n.salarios.map(linhaConta).join('; ')}.` : '');

  // --- fiado ---
  põe('\n## FIADO A RECEBER');
  põe(`Total em aberto: ${brl(n.aReceber)}, de ${arr(n.devedores).length} cliente(s). Regra: quem tem conta do mês passado paga do dia 01 ao 10; quem começou a consumir depois da virada cai no ciclo seguinte. Hoje é dia ${n.diaDoMes}.`);
  põe(`Desse total, ${brl(n.aReceberAgora)} entra na cobrança deste ciclo e ${brl(n.aReceberProximo)} fica pro próximo.`);
  põe(arr(n.devedores).length ? `Quem deve: ${n.devedores.slice(0, 12).map((d) => `${d.nome} ${brl(d.total)}`).join(', ')}.` : '');
  põe(arr(n.noLimite).length ? `Já bateram o limite: ${n.noLimite.map((d) => d.nome).join(', ')}.` : '');

  // --- estoque ---
  põe('\n## ESTOQUE');
  põe(`Valor parado em mercadoria: ${brl(n.valorEstoque)}.`);
  põe(arr(n.zerados).length ? `ZERADOS: ${n.zerados.map((i) => i.nome).join(', ')}.` : 'Nenhum item zerado.');
  põe(arr(n.baixos).length ? `Abaixo do mínimo: ${n.baixos.map((i) => `${i.nome} (tem ${cent(i.saldo)} ${i.unidade || 'un'}, mínimo ${cent(i.minimo)})`).join(', ')}.` : 'Nada abaixo do mínimo.');
  põe(arr(n.vencendo).length
    ? `VALIDADE — o que vence em até 7 dias: ${arr(n.vencendo).map((v) => `${v.item.nome} ${v.dias < 0 ? `VENCEU há ${Math.abs(v.dias)} dia(s)` : v.dias === 0 ? 'vence HOJE' : `vence em ${v.dias} dia(s)`} (${ddmm(v.item.validade)}, tem ${cent(v.item.saldo)} ${v.item.unidade || 'un'})`).join('; ')}.`
    : 'Nada vencendo nos próximos 7 dias (só conta item com data de validade preenchida).');
  põe(arr(n.ritmo).length
    ? `Ritmo de consumo (quando acaba, no passo dos últimos 21 dias): ${n.ritmo.slice(0, 12).map((r) => `${r.nome} sai ${r.porDia} ${r.unidade}/dia, tem ${cent(r.saldo)}, ${r.jaAcabou ? 'JÁ ZEROU' : `acaba em ${r.diasAte} dia(s), dia ${ddmm(r.acabaEm)}`}`).join('; ')}.`
    : 'Sem saídas registradas pra calcular ritmo.');

  // --- reservas ---
  põe('\n## MESAS RESERVADAS (anotadas pela Mari)');
  põe(arr(n.reservasFuturas).length
    ? n.reservasFuturas.slice(0, 10).map((r) => `${ddmm(r.data)}${r.hora ? ` ${r.hora}` : ''}: ${r.nome}, ${num(r.pessoas) || 1} pessoa(s)${r.obs ? ` — ${r.obs}` : ''}${r.confirmada ? ' [confirmada]' : ''}`).join(' | ')
    : 'Nenhuma mesa reservada.');
  põe(arr(n.riscoReserva).length ? `ATENÇÃO: ${n.riscoReserva.map((x) => `dia ${ddmm(x.reserva.data)} (${x.reserva.nome}, ${num(x.reserva.pessoas) || 1} pessoas) — ${x.itens.map((i) => i.nome).join(', ')} acaba antes`).join('; ')}.` : '');

  // --- produtos ---
  põe('\n## PRODUTOS');
  põe(arr(n.topProdutos).length ? `Mais vendidos (30 dias, por faturamento): ${n.topProdutos.slice(0, 10).map((p) => `${p.nome} ${p.qtd} un (${brl(p.total)})`).join(', ')}.` : 'Sem vendas de comanda nos últimos 30 dias.');
  põe(arr(n.subiram).length ? `Subiram de saída (30 dias vs 30 anteriores): ${n.subiram.slice(0, 5).map((p) => `${p.nome} de ${p.antes} pra ${p.qtd} (${pct(p.pct)})`).join(', ')}.` : '');
  põe(arr(n.cairam).length ? `Caíram de saída: ${n.cairam.slice(0, 5).map((p) => `${p.nome} de ${p.antes} pra ${p.qtd} (${pct(p.pct)})`).join(', ')}.` : '');
  põe(arr(n.margens).length ? `Margens (preço / custo da ficha / margem): ${n.margens.slice(0, 14).map((m) => `${m.nome} ${brl(m.preco)}/${brl(m.custo)}/${Math.round(m.margem)}%${m.completo ? '' : ' (ficha incompleta)'}`).join(', ')}.` : 'Sem ficha técnica pra calcular margem.');
  põe(arr(n.noPrejuizo).length ? `SAINDO NO PREJUÍZO: ${n.noPrejuizo.map((m) => m.nome).join(', ')}.` : '');
  põe(arr(n.altasCusto).length ? `Insumos que subiram de preço na última compra: ${n.altasCusto.slice(0, 6).map((a) => `${a.nome} ${pct(a.pct)} (${brl(a.de)} → ${brl(a.para)})`).join(', ')}.` : '');

  // --- público e tarefas ---
  põe('\n## PÚBLICO');
  const p7 = n.publico.entre(addDays(n.hoje, -6), n.hoje);
  const d7 = n.publico.dias(addDays(n.hoje, -6), n.hoje);
  põe(`Últimos 7 dias: ${p7} pessoa(s) em ${d7} dia(s) de movimento. (A contagem vem do número que o garçom informa ao fechar cada comanda — quando ninguém informa, fica 1 por mesa e o número não vale.)`);

  põe('\n## TAREFAS EM ABERTO');
  põe(arr(n.tarefasAbertas).length ? n.tarefasAbertas.slice(0, 12).map((t) => `${t.texto}${t.data ? ` (${ddmm(t.data)})` : ''}`).join('; ') : 'Nenhuma.');

  return L.join('\n');
}

// Quem ele é e como deve responder. O que mais importa aqui é a regra de não
// inventar: é melhor ele dizer "isso eu não sei" do que chutar um número — a
// Karen toma decisão de dinheiro em cima do que ele fala.
export const INSTRUCOES = `Você é o Darci, sócio da Karen dentro do PicoOS, o sistema do bar Pico do Mané, em Florianópolis.

COMO VOCÊ FALA
- Português do Brasil, bem simples e direto. A Karen não é técnica: nada de jargão de contabilidade ou de sistema.
- Trata ela por "tu". Jeito manezinho da ilha, leve, sem forçar.
- Curto: 2 a 4 frases. A resposta costuma ser lida em voz alta no celular, no meio do movimento do bar.
- Valores sempre em reais escritos por extenso no formato R$ 1.234,56.
- Nada de listas com marcadores, títulos, asteriscos ou emoji. Texto corrido.

DE ONDE SAEM OS NÚMEROS
- Só da FICHA DO BAR abaixo. Ela é o retrato dos dados reais do PicoOS neste momento.
- NUNCA invente, estime ou arredonde um número que não esteja na ficha. Não deduza valor que não foi dado.
- Se a ficha não tem o que ela perguntou, diz isso com todas as letras e explica onde no PicoOS ela consegue: por exemplo "isso eu não tenho aqui; aparece na tela de Margem" ou "pra eu saber isso, o garçom precisa informar quantas pessoas ao fechar a comanda".
- Se a pergunta for ambígua, responde a leitura mais provável e diz qual você assumiu.
- Você pode somar, comparar e calcular porcentagem com os números da ficha. Conta com cuidado.

O QUE FAZ UMA RESPOSTA BOA
- Responde a pergunta primeiro, na primeira frase.
- Quando o número sozinho não diz nada, dá a referência que está na ficha (o mesmo dia da semana, o mês passado, a média).
- Se enxergar um risco de verdade nos dados, avisa em uma frase no fim. Sem sermão.
- Você não tem acesso a nada fora da ficha: não fala de internet, notícia, clima nem do que outros bares fazem.`;
