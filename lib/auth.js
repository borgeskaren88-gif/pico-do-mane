import crypto from 'crypto';

const NOME_COOKIE = 'pdm_session';

// DE QUE NEGÓCIO É ESTE CRACHÁ.
//
// Com um app por cliente, "de quem é" era a resposta óbvia: do dono do site.
// Num app só, o crachá tem que dizer. E não basta escrever o nome do negócio ao
// lado — qualquer um escreveria o nome do vizinho. O nome entra DENTRO da conta
// que gera o número, então um crachá do "boteco" simplesmente não confere como
// crachá do "estimado": a conta dá outro número.
//
// O negócio viaja na frente, em texto, separado por "|", porque quem confere
// precisa saber com que nome a conta foi feita. Isso não é segredo; o segredo é
// o número depois da barra.
//
// Instalação de um cliente só (como está hoje) não tem nome nenhum, e aí a
// conta é EXATAMENTE a de antes — ninguém é deslogado ao subir esta mudança.
export function partesDoCracha(valor) {
  const s = String(valor == null ? '' : valor);
  const i = s.indexOf('|');
  if (i < 0) return { negocio: '', token: s };
  return { negocio: s.slice(0, i), token: s.slice(i + 1) };
}

const juntar = (negocio, token) => (negocio ? `${negocio}|${token}` : token);
const tempero = (negocio) => (negocio ? ':n:' + negocio : '');

function tokenEsperado(negocio = '') {
  const segredo = process.env.SESSION_SECRET || '';
  return crypto.createHash('sha256').update('pico-do-mane:' + segredo + tempero(negocio)).digest('hex');
}

export function nomeCookie() {
  return NOME_COOKIE;
}

// QUANTO TEMPO O CRACHÁ VIVE.
//
// "Eu quero apertar no X fechar e já sair do meu login."
//
// No celular e no tablet o crachá vale 90 dias: são aparelhos de uma pessoa só,
// e pedir senha todo dia ali é chatice sem ganho.
//
// No computador ele vale DEZ MINUTOS e se renova sozinho enquanto a tela está
// aberta. Enquanto ela trabalha, não percebe nada. Fechou no X? Ninguém renova,
// e em dez minutos o crachá morre NO SERVIDOR — sem depender de alguém abrir o
// app de novo.
//
// Por que não morrer no instante do X: o navegador não sabe diferenciar
// "fechei" de "recarreguei" na hora em que acontece. Sair no fechamento da
// janela derrubaria ela toda vez que tocasse no botão de atualizar — uma
// proteção que atrapalha é uma proteção que alguém desliga.
//
// Dez minutos também cobre o que ninguém planeja: a bateria do notebook
// acabando, o navegador travando, a tampa fechando com o app aberto. Em todos
// esses, antes, o crachá ficava vivo.
export const VIDA_CRACHA_PC = 60 * 10;            // dez minutos, renovados
export const VIDA_CRACHA_CELULAR = 60 * 60 * 24 * 90;  // noventa dias

// Como o crachá é posto no navegador — um lugar só.
//
// Login e renovação TÊM que pôr o cookie igualzinho: se discordarem num
// detalhe, a renovação cria um segundo cookie em vez de substituir o primeiro,
// e aí ninguém mais sai nunca. É o mesmo motivo de existir uma função só pro
// total de uma compra.
export function opcoesDoCracha(lembrar) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: lembrar ? VIDA_CRACHA_CELULAR : VIDA_CRACHA_PC,
  };
}

export function valorSessaoValida(negocio = '') {
  return juntar(negocio, tokenEsperado(negocio));
}

