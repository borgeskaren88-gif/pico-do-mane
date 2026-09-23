import { numQtd } from './util';
import { sugerirItemEstoque, qtdNaUnidadeDoItem, chaveNome } from './estoque';

// ENTRADA DE ESTOQUE FALADA
//
// Ela dita "entrou 5 latas de red bull, 5 coca zero e 2,500 de limao" e isto
// devolve as linhas prontas pra ela CONFERIR antes de gravar.
//
// Por que conferir, se o app que ela viu ja abastece direto: o estoque daqui
// alimenta o CMV, o custo medio, o minimo sugerido, a curva ABC, a validade
// por lote e a conferencia do fechamento de caixa. Um "vinte e cinco" ouvido
// no lugar de "dois e meio" nao estraga so a linha do limao — envenena o mes
// inteiro, e ela so descobriria dias depois sem saber de onde veio.
//
// Aqui nada grava. E so interpretacao, e toda linha e editavel.

const semAcento = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---- numero por extenso (pt-BR) ----
const UNI = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19 };
const DEZ = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
const CEM = { cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900 };
// "meia duzia" e 6, mas "meia" sozinho depois de numero e 0,5. Tratado no
// scanner, que olha o que vem antes.
const ehPalavraNum = (w) => w === 'mil' || UNI[w] != null || DEZ[w] != null || CEM[w] != null;

// ---- unidades ----
// Cada entrada: [regex da palavra falada, unidade canonica].
const UNIDADES = [
  [/^(kg|quilos?|quilogramas?|kilos?)$/, 'kg'],
  [/^(g|gramas?)$/, 'g'],
  [/^(l|lt|litros?)$/, 'L'],
  [/^(ml|mililitros?)$/, 'ml'],
  [/^(un|und|unidades?|unid)$/, 'un'],
  [/^(latas?)$/, 'un'],
  [/^(garrafas?)$/, 'un'],
  [/^(pes?|pecas?)$/, 'un'],
];

// Embalagens que AGRUPAM unidades. Sozinhas valem o padrao da coluna `por`;
// com "de N unidades" dito na frente, vale o N que ela falou.
const EMBALAGENS = [
  [/^(fardos?)$/, 'fardo', null],
  [/^(caixas?|cx)$/, 'caixa', null],
  [/^(pacotes?|pct|pcts)$/, 'pacote', null],
  [/^(engradados?)$/, 'engradado', null],
  [/^(duzias?)$/, 'dúzia', 12],
  [/^(sacos?)$/, 'saco', null],
  [/^(macos?)$/, 'maço', null],
];

// Palavras que so ligam a frase e nunca fazem parte do nome do produto.
const LIGACAO = new Set(['de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em', 'e', 'com', 'mais']);
// Como ela costuma comecar a frase.
const ABERTURA = /^(entrou|entraram|entrada|deu entrada|da entrada|dar entrada|chegou|chegaram|recebi|recebemos|comprei|compramos|coloca|colocar|poe|por|adiciona|adicionar|lanca|lancar|anota|anotar)\b/;
// "no estoque", "no abastecimento" logo depois da abertura.
const ONDE = /^(no |na |em |ao )?(estoque|abastecimento|deposito)\b/;

const achar = (tabela, w) => { for (const linha of tabela) if (linha[0].test(w)) return linha; return null; };

