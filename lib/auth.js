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
