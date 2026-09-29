// ACHAR O CLIENTE PELO NOME QUE FOI ESCRITO NA COMANDA.
//
// "Antes eu clicava e ele me encaminhava direto pro WhatsApp com a mensagem já
// na conversa."
//
// Pois é — e parou. O app procurava o telefone exigindo o nome IDÊNTICO: só
// tirava espaço das pontas e baixava as maiúsculas. Qualquer diferença
// derrubava a busca:
//
//     comanda "Jamile"        × cliente "Jamile Souza"     -> não acha
//     comanda "jamile souza"  × cliente "Jamile  Souza"    -> não acha
//     comanda "Luis"          × cliente "Luís"             -> não acha
//
// E o pior é que não acha CALADO: sem telefone, o botão caía no caminho de
// copiar a mensagem, que é o caminho de quem nunca cadastrou o número. Ela
// cadastrou. Quem errou foi a busca.
//
// Na comanda o nome é digitado às pressas, no meio do salão, por quem estiver
// com o celular na mão. Exigir que bata letra por letra com o cadastro é exigir
// uma coisa que a vida do bar não entrega.

const semAcento = (s) => String(s == null ? '' : s)
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

// Nome pronto pra comparar: sem acento, minúsculo, um espaço só entre palavras.
export const chaveCliente = (s) => semAcento(s).toLowerCase().replace(/\s+/g, ' ').trim();

const palavras = (s) => chaveCliente(s).split(' ').filter(Boolean);

// O cliente cadastrado que corresponde a este nome, ou null.
//
// A regra, em ordem, e o que ela protege:
//   1. igual (já sem acento e sem espaço sobrando) — o caso normal;
//   2. um é o começo do outro ("Jamile" ↔ "Jamile Souza") — o caso dela;
//   3. todas as palavras do menor estão no maior ("Ana Paula" ↔ "Ana Paula
//      Ribeiro"), o que cobre nome do meio escrito num lugar e não no outro.
//
// E o freio: se mais de um cliente casar, NÃO escolhe nenhum. Mandar a cobrança
// da Jamile Souza pro número da Jamile Prado é pior do que não mandar — e é o
// tipo de erro que a pessoa só descobre pelo constrangimento.
export function acharCliente(nome, clientes) {
  const alvo = chaveCliente(nome);
  if (!alvo) return null;
  const lista = (Array.isArray(clientes) ? clientes : []).filter((c) => c && chaveCliente(c.nome));

  const exatos = lista.filter((c) => chaveCliente(c.nome) === alvo);
  if (exatos.length === 1) return exatos[0];
  if (exatos.length > 1) return null; // dois cadastros com o mesmo nome: ela decide

  const alvoPal = palavras(alvo);
  if (!alvoPal.length) return null;

  const candidatos = lista.filter((c) => {
    const k = chaveCliente(c.nome);
    if (k.startsWith(alvo + ' ') || alvo.startsWith(k + ' ')) return true;
    const kPal = palavras(k);
    const [menor, maior] = alvoPal.length <= kPal.length ? [alvoPal, kPal] : [kPal, alvoPal];
    // Uma palavra só ("Jamile") já serve quando é nome de gente; duas letras
    // ("Jo") não — seria chute com cara de acerto.
    if (menor.length === 1 && menor[0].length < 3) return false;
    const tem = new Set(maior);
    return menor.every((w) => tem.has(w));
  });

  return candidatos.length === 1 ? candidatos[0] : null;
}

// O telefone de quem está na comanda — '' quando não dá pra saber com certeza.
export function telefoneDoCliente(nome, clientes) {
  const c = acharCliente(nome, clientes);
  return (c && c.telefone) || '';
}