// Le um numero comecando em `i`. Devolve { valor, fim } ou null.
//
// Consome a frase INTEIRA do numero: "vinte e cinco" e 25 (um numero), nao 20
// e depois 5 — senao "vinte e cinco caixas" viraria duas linhas.
function lerNumero(tokens, i) {
  const t = tokens[i];
  if (t == null) return null;

  // Digitos: "5", "2,5", "2,500", "2.5". Virgula e ponto sao SEMPRE decimal
  // aqui: ninguem dita mil e quinhentos quilos de limao, e numQtd() ja trata
  // o ponto do teclado do celular como decimal.
  if (/^\d+([.,]\d+)?$/.test(t)) {
    const valor = numQtd(t.replace(',', '.'));
    // Quantidade zero nao e entrada; deixa passar como texto.
    return valor > 0 ? { valor, fim: i + 1 } : null;
  }

  if (!ehPalavraNum(t)) return null;

  // "zero" e palavra de numero, e isso quebrava "coca zero": virava o produto
  // "coca" e uma linha nova de quantidade 0. Entrada de zero nao existe, entao
  // zero nunca abre linha — vira nome de produto, que e o que ela quis dizer.
  if (t === 'zero') return null;

  let total = 0, atual = 0, fim = i, viu = false;
  // A grandeza do ultimo pedaco somado. Em portugues, o que vem depois do "e"
  // e sempre MENOR: "sessenta e dois" existe, "seis e cinquenta" nao — essa
  // segunda e dinheiro (seis reais e cinquenta centavos), nao numeral.
  //
  // Sem essa regra, "seis e cinquenta o quilo" virava 56, e "dois e meio"
  // continuava certo so por sorte. O erro e caro e silencioso: entra 56 kg de
  // limao no estoque e o custo do mes inteiro sai torto.
  let ultimo = Infinity;
  while (fim < tokens.length) {
    const w = tokens[fim];
    if (w === 'e') {
      // "e" so continua o numero se o proximo token ainda for numero (ou
      // "meio"). "cinco e limao" para aqui.
      const p = tokens[fim + 1];
      if (p === 'meio' || p === 'meia') { total += atual; atual = 0; total += 0.5; fim += 2; viu = true; break; }
      if (p == null || !ehPalavraNum(p)) break;
      const vp = UNI[p] != null ? UNI[p] : DEZ[p] != null ? DEZ[p] : CEM[p] != null ? CEM[p] : (p === 'mil' ? 1000 : null);
      if (vp == null || vp >= ultimo) break;
      fim += 1;
      continue;
    }
    if (w === 'mil') { atual = (atual === 0 ? 1 : atual) * 1000; total += atual; atual = 0; ultimo = 1000; fim += 1; viu = true; continue; }
    const v = UNI[w] != null ? UNI[w] : DEZ[w] != null ? DEZ[w] : CEM[w] != null ? CEM[w] : null;
    if (v == null) break;
    atual += v;
    ultimo = v;
    fim += 1;
    viu = true;
  }
  if (!viu) return null;
  return { valor: total + atual, fim };
}

// ---- DINHEIRO ----
//
// Palavras que marcam que o numero seguinte e PRECO, e nao uma nova linha de
// produto. Sem isso, "5 red bull a 8 reais" virava duas linhas: cinco red bull
// e oito "reais".
const MOEDA = /^(reais?|real|r\$|conto|contos|pila|pilas)$/;

// "a 8 reais" e cada um; "por 120 reais" e o total da compra toda. A diferenca
// existe na fala das pessoas e e consistente — entao vale honrar, em vez de
// obrigar ela a falar do jeito do sistema.
const MARCA_UNIT = new Set(['a', 'custando', 'cada']);
const MARCA_TOTAL = new Set(['por', 'deu', 'saiu', 'total', 'totalizando', 'fechou']);
// O que costuma vir DEPOIS do valor confirmando que e unitario.
const DEPOIS_UNIT = /^(cada|unidade|unitario)$/;
// As medidas que aparecem em "o quilo", "por litro", "a unidade".
const MEDIDA_UNIT = /^(quilo|quilos|kg|litro|litros|l|un|unidade|unidades|saco|pacote)$/;

