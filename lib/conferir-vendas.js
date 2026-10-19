import { num, totalCompra, ymOf, mesLabel, CUSTO_VARIAVEL } from './util';
import { cmvDoMes, estoqueNoMes } from './cmv';

// AS VENDAS BATEM COM O ESTOQUE?
//
// "Num sábado normal saem de 20 a 30 batatas, pois muitas das porções leva
// batata." E o sistema tinha contado menos de 3 porções fritas por dia.
//
// Se a diferença for real, ela é muito maior que o óleo: venda que não passa
// pelo app não entra no CMV, não entra no relatório do mês e não entra no
// aviso do teto do MEI — que passaria a dizer que ela está longe do limite
// justamente quando não está.
//
// COMO DÁ PRA SABER SEM CONTAR NADA NA MÃO:
//
// Mercadoria comprada não mente. Ela paga, lança e a nota existe. Então dá pra
// perguntar: o que as vendas dizem ter consumido chega perto do que ela
// comprou?
//
//     comprado  = o que ela pagou de mercadoria no período (custo variável)
//     explicado = o CMV do mesmo período (ficha × o que foi vendido)
//
// A comparação é EM DINHEIRO de propósito. Em quantidade não fecharia: ela
// compra batata em quilo e a ficha consome "Batata 400g" ensacado, compra
// bebida em caixa e vende em dose. Dinheiro atravessa tudo isso.
//
// E É POR VÁRIOS MESES, não por um. Num mês só, uma compra grande no dia 28
// derruba a conta sem nada estar errado. Em três meses o estoque sobe e desce
// e a diferença que sobra é diferença de verdade.
//
// O QUE A DIFERENÇA PODE SER — e a ordem importa, porque a primeira hipótese
// tem conserto diferente das outras:
//
//   1. FICHA INCOMPLETA. Se metade dos produtos vendidos não tem ficha, o CMV
//      sai pequeno sozinho, e nada está errado com as vendas. Por isso a
//      cobertura vem junto do número: sem ela, a conta acusaria inocente.
//   2. VENDA FORA DO APP. Comanda no papel, venda direto no caixa.
//   3. PERDA, consumo da casa, cortesia não lançados.
//   4. ESTOQUE SUBINDO de verdade (ela encheu a câmara).

const ultimoDiaDoMes = (ym) => {
  const [a, m] = String(ym).split('-').map(Number);
  return new Date(a, m, 0).toISOString().slice(0, 10);
};

// Os N meses FECHADOS antes do mês corrente. O mês em curso tem compra
// lançada e venda pela metade — entraria torto.
export function mesesFechados(hojeISO, n = 3) {
  const y = Number(String(hojeISO).slice(0, 4));
  const m = Number(String(hojeISO).slice(5, 7));
  const out = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(y, m - 1 - i, 1);
    out.unshift(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export function conferirVendas({ compras = [], vendas = [], fichas = [], estoque = [], cardapio = [], hoje, meses = 3 } = {}) {
  const lista = mesesFechados(hoje, meses);
  if (!lista.length) return null;

  let comprado = 0;
  let explicado = 0;
  let receitaComFicha = 0;
  let receitaSemFicha = 0;
  const porMes = [];

  for (const mes of lista) {
    // Só MERCADORIA. Aluguel e salário não têm nada a ver com o que saiu da
    // prateleira, e somá-los faria qualquer bar parecer um ladrão de si mesmo.
    const c = compras
      .filter((x) => x && ymOf(x.data) === mes && CUSTO_VARIAVEL.includes(x.tipoConta || 'Fornecedores de insumo'))
      .reduce((s, x) => s + totalCompra(x), 0);

    const k = cmvDoMes({ vendas, fichas, estoque: estoqueNoMes(estoque, compras, mes).estoque, cardapio, mes });

    comprado += c;
    explicado += num(k.cmv);
    receitaComFicha += num(k.receitaCoberta);
    receitaSemFicha += num(k.receitaSemFicha);
    porMes.push({
      mes, rotulo: mesLabel(mes),
      comprado: Math.round(c * 100) / 100,
      explicado: Math.round(num(k.cmv) * 100) / 100,
      pct: c > 0 ? Math.round((num(k.cmv) / c) * 1000) / 10 : null,
    });
  }

  comprado = Math.round(comprado * 100) / 100;
  explicado = Math.round(explicado * 100) / 100;
  const receita = receitaComFicha + receitaSemFicha;
  // Quanto do que foi VENDIDO tem ficha pra custear. Sem isto o número de cima
  // não pode ser lido: ficha faltando derruba o CMV sem nenhuma venda sumir.
  const cobertura = receita > 0 ? (receitaComFicha / receita) * 100 : null;

  if (!(comprado > 0)) return { lista, porMes, comprado, explicado, cobertura, estado: 'sem-compras' };
  if (!(explicado > 0)) return { lista, porMes, comprado, explicado, cobertura, estado: 'sem-cmv' };

  // SISTEMA ENTRANDO EM USO NÃO É VAZAMENTO — e eu quase a fiz desconfiar da
  // própria equipe por causa disso.
  //
  // Os três meses dela vieram assim: julho explicou R$ 0,00, agosto 56%,
  // setembro 116%. A média deu 41% e o card acusou "venda que não passou pelo
  // app" em primeiro lugar. Mas julho zerado não é venda sumindo: é mês em que
  // o app ainda não estava rodando. E setembro acima de 100% é o contrário de
  // problema — vendeu estoque comprado antes.
  //
  // Todo bar que começa a usar o sistema passa por isso. Um número que acusa
  // justamente quem acabou de adotar a ferramenta é um número que ensina a
  // ignorar o sistema.
  const comVenda = porMes.filter((m) => m.explicado > 0);
  const semVendaNenhuma = porMes.filter((m) => m.comprado > 0 && m.explicado <= 0);
  const ultimo = porMes[porMes.length - 1];
  const ultimoOk = ultimo && ultimo.pct != null && ultimo.pct >= 75;
  const entrandoEmUso = semVendaNenhuma.length > 0 && ultimoOk;
  // Sem mês zerado, mas subindo forte e terminando bem: também é rodagem.
  const melhorando = !entrandoEmUso && ultimoOk && comVenda.length >= 2
    && comVenda[0].pct != null && ultimo.pct - comVenda[0].pct >= 30;

  const pct = (explicado / comprado) * 100;
  // As faixas são largas porque a conta é grosseira: estoque oscila, nota
  // atrasa, ficha arredonda. Só chama atenção o que não dá pra explicar assim.
  // O estado olha primeiro a RODAGEM: um período que começou sem app e
  // terminou saudável não pode ser lido pela média, que é passado.
  const estado = (entrandoEmUso || melhorando) ? 'rodagem'
    : pct >= 75 ? 'bate' : pct >= 45 ? 'folga' : 'buraco';

  return {
    lista, porMes, comprado, explicado, cobertura,
    pct: Math.round(pct * 10) / 10,
    diferenca: Math.round((comprado - explicado) * 100) / 100,
    // Cobertura baixa muda a leitura: o problema provável passa a ser a ficha,
    // não a venda. Dizer "tua venda está sumindo" quando é ficha faltando é
    // mandar ela procurar ladrão onde tem cadastro incompleto.
    culpaProvavel: (entrandoEmUso || melhorando) ? 'rodagem'
      : cobertura != null && cobertura < 70 ? 'ficha' : 'venda',
    estado,
    entrandoEmUso, melhorando, ultimo,
    mesesSemVenda: semVendaNenhuma.map((m) => m.rotulo),
  };
}
