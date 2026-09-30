// A NOTA FICA GUARDADA NO APARELHO ATÉ O SERVIDOR CONFIRMAR.
//
// Ela digitou uma nota inteira, produto por produto, a gravação não foi, e a
// nota simplesmente deixou de existir — teve que digitar tudo de novo. Isso não
// pode acontecer nunca, seja qual for o motivo da falha (internet do bar,
// servidor fora, sessão vencida, defeito meu).
//
// Então o carrinho passa a ser gravado aqui, no próprio celular, a cada mexida.
// Se o app fechar, cair, recarregar ou a gravação falhar, a nota está aqui
// inteira quando ela voltar.
//
// Mora também aqui a CAIXA-PRETA: o que foi enviado e o que o servidor
// respondeu, nas últimas vezes. Sem isso, "não entrou" é um mistério — com
// isso, é uma linha que ela me manda por print e eu leio o motivo.

const CHAVE_RASCUNHO = 'picoos:nota-rascunho';
const CHAVE_TENTATIVAS = 'picoos:nota-tentativas';
const MAX_TENTATIVAS = 12;

// localStorage pode estourar (aba privada, armazenamento cheio, permissão).
// Nada aqui pode derrubar a tela de Compras — no pior caso, volta ao que era.
const ler = (chave) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const cru = window.localStorage.getItem(chave);
    return cru ? JSON.parse(cru) : null;
  } catch { return null; }
};
const gravar = (chave, valor) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    if (valor == null) window.localStorage.removeItem(chave);
    else window.localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch { return false; }
};

export function guardarRascunho(rascunho) {
  // Carrinho vazio não é rascunho: é a tela limpa.
  if (!rascunho || !Array.isArray(rascunho.carrinho) || !rascunho.carrinho.length) return gravar(CHAVE_RASCUNHO, null);
  return gravar(CHAVE_RASCUNHO, { ...rascunho, em: Date.now() });
}

export function lerRascunho() {
  const r = ler(CHAVE_RASCUNHO);
  if (!r || !Array.isArray(r.carrinho) || !r.carrinho.length) return null;
  return r;
}

export const limparRascunho = () => gravar(CHAVE_RASCUNHO, null);

// Uma linha por envio: quando, o que, e o que voltou. `resultado` é 'ok',
// 'erro' (o servidor respondeu recusando) ou 'sem-resposta' (não chegou lá).
export function registrarTentativa(t) {
  const lista = lerTentativas();
  const nova = [{ em: Date.now(), ...t }, ...lista].slice(0, MAX_TENTATIVAS);
  gravar(CHAVE_TENTATIVAS, nova);
  return nova;
}

export function lerTentativas() {
  const l = ler(CHAVE_TENTATIVAS);
  return Array.isArray(l) ? l : [];
}

export const limparTentativas = () => gravar(CHAVE_TENTATIVAS, null);

// "31/03 às 20:14" — do jeito que ela lê.
export function quandoBR(ms) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(ms)).replace(', ', ' às ');
  } catch { return ''; }
}