// Le um valor em dinheiro, com os centavos ditos do jeito que se fala.
//
// "sessenta e dois" ja sai 62 do leitor de numeros (numeral valido). O que ele
// recusa de proposito — "seis e cinquenta" — e justamente o formato de
// dinheiro, e e aqui que ele vira 6,50.
//
// Devolve tambem se a MOEDA foi dita e se houve CENTAVOS, porque sao esses os
// sinais de que o numero e dinheiro e nao outra coisa.
function lerDinheiro(tokens, i) {
  const n = lerNumero(tokens, i);
  if (!n) return null;
  let valor = n.valor;
  let fim = n.fim;
  let moeda = false;
  let centavos = false;

  // "seis reais e cinquenta", "seis reais e cinquenta centavos", "seis e cinquenta"
  if (MOEDA.test(tokens[fim] || '')) { moeda = true; fim += 1; }
  if (tokens[fim] === 'e') {
    const c = lerNumero(tokens, fim + 1);
    // Centavos vao de 1 a 99. Acima disso nao e centavo — e outra coisa que o
    // leitor de numeros ja teria juntado sozinho, se fosse pra juntar.
    //
    // E o "e <numero>" depois do valor e AMBIGUO: em "oito reais e cinquenta"
    // sao centavos, mas em "oito reais E 3 QUILOS DE LIMAO" e o proximo
    // produto da lista. Ler errado aqui virava R$ 8,03 e engolia o limao
    // inteiro — o tipo de erro que so aparece semanas depois, no custo.
    //
    // So e centavo quando o que vem depois FECHA o valor: acabou a frase,
    // veio "centavos", ou veio a medida ("o quilo", "cada"). Qualquer outra
    // coisa e o comeco de outra linha.
    if (c && c.valor >= 1 && c.valor <= 99 && Number.isInteger(c.valor)) {
      const depois = tokens[c.fim] || '';
      const seguinte = tokens[c.fim + 1] || '';
      const fecha = depois === '' || depois === 'centavos' || depois === 'centavo'
        || DEPOIS_UNIT.test(depois)
        || ((depois === 'o' || depois === 'a' || depois === 'por') && MEDIDA_UNIT.test(seguinte));
      if (fecha) {
        let k = c.fim;
        if (depois === 'centavos' || depois === 'centavo') k += 1;
        valor += c.valor / 100;
        centavos = true;
        fim = k;
      }
    }
  }
  if (MOEDA.test(tokens[fim] || '')) { moeda = true; fim += 1; }
  return { valor: Math.round(valor * 100) / 100, moeda, centavos, fim };
}

// Le um preco na posicao `i`, se houver um ali.
//
// Exige SINAL de que o numero e dinheiro: a moeda dita, centavos, um "o quilo"
// atras, ou um "por" na frente. Sem sinal nenhum, "a 8" poderia ser qualquer
// coisa, e chutar preco ali seria pior do que nao entender.
function lerPreco(tokens, i) {
  const w = tokens[i] || '';
  const temMarca = MARCA_UNIT.has(w) || MARCA_TOTAL.has(w);
  const d = lerDinheiro(tokens, temMarca ? i + 1 : i);
  if (!d) return null;

  // O que vem depois do valor e diz que ele e por unidade: "cada", "o quilo",
  // "a unidade", "por litro".
  let fim = d.fim;
  let porUnidade = false;
  if (DEPOIS_UNIT.test(tokens[fim] || '')) { porUnidade = true; fim += 1; }
  else if (tokens[fim] === 'a' && tokens[fim + 1] === 'unidade') { porUnidade = true; fim += 2; }
  else if ((tokens[fim] === 'o' || tokens[fim] === 'por') && MEDIDA_UNIT.test(tokens[fim + 1] || '')) { porUnidade = true; fim += 2; }

  if (!(d.moeda || d.centavos || porUnidade || MARCA_TOTAL.has(w))) return null;

  if (porUnidade) return { valor: d.valor, tipo: 'unit', suposto: false, fim };
  if (MARCA_TOTAL.has(w)) return { valor: d.valor, tipo: 'total', suposto: false, fim };
  if (MARCA_UNIT.has(w)) return { valor: d.valor, tipo: 'unit', suposto: false, fim };
  // Valor solto com a moeda dita e sem mais nada: e preco, mas nao da pra saber
  // se e de um ou do todo. Assume o total — que e o numero que ela leu na nota —
  // e marca como suposto, pra tela perguntar em vez de decidir sozinha.
  return { valor: d.valor, tipo: 'total', suposto: true, fim };
}