// O CRACHÁ DE CADA ACESSO, E POR QUE ELE TEM UM NÚMERO DENTRO.
//
// Antes o crachá era um número fixo, tirado do SESSION_SECRET, sem validade.
// Isso queria dizer que trocar a senha da cozinha NÃO tirava ninguém de dentro:
// quem já estava logado ficava logado pra sempre. Quem saiu do bar continuava
// entrando no app — e o único jeito de cortar era trocar o SESSION_SECRET, que
// derruba todo mundo junto e ainda quebra os links do calendário e do widget.
//
// Agora cada acesso tem uma GERAÇÃO. Ela entra na conta do crachá e viaja
// escrita nele ("g3.<número>"). Subir a geração de um acesso mata todos os
// crachás velhos DAQUELE acesso, na hora, sem tocar em mais nada.
//
// Geração 1 dá exatamente o número de antes, e crachá sem "gN." é lido como
// geração 1 — então esta mudança não desloga ninguém ao subir.
function tokenDoPapel(prefixo, g = 1, negocio = '') {
  const segredo = process.env.SESSION_SECRET || '';
  const n = Math.max(1, Math.floor(Number(g)) || 1);
  const ger = n > 1 ? ':g' + n : '';
  return crypto.createHash('sha256').update(prefixo + segredo + ger + tempero(negocio)).digest('hex');
}

const PREFIXO_PAPEL = {
  cozinha: 'pico-do-mane-cozinha:',
  garcom: 'pico-do-mane-garcom:',
  reservas: 'pico-do-mane-reservas:',
};

// O valor que vai no cookie. A geração viaja na frente, em texto, porque quem
// confere precisa saber COM QUE geração aquele crachá foi emitido — e isso não
// é segredo: o segredo é o número depois do ponto, que só o servidor sabe
// calcular.
export function cracha(papel, g = 1, negocio = '') {
  const n = Math.max(1, Math.floor(Number(g)) || 1);
  const t = tokenDoPapel(PREFIXO_PAPEL[papel] || '', n, negocio);
  return juntar(negocio, n > 1 ? `g${n}.${t}` : t);
}

// Com que geração este crachá foi emitido. Crachá antigo (sem "gN.") é 1.
export function geracaoDoCracha(valorCookie) {
  const m = /^g(\d{1,6})\./.exec(partesDoCracha(valorCookie).token);
  return m ? Math.max(1, Number(m[1])) : 1;
}

// Sessão da cozinha: um segundo acesso, com token próprio (derivado do mesmo
// SESSION_SECRET), que só enxerga a Lista de Compras e as tarefas.
export function valorSessaoCozinha(g = 1, negocio = '') {
  return cracha('cozinha', g, negocio);
}

// Sessão do garçom (linha de frente): terceiro acesso, token próprio, que só
// enxerga as comandas e o cardápio — nada de financeiro nem de valores do bar.
export function valorSessaoGarcom(g = 1, negocio = '') {
  return cracha('garcom', g, negocio);
}

// Sessão de RESERVAS: quem cuida das mesas reservadas. Só enxerga o calendário
// de reservas — nada de financeiro, nada de comanda. Token próprio, derivado do
// mesmo SESSION_SECRET.
export function valorSessaoReservas(g = 1, negocio = '') {
  return cracha('reservas', g, negocio);
}

function igualConstante(a, b) {
  if (!a) return false;
  try {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    if (x.length !== y.length) return false;
    return crypto.timingSafeEqual(x, y);
  } catch {
    return false;
  }
}

// Papel de quem está logado, a partir do cookie: 'dona' (acesso total),
// 'cozinha' (só lista/tarefas), 'garcom' (comandas), 'reservas' (calendário de
// mesas reservadas) ou null (sem acesso).
export function papelDaSessao(valorCookie) {
  const { negocio } = partesDoCracha(valorCookie);
  if (igualConstante(valorCookie, valorSessaoValida(negocio))) return 'dona';
  // O crachá diz a geração dele; aqui só se confere se o número BATE com essa
  // geração — ou seja, se o crachá é verdadeiro. Se ele ainda está valendo
  // (geração atual) é outra pergunta, que precisa do banco e é respondida no
  // middleware, uma vez por pedido, pra toda a aplicação de uma vez.
  const g = geracaoDoCracha(valorCookie);
  for (const papel of ['cozinha', 'garcom', 'reservas']) {
    if (igualConstante(valorCookie, cracha(papel, g, negocio))) return papel;
  }
  return null;
}

// De que negócio é quem está logado. Só responde se o crachá for VERDADEIRO —
// senão qualquer um escreveria "estimado|" no cookie e seria atendido como o
// estimado. Instalação de um cliente só devolve '' (não há negócio nomeado).
export function negocioDaSessao(valorCookie) {
  if (!papelDaSessao(valorCookie)) return null;
  return partesDoCracha(valorCookie).negocio;
}

