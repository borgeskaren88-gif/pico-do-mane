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

// Sessão da cozinha: um segundo acesso, com token próprio (derivado do mesmo
// SESSION_SECRET), que só enxerga a Lista de Compras e as tarefas.
function tokenCozinha() {
  const segredo = process.env.SESSION_SECRET || '';
  return crypto.createHash('sha256').update('pico-do-mane-cozinha:' + segredo).digest('hex');
}

export function valorSessaoCozinha() {
  return tokenCozinha();
}

// Sessão do garçom (linha de frente): terceiro acesso, token próprio, que só
// enxerga as comandas e o cardápio — nada de financeiro nem de valores do bar.
function tokenGarcom() {
  const segredo = process.env.SESSION_SECRET || '';
  return crypto.createHash('sha256').update('pico-do-mane-garcom:' + segredo).digest('hex');
}

export function valorSessaoGarcom() {
  return tokenGarcom();
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
// 'cozinha' (só lista/tarefas) ou null (sem acesso).
export function papelDaSessao(valorCookie) {
  if (igualConstante(valorCookie, tokenEsperado())) return 'dona';
  if (igualConstante(valorCookie, tokenCozinha())) return 'cozinha';
  if (igualConstante(valorCookie, tokenGarcom())) return 'garcom';
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