// Le a unidade/embalagem que vem depois do numero, incluindo o "de N unidades"
// de um fardo. Devolve { unidade, embalagem, fim }.
function lerUnidade(tokens, i) {
  let fim = i;
  // "meia duzia": o "meia" ja foi lido como 0,5 pelo scanner; aqui o que
  // importa e a duzia, e 0,5 x 12 = 6 sai certo sozinho.
  const emb = achar(EMBALAGENS, tokens[fim] || '');
  if (emb) {
    fim += 1;
    let por = emb[2];
    // "fardo de 24 unidades" / "caixa de 12" — o numero aqui NAO abre linha
    // nova, ele diz quantas unidades tem dentro.
    let j = fim;
    if (tokens[j] === 'de' || tokens[j] === 'com') j += 1;
    const n = lerNumero(tokens, j);
    if (n && n.valor > 0) {
      let k = n.fim;
      const u = achar(UNIDADES, tokens[k] || '');
      // So conta como conteudo da embalagem se veio uma unidade junto
      // ("de 24 unidades") ou se o numero cola logo depois ("caixa de 12").
      if (u && u[1] === 'un') k += 1;
      por = n.valor;
      fim = k;
    }
    return { unidade: 'un', embalagem: { nome: emb[1], por: por || null }, fim };
  }
  const u = achar(UNIDADES, tokens[fim] || '');
  if (u) return { unidade: u[1], embalagem: null, fim: fim + 1 };
  return { unidade: null, embalagem: null, fim };
}

// Um numero no MEIO do nome do produto — "coca cola lata 350 ml", "cerveja
// original 600 ml", "vodka 5 l".
//
// A regra geral e que todo numero abre linha nova, e ela e boa: "5 red bull e
// 3 limao" tem que virar duas linhas. Mas metade dos itens dela tem numero no
// nome, e ai o nome se partia no meio — "coca cola lata" numa linha e um
// produto fantasma de 350 ml na outra, levando o preco junto.
//
// O que separa um caso do outro sao duas coisas: o tamanho vem COLADO no nome
// (sem o "e" que separa um item do outro) e traz medida junto. "coca cola 350
// ML" e tamanho; "e 500 G de alho" e o proximo item; "e 20 COCA" nem medida
// tem, entao e quantidade.
function numeroEhDoNome(tokens, j, nome) {
  if (!nome.length) return false;              // numero no comeco e quantidade
  if (tokens[j - 1] === 'e') return false;     // "e 500 g de alho" e outro item
  const n = lerNumero(tokens, j);
  if (!n) return false;
  // Tem que vir uma MEDIDA colada: "350 ml", "600 ml", "5 l". Sem medida
  // ("e 20 coca") o numero e quantidade de outro produto, como sempre foi.
  return !!achar(UNIDADES, tokens[n.fim] || '');
}