// Token secreto e estável para a URL do calendário (.ics). O Google/iPhone
// acessa a URL sem cookie de sessão, então a autorização é por esse token —
// derivado do mesmo SESSION_SECRET, logo não é adivinhável.
// O negócio entra na conta pelo mesmo motivo do crachá: num app só, o link do
// calendário de um cliente não pode valer no do outro.
export function tokenCalendario(negocio = '') {
  const segredo = process.env.SESSION_SECRET || '';
  return crypto.createHash('sha256').update('pico-do-mane-calendario:' + segredo + tempero(negocio)).digest('hex');
}

export function tokenCalendarioValido(valor, negocio = '') {
  if (!valor) return false;
  try {
    const a = Buffer.from(valor);
    const b = Buffer.from(tokenCalendario(negocio));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Token do widget (tela inicial via Scriptable): mesma ideia do calendário —
// a URL é acessada sem cookie, então a autorização é por este token derivado do
// SESSION_SECRET. Só devolve leitura (números do dia), nunca altera nada.
export function tokenWidget(negocio = '') {
  const segredo = process.env.SESSION_SECRET || '';
  return crypto.createHash('sha256').update('pico-do-mane-widget:' + segredo + tempero(negocio)).digest('hex');
}
export function tokenWidgetValido(valor, negocio = '') {
  if (!valor) return false;
  try {
    const a = Buffer.from(valor);
    const b = Buffer.from(tokenWidget(negocio));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// A SALA DE MÁQUINAS — SÓ DE QUEM VENDE O PicoOS.
//
// Não é "mais um papel" do login dos clientes: é outra porta, outro cookie,
// outra senha. Se fosse um botão a mais na tela de entrada, todo cliente veria
// que ela existe e teria onde bater.
//
// E ela nasce FECHADA: sem ADMIN_PASSWORD no servidor não existe senha que
// abra. É o que faz a instalação de um cliente (que não tem essa variável) não
// ter sala de máquinas nenhuma — nem errada, nem vazia: inexistente.
const NOME_COOKIE_ADMIN = 'pdm_admin';

export function nomeCookieAdmin() {
  return NOME_COOKIE_ADMIN;
}

export function consoleLigado() {
  return !!(process.env.ADMIN_PASSWORD || '').trim();
}

// A senha entra na conta do crachá: trocar a ADMIN_PASSWORD derruba na hora
// todas as sessões antigas, sem precisar de mais nada.
export function valorSessaoAdmin() {
  const segredo = process.env.SESSION_SECRET || '';
  const senha = (process.env.ADMIN_PASSWORD || '').trim();
  return crypto.createHash('sha256').update('pico-do-mane-admin:' + segredo + ':' + senha).digest('hex');
}

export function ehAdmin(valorCookie) {
  if (!consoleLigado()) return false;
  return igualConstante(valorCookie, valorSessaoAdmin());
}

// O ESPAÇO QUE NINGUÉM VÊ.
//
// A senha daqui é digitada num campo da Vercel, de um iPad. O teclado do iOS
// põe espaço depois de completar palavra e capitaliza a primeira letra sozinho,
// sem avisar. O espaço a gente apara dos dois lados — do que foi guardado e do
// que é digitado —, senão a pessoa fica fora da própria sala de máquinas por um
// caractere invisível, e sem nenhuma pista do que aconteceu.
//
// A maiúscula NÃO se apara: senha é senha, e baixar tudo pra minúscula
// enfraqueceria a única porta que abre a casa de todos os clientes de uma vez.
export function senhaAdminConfere(senha) {
  if (!consoleLigado()) return false;
  const a = String(senha == null ? '' : senha).trim();
  const b = (process.env.ADMIN_PASSWORD || '').trim();
  return igualConstante(
    crypto.createHash('sha256').update(a).digest('hex'),
    crypto.createHash('sha256').update(b).digest('hex'),
  );
}

export function sessaoEhValida(valorCookie) {
  if (!valorCookie) return false;
  try {
    const a = Buffer.from(valorCookie);
    const b = Buffer.from(valorSessaoValida(partesDoCracha(valorCookie).negocio));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
