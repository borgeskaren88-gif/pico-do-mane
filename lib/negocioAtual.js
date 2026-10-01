import { cookies } from 'next/headers';
import { nomeCookie, negocioDaSessao } from './auth';
import { bancoDo, nomeDeNegocioValido } from './banco';

// DE QUE NEGÓCIO É ESTE PEDIDO.
//
// Duas respostas possíveis, e nenhuma delas é "sei lá":
//
//   1. O crachá diz. É o app único: a pessoa entrou com o código do negócio e
//      o crachá saiu carimbado com ele. Só vale crachá VERDADEIRO — forjar o
//      nome no cookie não funciona (lib/auth.js cuida disso).
//
//   2. A instalação diz. É a instalação de um cliente só, onde não há código
//      nenhum na tela de entrada: o negócio vem de NEGOCIO_UNICO, posta uma vez
//      na configuração do site.
//
// Se as duas falharem, a resposta é null — e quem chamou tem que recusar o
// pedido. É a mesma regra de lib/banco.js, pelo mesmo motivo: sem dono, não
// existe "o banco". Existe o banco de alguém.
export function negocioAtual() {
  const doCracha = negocioDaSessao(cookies().get(nomeCookie())?.value);
  if (doCracha) return doCracha;

  // Crachá sem nome (instalação de um cliente) ou sem crachá nenhum: vale o que
  // a instalação declarar.
  const unico = String(process.env.NEGOCIO_UNICO || '').trim().toLowerCase();
  return nomeDeNegocioValido(unico) ? unico : null;
}

// O banco de quem está pedindo. Estoura se não der pra saber de quem é — o que
// vira tela de erro, nunca leitura do vizinho.
export function bancoDaSessao() {
  const n = negocioAtual();
  if (!n) throw new Error('Não dá pra saber de que negócio é este pedido.');
  return bancoDo(n);
}

// Para os endereços que entram SEM crachá (o link do calendário, o do widget):
// ali o negócio vem escrito na própria URL, e o token é conferido contra ele.
// Um link de um cliente não vale no outro porque o nome entra na conta do token.
export function negocioDaUrl(request) {
  const n = String(new URL(request.url).searchParams.get('n') || '').trim().toLowerCase();
  if (nomeDeNegocioValido(n)) return n;
  const unico = String(process.env.NEGOCIO_UNICO || '').trim().toLowerCase();
  return nomeDeNegocioValido(unico) ? unico : null;
}