// Quebra a fala em linhas. Cada NUMERO abre uma linha nova; o que vem depois
// dele (fora unidade e ligacao) e o nome do produto.
//
// Separar por virgula ou por " e " nao funcionaria: "dois quilos e meio de
// limao" tem um "e" no meio do numero, e "coca zero" nao tem separador nenhum.
export function fatiarFala(texto) {
  // Tira a pontuacao da frase, MENOS o ponto e a virgula que estao entre
  // digitos: "2,500" e "2.500" sao dois e meio, e virar "2 500" fazia entrar
  // quinhentos quilos de limao numa frase de dois e meio.
  let t = semAcento(texto).replace(/;/g, ' ').replace(/\.(?!\d)/g, ' ').replace(/,(?!\d)/g, ' ');
  // O iPhone transcreve a unidade colada no numero ("2,500kg", "5un"). Sem
  // descolar, o token inteiro nao e numero e a linha toda vira nome de produto.
  t = t.replace(/(\d)\s*([a-z])/g, '$1 $2');
  t = t.replace(ABERTURA, ' ').trim();
  t = t.replace(ONDE, ' ').trim();
  const tokens = t.split(/\s+/).filter(Boolean);

  const linhas = [];
  let i = 0;
  let sobra = [];
  while (i < tokens.length) {
    // "entrou FARDO de 24 coca": a embalagem abre a linha sem numero nenhum na
    // frente, e um fardo dito sozinho e um fardo.
    const n = lerNumero(tokens, i) || (achar(EMBALAGENS, tokens[i] || '') ? { valor: 1, fim: i } : null);
    if (!n) { sobra.push(tokens[i]); i += 1; continue; }
    const u = lerUnidade(tokens, n.fim);
    let qtd = n.valor;
    let j = u.fim;
    // "dois quilos E MEIO de limao": o meio vem DEPOIS da unidade, nao colado
    // no numero. Lido aqui, senao "meio" virava nome de produto.
    if (tokens[j] === 'e' && (tokens[j + 1] === 'meio' || tokens[j + 1] === 'meia')) { qtd += 0.5; j += 2; }
    // O nome vai daqui ate o proximo numero — MENOS quando esse numero e o
    // preco. "5 red bull a 8 reais" tem dois numeros e uma linha so: o segundo
    // e dinheiro, e tratar ele como nova linha criava um produto chamado
    // "reais" e perdia o preco.
    const nome = [];
    let preco = null;
    while (j < tokens.length) {
      const pr = preco ? null : lerPreco(tokens, j);
      if (pr) { preco = pr; j = pr.fim; continue; }
      if (lerNumero(tokens, j) && !numeroEhDoNome(tokens, j, nome)) break;
      nome.push(tokens[j]);
      j += 1;
    }
    // Tira as ligacoes das PONTAS; no meio elas ficam ("agua de coco").
    while (nome.length && LIGACAO.has(nome[0])) nome.shift();
    while (nome.length && LIGACAO.has(nome[nome.length - 1])) nome.pop();
    linhas.push({ qtd, unidade: u.unidade, embalagem: u.embalagem, produto: nome.join(' '), preco });
    i = j;
  }
  return { linhas, sobra: sobra.join(' ').trim() };
}

// Acha o item do estoque pelo nome falado.
//
// Primeiro tenta o casador das compras, que e conservador de proposito (so
// palavra inteira, e nao chuta em empate). Se ele nao achar, tenta de novo SEM
// OS ESPACOS: quem dita "red bull" recebe do iPhone "redbull" tanto quanto
// "Red Bull", e as duas formas tem que cair no mesmo item.
//
// Essa segunda tentativa nunca devolve `exato`, entao a linha sempre vai pedir
// conferencia na tela. E tambem nunca chuta em empate — se duas colarem, ela
// escolhe na mao.
function acharItem(produto, estoque) {
  const direto = sugerirItemEstoque(produto, estoque);
  if (direto) return direto;

  const semEspaco = (s) => chaveNome(s).replace(/\s+/g, '');
  const alvo = semEspaco(produto);
  if (alvo.length < 4) return null;

  const itens = Array.isArray(estoque) ? estoque : [];
  const iguais = itens.filter((it) => it && semEspaco(it.nome) === alvo);
  if (iguais.length === 1) return { item: iguais[0], exato: false };
  if (iguais.length > 1) return null;

  const parecidos = itens.filter((it) => {
    const n = semEspaco(it && it.nome);
    return n.length >= 4 && (n.includes(alvo) || alvo.includes(n));
  });
  return parecidos.length === 1 ? { item: parecidos[0], exato: false } : null;
}

// Quanto entra de verdade, na unidade do item do estoque.
function quantoEntra(linha, item) {
  const base = linha.qtd;
  if (linha.embalagem) {
    // Fardo/caixa: multiplica pelo que tem dentro. Sem saber quantas unidades
    // tem, nao inventa — devolve null e a tela pergunta.
    const por = linha.embalagem.por;
    if (!(por > 0)) return null;
    return Math.round(base * por * 1000) / 1000;
  }
  // Sem unidade dita, vale a unidade que o item ja tem cadastrada: foi ela que
  // cadastrou, e e nisso que o saldo esta.
  if (!linha.unidade) return Math.round(base * 1000) / 1000;
  return Math.round(qtdNaUnidadeDoItem(base, linha.unidade, item) * 1000) / 1000;
}

