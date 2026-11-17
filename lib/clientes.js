import { num, abertoDaVenda, fiadoDaVenda, brl, classificarFiado } from './util';

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

// QUANTO ESTA PESSOA AINDA DEVE NO FIADO.
//
// Soma o que falta receber das vendas em nome dela. O nome aqui é o DO
// CADASTRO, comparado do jeito que o fechamento da comanda sempre comparou
// (sem espaço nas pontas, sem ligar pra maiúscula): é com esse nome que o
// fiado é gravado, porque o atendimento escolhe o cliente numa lista.
//
// Esta conta morava solta dentro do fechamento. Agora que a tela também
// mostra "quanto ela ainda pode fiar", as duas usam ESTA função — senão a tela
// diria "pode fiar R$ 50" e o fechamento barraria com outra conta.
const nomeFiado = (s) => String(s == null ? '' : s).trim().toLowerCase();
export function fiadoEmAberto(vendas, nome) {
  const alvo = nomeFiado(nome);
  if (!alvo) return 0;
  const soma = (Array.isArray(vendas) ? vendas : [])
    .filter((v) => v && nomeFiado(v.nome) === alvo)
    .reduce((t, v) => t + abertoDaVenda(v), 0);
  return Math.round(soma * 100) / 100;
}

// A SITUAÇÃO DO FIADO DE QUEM ESTÁ NA COMANDA.
//
// "Quando eu abrisse uma comanda em nome de Tamara — eu sei que temos uma
// Tamara que tem conta fiado aqui — queria que já aparecesse na tela quanto
// ela ainda pode gastar, ou se ela já atingiu o limite."
//
// Hoje isso só aparecia no FIM: a mesa consumia a noite inteira e, na hora de
// fechar no fiado, o app barrava. Aí já era tarde — a conta estava feita e o
// constrangimento era na frente do cliente. A informação tem que chegar quando
// o nome é escrito, que é quando ainda dá pra decidir alguma coisa.
//
// Devolve null quando não há o que dizer: nome que não bate com UM cliente só
// (dois "Tamara" no cadastro é chute, e chute aqui é acusar a pessoa errada de
// dever), ou cliente sem limite e sem dívida.
//
//   livre     — tem limite e ainda cabe fiado
//   estourou  — já deve o limite inteiro (ou mais)
//   semLimite — deve alguma coisa, mas ninguém definiu limite
export function situacaoFiado(nomeNaComanda, clientes, vendas) {
  const cli = acharCliente(nomeNaComanda, clientes);
  if (!cli) return null;
  const limite = num(cli.limite);
  const aberto = fiadoEmAberto(vendas, cli.nome);
  if (!(limite > 0) && !(aberto > 0)) return null;
  const disponivel = limite > 0 ? Math.max(0, Math.round((limite - aberto) * 100) / 100) : null;
  return {
    cliente: cli.nome,
    limite: limite > 0 ? limite : 0,
    aberto,
    disponivel,
    // Sem "bloquear" ligado o limite é só um aviso: o fechamento deixa passar.
    bloquear: !!cli.bloquear && limite > 0,
    estado: !(limite > 0) ? 'semLimite' : aberto >= limite - 0.005 ? 'estourou' : 'livre',
  };
}

// ---------------------------------------------------------------------------
// A COBRANÇA DO FIADO: o texto, o link do WhatsApp e o vencimento.
// (Moravam dentro da tela de Fiados; vieram pra cá quando a gerente passou a
// cobrar também.)
// ---------------------------------------------------------------------------
export const DIA_LIMITE_FIADO = 10;
const DIA_LIMITE = DIA_LIMITE_FIADO;

// Link do WhatsApp com a mensagem pronta. Telefone brasileiro sem o 55 ganha o
// 55 na frente; sem telefone cadastrado não dá link (aí a gente copia o texto).
export const zapLink = (telefone, msg) => {
  const d = String(telefone || '').replace(/\D/g, '');
  const numero = d.length >= 12 ? d : (d.length >= 10 ? '55' + d : '');
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(msg)}` : '';
};
// Só o primeiro nome: a cobrança fica pessoal sem ficar formal demais.
export const primeiroNome = (n) => (String(n || '').trim().split(/\s+/)[0] || 'tudo bem');
// Data curtinha, do jeito que se lê no zap: 01/09.
export const ddmm = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : '');
// O dia 10 de qual mês: o deste mês pra quem está na cobrança de agora, o do
// mês que vem pra quem só consumiu depois que o mês virou.
export const diaDoVencimento = (hoje, cobrarAgora) => {
  const [ano, mes] = hoje.split('-').map(Number);
  if (cobrarAgora) return `${hoje.slice(0, 7)}-${String(DIA_LIMITE).padStart(2, '0')}`;
  const ym = mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, '0')}`;
  return `${ym}-${String(DIA_LIMITE).padStart(2, '0')}`;
};
export const msgCobranca = (nome, total, ateISO, venceISO) => (
  `Olá ${nome}!\n`
  + `Informamos que o seu débito está em ${brl(total)} correspondendo até o dia ${ddmm(ateISO)}. `
  + 'O valor está sujeito a alteração até a data do pagamento.\n\n'
  + `Lembrando a todos que o débito deve ser quitado até o dia ${ddmm(venceISO)}, `
  + 'passando da data de pagamento a conta será encerrada.'
);


// QUEM DEVE, PRA COBRAR — a lista da gerente.
//
// "Ver e cobrar": quem deve, quanto, e o botão do WhatsApp com a mensagem
// pronta. Sai a MESMA conta da tela de Fiados da dona (o que vence agora e o
// que fica pro mês que vem, pela classificarFiado), e o mesmo texto. Não sai
// nada de receber pagamento, limite nem histórico de compras: isso é da dona.
export function cobrancasDeFiado(vendas, clientes, hoje) {
  const lista = (Array.isArray(vendas) ? vendas : []).filter((v) => v && fiadoDaVenda(v) > 0.005);
  const abertos = lista.filter((v) => !v.pago && abertoDaVenda(v) > 0.005);
  const idade = classificarFiado(lista, String(hoje).slice(0, 7));
  const grupos = new Map();
  for (const v of abertos) {
    const nome = String(v.nome || '').trim();
    if (!nome) continue; // fiado sem nome não tem pra quem mandar a cobrança
    const k = chaveCliente(nome);
    const g = grupos.get(k) || { nome, total: 0, agora: 0, proximo: 0, ultima: '' };
    const aberto = abertoDaVenda(v);
    g.total += aberto;
    if (idade.balde.get(v.id) !== 'proximo') g.agora += aberto; else g.proximo += aberto;
    const quando = String(v.data || v.fechadaEm || '').slice(0, 10);
    if (quando > g.ultima) g.ultima = quando;
    grupos.set(k, g);
  }
  const r2 = (x) => Math.round(x * 100) / 100;
  return [...grupos.values()].map((g) => {
    const cobrarAgora = g.agora > 0.005;
    const valor = cobrarAgora ? g.agora : g.total;
    const mensagem = msgCobranca(primeiroNome(g.nome), valor, g.ultima || hoje, diaDoVencimento(hoje, cobrarAgora));
    const telefone = telefoneDoCliente(g.nome, clientes);
    return {
      nome: g.nome, total: r2(g.total), agora: r2(g.agora), proximo: r2(g.proximo),
      cobrarAgora, mensagem, link: zapLink(telefone, mensagem), temTelefone: !!telefone,
    };
  }).sort((a, b) => b.agora - a.agora || b.total - a.total);
}
