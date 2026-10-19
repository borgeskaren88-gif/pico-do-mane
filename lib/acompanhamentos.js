import { numQtd } from './util';

// ACOMPANHAMENTOS — o ketchup, o limão, o molho, o palito.
//
// "Tem o ketchup que vai, tem limão fatia que vai nas porções."
//
// Eles saem junto com a porção, custam dinheiro, e quase nunca estão na ficha.
// Diferente do gás e do salário, ESTES SÃO INGREDIENTE: só existem porque a
// porção saiu, e somem quando o bar está parado. Então entram na ficha e no
// CMV, igual à batata.
//
// O problema não é saber que vão — ela sabe, acabou de listar. O problema é
// que pôr "1 sachê" em doze fichas, uma por uma, é trabalho que ninguém faz
// duas vezes. Por isso o ajudante aplica em todos de uma vez.
//
// E tem a pergunta da quantidade, que tem dois jeitos de responder:
//
//   DIRETO  — "vai 1 sachê". Serve pro que já é contado por unidade.
//   RENDIMENTO — "1 kg de limão dá umas 40 porções". Serve pro que ela compra
//                a granel e usa em fatia, pedaço, colherada. Ninguém sabe
//                dizer "23 g de limão"; todo mundo sabe estimar quantas
//                porções saem de um quilo.

// Sub-unidade legível: ficha com "0,025 kg" é ilegível e convida a erro de
// digitação; "25 g" qualquer um confere de olho.
const MENOR = { kg: { unidade: 'g', fator: 1000 }, L: { unidade: 'ml', fator: 1000 } };

export function porPorcao({ unidadeItem, rendimento }) {
  const n = numQtd(rendimento);
  if (!(n > 0)) return null;
  const u = unidadeItem || 'un';
  const bruto = 1 / n;
  const menor = MENOR[u];
  if (menor) {
    // Arredonda pro inteiro da sub-unidade. A terceira casa aqui é falsa
    // precisão: o número nasceu de uma estimativa dela.
    const q = Math.max(1, Math.round(bruto * menor.fator));
    return { qtd: String(q), unidade: menor.unidade, legivel: `${q} ${menor.unidade}` };
  }
  // Unidade contável (un, cx, pct): mantém a fração, com 3 casas, porque não
  // existe "meio sachê" menor pra converter.
  const q = Math.round(bruto * 1000) / 1000;
  return { qtd: String(q).replace('.', ','), unidade: u, legivel: `${String(q).replace('.', ',')} ${u}` };
}

// Põe um ingrediente na ficha de vários pratos de uma vez, substituindo a
// quantidade se ele já estiver lá. Devolve a lista nova de fichas — quem salva
// é quem chamou.
export function porNasFichas({ fichas = [], cardapioIds = [], estoqueId, qtd, unidade }) {
  if (!estoqueId || !cardapioIds.length) return fichas;
  const novas = [...fichas];
  for (const id of cardapioIds) {
    const atuais = (novas.find((f) => f.cardapioId === id)?.itens) || [];
    const itens = [...atuais.filter((i) => i.estoqueId !== estoqueId), { estoqueId, qtd: String(qtd), unidade }];
    const i = novas.findIndex((f) => f.cardapioId === id);
    if (i >= 0) novas[i] = { ...novas[i], itens };
    else novas.push({ cardapioId: id, itens });
  }
  return novas;
}
