import { num, numQtd } from './util';

// MARCAR UMA COMPRA COMO PAGA TEM QUE MEXER NO DINHEIRO.
//
// "Eu acabei de colocar como pago dois boletos da Copal e meu Dashboard não
// mudou o financeiro."
//
// Existiam DUAS portas pro mesmo ato, e só uma funcionava:
//
//   Finanças → Contas a pagar → "Marcar pago"
//        baixava a conta E lançava a despesa. Certo.
//
//   Abastecimento → Compras → editar → "Já foi paga?" = Sim
//        trocava a palavra "Não" por "Sim" na linha e mais nada. O dinheiro
//        nunca chegava no financeiro.
//
// A segunda porta tem a cara de quem resolve — é onde está escrito "Já foi
// paga?" — e não resolvia. Pior: era silenciosa, então ela saía de lá achando
// que tinha anotado, e o resultado do mês continuava mentindo pra ela.
//
// O mesmo buraco tem outras duas faces, que vêm juntas aqui:
//   - desmarcar uma compra paga deixava a despesa lá, cobrando um dinheiro que
//     ela acabou de dizer que não saiu;
//   - mudar o VALOR de uma compra já paga não mudava a despesa, e os dois
//     números passavam a discordar em silêncio.
//
// Este arquivo é só a REGRA, sem tela e sem banco, pra poder ser conferida
// sozinha: dada a linha antes e depois da edição, o que precisa acontecer com a
// despesa.

// O dinheiro de uma linha de compra.
//
// Em compra parcelada a linha é uma LINHA DE PAGAMENTO: quantidade 1 e o valor
// da fatia (a quantidade de verdade viaja em qtdCompra, que é coisa do
// estoque). Então multiplicar os dois dá sempre o dinheiro daquela linha — que
// é justamente o que o financeiro quer saber.
export function valorDaLinha(linha) {
  if (!linha) return 0;
  const v = numQtd(linha.quantidade || '1') * num(linha.valorUnit || '0');
  return Math.round(v * 100) / 100;
}

const ehPaga = (l) => !!l && l.pago === 'Sim';

// O que fazer com a despesa, dada a linha antes e depois.
//
//   { tipo: 'nada' }                       — o dinheiro não mudou
//   { tipo: 'criar', valor }               — virou paga: lançar despesa
//   { tipo: 'ajustar', id, delta }         — a despesa ligada muda de valor
//                                            (delta negativo = diminui; se
//                                            zerar, a despesa sai fora)
//   { tipo: 'sem-ligacao', delta }         — era paga, mas não há despesa
//                                            ligada a esta linha: o app não tem
//                                            o que corrigir e precisa DIZER
//                                            isso, em vez de fingir que fez.
export function efeitoDaEdicaoNaDespesa(antes, depois) {
  const era = ehPaga(antes);
  const eh = ehPaga(depois);
  if (!era && !eh) return { tipo: 'nada' };

  const vAntes = valorDaLinha(antes);
  const vDepois = valorDaLinha(depois);

  if (!era && eh) return vDepois > 0 ? { tipo: 'criar', valor: vDepois } : { tipo: 'nada' };

  // Era paga: o que sai do financeiro é a diferença. Desmarcar é o caso em que
  // o "depois" vale zero — a mesma conta cobre os dois.
  const delta = Math.round(((eh ? vDepois : 0) - vAntes) * 100) / 100;
  if (Math.abs(delta) < 0.005) return { tipo: 'nada' };
  const id = (antes && antes.despesaId) || '';
  if (!id) return { tipo: 'sem-ligacao', delta };
  return { tipo: 'ajustar', id, delta };
}

// Aplica o ajuste na lista de despesas. Quando o valor chega a zero (ou abaixo),
// a despesa sai da lista: sobrar uma linha de R$ 0,00 no extrato dela seria
// lixo com aparência de lançamento.
export function ajustarDespesas(despesas, { id, delta }) {
  const lista = Array.isArray(despesas) ? despesas : [];
  const out = [];
  for (const d of lista) {
    if (!d || d.id !== id) { out.push(d); continue; }
    const novo = Math.round((num(d.valor) + delta) * 100) / 100;
    if (novo <= 0.005) continue; // zerou: some
    out.push({ ...d, valor: novo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
  }
  return out;
}