// O dinheiro da linha, traduzido pro que o sistema precisa: quanto foi gasto no
// total e quanto custa UMA unidade do item de estoque.
//
// O preco unitario falado vale pela COISA QUE ELA CONTOU, nao pela unidade do
// item: "2 fardos a 62 reais cada" sao R$ 124 no total e R$ 2,58 a lata. Tratar
// os 62 como preco da lata multiplicaria o custo por 24 — e esse erro entraria
// calado no CMV.
function dinheiroDaLinha(linha, qtdItem) {
  const p = linha.preco;
  if (!p || !(p.valor > 0)) return null;
  const total = p.tipo === 'total' ? p.valor : Math.round(p.valor * linha.qtd * 100) / 100;
  const custoUnit = qtdItem > 0 ? Math.round((total / qtdItem) * 10000) / 10000 : null;
  return { total, custoUnit, tipo: p.tipo, suposto: !!p.suposto, falado: p.valor };
}

// A fala virada em linhas conferiveis, cada uma ligada (ou nao) a um item.
//
// `nivel` diz o que a tela faz com a linha:
//   ok         — achou o item pelo nome exato, pode confirmar
//   confira    — achou por semelhanca, ou falta dizer quantas unidades tem o
//                fardo: precisa do olho dela antes
//   nao-achei  — nenhum item bate; ela escolhe na mao ou cadastra
export function entendeEntradaFalada(texto, estoque = []) {
  const { linhas, sobra } = fatiarFala(texto);
  const saida = linhas.map((l, idx) => {
    const achado = l.produto ? acharItem(l.produto, estoque) : null;
    const item = achado ? achado.item : null;
    const qtdItem = item ? quantoEntra(l, item) : null;
    const dinheiro = dinheiroDaLinha(l, qtdItem);
    let nivel = 'nao-achei';
    let recado = '';
    if (!l.produto) { recado = 'Não entendi o nome do produto.'; }
    else if (!item) { recado = `Não achei "${l.produto}" no abastecimento.`; }
    else if (qtdItem == null) { nivel = 'confira'; recado = `Quantas unidades tem o ${l.embalagem.nome}?`; }
    else if (!achado.exato) { nivel = 'confira'; recado = `Entendi como "${item.nome}" — confere?`; }
    // Valor dito sem "cada" nem "por": e preco, mas ela nao disse de qual. O
    // sistema chuta o total e PERGUNTA, em vez de decidir sozinho — errar aqui
    // multiplica ou divide o custo pela quantidade.
    else if (dinheiro && dinheiro.suposto) { nivel = 'confira'; recado = `R$ ${dinheiro.total.toFixed(2).replace('.', ',')} foi o total ou o preço de cada?`; }
    else nivel = 'ok';
    return {
      id: `f${idx}`,
      falado: l.produto,
      qtdFalada: l.qtd,
      unidadeFalada: l.unidade,
      embalagem: l.embalagem,
      item,
      qtd: qtdItem,
      unidade: item ? (item.unidade || 'un') : (l.unidade || 'un'),
      dinheiro,
      nivel,
      recado,
    };
  });
  return { linhas: saida, sobra };
}

// Uma frase curta do que ele entendeu, pra ela conferir de ouvido sem ler a
// tela inteira no meio do movimento do bar.
export function resumoDaFala(linhas) {
  const prontas = (linhas || []).filter((l) => l.item && l.qtd > 0);
  if (!prontas.length) return 'Não consegui entender nenhuma entrada.';
  return prontas.map((l) => `${l.qtd} ${l.unidade} de ${l.item.nome}`).join(', ');
}
