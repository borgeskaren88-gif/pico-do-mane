// PROCURAR NAS DESPESAS, COM PERÍODO E SOMA.
//
// "Quero que a parte de despesas seja inteligente: que eu consiga saber quanto
// gastei de pró-labore em 90 dias, e que se eu pesquisar uma palavra-chave tipo
// 'claude' ele puxe tudo que paguei com esse nome."
//
// A tela tinha um filtro de MÊS e mais nada. Pra responder "quanto de
// pró-labore nos últimos 90 dias" ela tinha que abrir três meses, anotar três
// números num papel e somar. Pra achar "claude" ela tinha que ler a lista
// inteira com o olho.
//
// A BUSCA TEM QUE PERDOAR COMO A PESSOA ESCREVE.
//
// A categoria no banco é "Pró-labore (sócios)", com acento e hífen. Ninguém
// digita assim no celular: digita "pro labore", sem acento e com espaço. Uma
// busca literal não acharia nada, e ela concluiria — com razão — que o app não
// sabe procurar.
//
// Então tudo vira a mesma régua antes de comparar: minúsculo, sem acento, e
// todo sinal (hífen, parêntese, barra, ponto) vira espaço. "Pró-labore
// (sócios)" e "pro labore" chegam no mesmo lugar.
//
// E TODAS AS PALAVRAS PRECISAM APARECER, não qualquer uma. Procurar "gás
// cozinha" com "qualquer uma" devolveria toda conta de gás E toda compra de
// cozinha — centenas de linhas, nenhuma delas o que ela queria.

import { num, ymOf, MESES } from './util';

const arr = (v) => (Array.isArray(v) ? v : []);
const n2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// A régua única: minúsculo, sem acento, sinal vira espaço.
export const chaveBusca = (s) => String(s == null ? '' : s)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const termosDe = (q) => chaveBusca(q).split(' ').filter(Boolean);

// Onde a busca olha: categoria, descrição e observação. A categoria entra de
// propósito — é como ela pensa ("pró-labore", "aluguel"), e deixá-la de fora
// obrigaria a lembrar o que foi digitado na descrição meses atrás.
export const textoDe = (d) => chaveBusca(`${(d && d.categoria) || ''} ${(d && d.descricao) || ''} ${(d && d.obs) || ''}`);

export const casa = (d, termos) => {
  if (!termos.length) return true;
  const t = textoDe(d);
  return termos.every((x) => t.includes(x));
};

const dias = (de, ate) => {
  const a = new Date(`${de}T12:00:00Z`);
  const b = new Date(`${ate}T12:00:00Z`);
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
};

const recuar = (iso, d) => {
  const x = new Date(`${iso}T12:00:00Z`);
  if (isNaN(x)) return iso;
  x.setUTCDate(x.getUTCDate() - Number(d || 0));
  return x.toISOString().slice(0, 10);
};

export const mesCurto = (ym) => {
  const i = parseInt(String(ym).slice(5), 10) - 1;
  return MESES[i] ? `${MESES[i]}/${String(ym).slice(2, 4)}` : ym;
};

// O RESUMO DA BUSCA.
//
// Devolve o total, a lista, o gasto mês a mês e a comparação com o período
// IGUAL logo antes. Essa comparação é o que transforma um número solto em
// informação: "R$ 4.500 de pró-labore em 90 dias" não diz nada sozinho; "R$
// 4.500, contra R$ 3.000 nos 90 dias anteriores" diz que subiu 50%.
export function resumoBusca(dados, { termo = '', de = '', ate = '' } = {}) {
  const termos = termosDe(termo);
  const todos = arr(dados).filter((d) => d && d.data);
  const dentro = (lista, d1, d2) => lista.filter((d) => d.data >= d1 && d.data <= d2);

  // Sem data de início, o período é tudo que existe.
  const datas = todos.map((d) => d.data).sort();
  const d1 = de || datas[0] || ate || '';
  const d2 = ate || datas[datas.length - 1] || d1;

  const casaram = todos.filter((d) => casa(d, termos));
  const itens = (d1 ? dentro(casaram, d1, d2) : casaram)
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const total = n2(itens.reduce((s, d) => s + num(d.valor), 0));

  // Mês a mês, do mais velho pro mais novo: é assim que se vê se está subindo.
  const porMesMap = new Map();
  for (const d of itens) {
    const ym = ymOf(d.data);
    const cur = porMesMap.get(ym) || { ym, rot: mesCurto(ym), total: 0, n: 0 };
    cur.total = n2(cur.total + num(d.valor));
    cur.n += 1;
    porMesMap.set(ym, cur);
  }
  const porMes = [...porMesMap.values()].sort((a, b) => a.ym.localeCompare(b.ym));

  // Por categoria: uma palavra-chave costuma cair em mais de uma. "Claude"
  // pode estar metade em Assinaturas e metade em Sistemas, e saber disso é o
  // começo de arrumar o cadastro.
  const porCatMap = new Map();
  for (const d of itens) {
    const c = d.categoria || 'Sem categoria';
    const cur = porCatMap.get(c) || { categoria: c, total: 0, n: 0 };
    cur.total = n2(cur.total + num(d.valor));
    cur.n += 1;
    porCatMap.set(c, cur);
  }
  const porCategoria = [...porCatMap.values()].sort((a, b) => b.total - a.total);

  const janela = d1 ? dias(d1, d2) : 0;
  const mesesNaJanela = janela ? Math.max(1, Math.round(janela / 30.44)) : 0;

  // O MESMO TAMANHO DE JANELA, LOGO ANTES. Comparar 90 dias com um mês solto
  // diria que o gasto caiu dois terços quando não caiu nada.
  let anterior = null;
  if (d1 && janela) {
    const a2 = recuar(d1, 1);
    const a1 = recuar(d1, janela);
    const lista = dentro(casaram, a1, a2);
    const t = n2(lista.reduce((s, d) => s + num(d.valor), 0));
    anterior = { de: a1, ate: a2, total: t, n: lista.length };
  }

  return {
    termos,
    de: d1,
    ate: d2,
    dias: janela,
    itens,
    n: itens.length,
    total,
    porMes,
    porCategoria,
    mediaMes: mesesNaJanela ? n2(total / mesesNaJanela) : 0,
    mesesNaJanela,
    anterior,
    // Só compara quando havia o que comparar: dividir por zero viraria "subiu
    // infinito%", que é a cara de um app quebrado.
    variacaoPct: anterior && anterior.total > 0 ? Math.round(((total - anterior.total) / anterior.total) * 100) : null,
  };
}

// O QUE OFERECER QUANDO O CAMPO ESTÁ VAZIO.
//
// Campo de busca em branco é uma parede: ela precisa adivinhar o que o app
// aceita. Então a tela mostra as categorias em que mais saiu dinheiro no
// período, prontas pra tocar. Vira busca sem digitar nada.
export function sugestoes(dados, { de = '', ate = '', quantas = 6 } = {}) {
  const m = new Map();
  for (const d of arr(dados)) {
    if (!d || !d.data) continue;
    if (de && d.data < de) continue;
    if (ate && d.data > ate) continue;
    const c = d.categoria || '';
    if (!c) continue;
    m.set(c, n2((m.get(c) || 0) + num(d.valor)));
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, quantas).map(([categoria, total]) => ({ categoria, total }));
}
