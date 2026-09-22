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
  while (fim < tokens.length) {
    const w = tokens[fim];
    if (w === 'e') {
      // "e" so continua o numero se o proximo token ainda for numero (ou
      // "meio"). "cinco e limao" para aqui.
      const p = tokens[fim + 1];
      if (p === 'meio' || p === 'meia') { total += atual; atual = 0; total += 0.5; fim += 2; viu = true; break; }
      if (p == null || !ehPalavraNum(p)) break;
      fim += 1;
      continue;
    }
    if (w === 'mil') { atual = (atual === 0 ? 1 : atual) * 1000; total += atual; atual = 0; fim += 1; viu = true; continue; }
    const v = UNI[w] != null ? UNI[w] : DEZ[w] != null ? DEZ[w] : CEM[w] != null ? CEM[w] : null;
    if (v == null) break;
    atual += v;
    fim += 1;
    viu = true;
  }
  if (!viu) return null;
  return { valor: total + atual, fim };
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
    const n = lerNumero(tokens, i);
    if (!n) { sobra.push(tokens[i]); i += 1; continue; }
    const u = lerUnidade(tokens, n.fim);
    let qtd = n.valor;
    let j = u.fim;
    // "dois quilos E MEIO de limao": o meio vem DEPOIS da unidade, nao colado
    // no numero. Lido aqui, senao "meio" virava nome de produto.
    if (tokens[j] === 'e' && (tokens[j + 1] === 'meio' || tokens[j + 1] === 'meia')) { qtd += 0.5; j += 2; }
    // O nome vai daqui ate o proximo numero.
    const nome = [];
    while (j < tokens.length) {
      if (lerNumero(tokens, j)) break;
      nome.push(tokens[j]);
      j += 1;
    }
    // Tira as ligacoes das PONTAS; no meio elas ficam ("agua de coco").
    while (nome.length && LIGACAO.has(nome[0])) nome.shift();
    while (nome.length && LIGACAO.has(nome[nome.length - 1])) nome.pop();
    linhas.push({ qtd, unidade: u.unidade, embalagem: u.embalagem, produto: nome.join(' ') });
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
    let nivel = 'nao-achei';
    let recado = '';
    if (!l.produto) { recado = 'Não entendi o nome do produto.'; }
    else if (!item) { recado = `Não achei "${l.produto}" no abastecimento.`; }
    else if (qtdItem == null) { nivel = 'confira'; recado = `Quantas unidades tem o ${l.embalagem.nome}?`; }
    else if (!achado.exato) { nivel = 'confira'; recado = `Entendi como "${item.nome}" — confere?`; }
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
