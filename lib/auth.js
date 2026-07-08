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
