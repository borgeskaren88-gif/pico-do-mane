import crypto from 'crypto';

const NOME_COOKIE = 'pdm_session';

function tokenEsperado() {
  const segredo = process.env.SESSION_SECRET || '';
  return crypto.createHash('sha256').update('pico-do-mane:' + segredo).digest('hex');
}

export function nomeCookie() {
  return NOME_COOKIE;
}

export function valorSessaoValida() {
  return tokenEsperado();
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
function tokenDoPapel(prefixo, g = 1) {
  const segredo = process.env.SESSION_SECRET || '';
  const n = Math.max(1, Math.floor(Number(g)) || 1);
  const tempero = n > 1 ? ':g' + n : '';
  return crypto.createHash('sha256').update(prefixo + segredo + tempero).digest('hex');
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
export function cracha(papel, g = 1) {
  const n = Math.max(1, Math.floor(Number(g)) || 1);
  const t = tokenDoPapel(PREFIXO_PAPEL[papel] || '', n);
  return n > 1 ? `g${n}.${t}` : t;
}

// Com que geração este crachá foi emitido. Crachá antigo (sem "gN.") é 1.
export function geracaoDoCracha(valorCookie) {
  const m = /^g(\d{1,6})\./.exec(String(valorCookie || ''));
  return m ? Math.max(1, Number(m[1])) : 1;
}

// Sessão da cozinha: um segundo acesso, com token próprio (derivado do mesmo
// SESSION_SECRET), que só enxerga a Lista de Compras e as tarefas.
function tokenCozinha(g = 1) {
  return tokenDoPapel('pico-do-mane-cozinha:', g);
}

export function valorSessaoCozinha(g = 1) {
  return cracha('cozinha', g);
}

// Sessão do garçom (linha de frente): terceiro acesso, token próprio, que só
// enxerga as comandas e o cardápio — nada de financeiro nem de valores do bar.
function tokenGarcom(g = 1) {
  return tokenDoPapel('pico-do-mane-garcom:', g);
}

export function valorSessaoGarcom(g = 1) {
  return cracha('garcom', g);
}

// Sessão de RESERVAS: quem cuida das mesas reservadas. Só enxerga o calendário
// de reservas — nada de financeiro, nada de comanda. Token próprio, derivado do
// mesmo SESSION_SECRET.
function tokenReservas(g = 1) {
  return tokenDoPapel('pico-do-mane-reservas:', g);
}

export function valorSessaoReservas(g = 1) {
  return cracha('reservas', g);
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
  if (igualConstante(valorCookie, tokenEsperado())) return 'dona';
  // O crachá diz a geração dele; aqui só se confere se o número BATE com essa
  // geração — ou seja, se o crachá é verdadeiro. Se ele ainda está valendo
  // (geração atual) é outra pergunta, que precisa do banco e é respondida no
  // middleware, uma vez por pedido, pra toda a aplicação de uma vez.
  const g = geracaoDoCracha(valorCookie);
  for (const papel of ['cozinha', 'garcom', 'reservas']) {
    if (igualConstante(valorCookie, cracha(papel, g))) return papel;
  }
  return null;
}

// Token secreto e estável para a URL do calendário (.ics). O Google/iPhone
// acessa a URL sem cookie de sessão, então a autorização é por esse token —
// derivado do mesmo SESSION_SECRET, logo não é adivinhável.
export function tokenCalendario() {
  const segredo = process.env.SESSION_SECRET || '';
  return crypto.createHash('sha256').update('pico-do-mane-calendario:' + segredo).digest('hex');
}

export function tokenCalendarioValido(valor) {
  if (!valor) return false;
  try {
    const a = Buffer.from(valor);
    const b = Buffer.from(tokenCalendario());
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Token do widget (tela inicial via Scriptable): mesma ideia do calendário —
// a URL é acessada sem cookie, então a autorização é por este token derivado do
// SESSION_SECRET. Só devolve leitura (números do dia), nunca altera nada.
export function tokenWidget() {
  const segredo = process.env.SESSION_SECRET || '';
  return crypto.createHash('sha256').update('pico-do-mane-widget:' + segredo).digest('hex');
}
export function tokenWidgetValido(valor) {
  if (!valor) return false;
  try {
    const a = Buffer.from(valor);
    const b = Buffer.from(tokenWidget());
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function sessaoEhValida(valorCookie) {
  if (!valorCookie) return false;
  try {
    const a = Buffer.from(valorCookie);
    const b = Buffer.from(tokenEsperado());
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
