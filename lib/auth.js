import crypto from 'crypto';

// Cookie que guarda a sessão de quem está logado.
const NOME_COOKIE = 'financas_sessao';

// Os dois usuários do app (você e a sua parceira/parceiro). Nome e senha de
// cada um vêm das variáveis de ambiente; se não estiverem configuradas, usa
// valores padrão só pra não quebrar na primeira vez (troque depois).
export function usuarios() {
  return [
    { id: 'u1', nome: process.env.USUARIO1_NOME || 'Usuário 1', senha: process.env.USUARIO1_SENHA || '' },
    { id: 'u2', nome: process.env.USUARIO2_NOME || 'Usuário 2', senha: process.env.USUARIO2_SENHA || '' },
  ];
}

export function nomeCookie() {
  return NOME_COOKIE;
}

// Token de sessão de um usuário: derivado do SESSION_SECRET + id do usuário.
// Não é adivinhável e identifica quem está logado sem guardar a senha.
function tokenDoUsuario(id) {
  const segredo = process.env.SESSION_SECRET || '';
  return crypto.createHash('sha256').update('financas-casal:' + id + ':' + segredo).digest('hex');
}

export function valorSessao(id) {
  return tokenDoUsuario(id);
}

function igualConstante(a, b) {
  if (!a || !b) return false;
  try {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    if (x.length !== y.length) return false;
    return crypto.timingSafeEqual(x, y);
  } catch {
    return false;
  }
}

// A partir do valor do cookie, descobre qual usuário está logado.
// Retorna { id, nome } ou null (sem sessão válida).
export function usuarioDaSessao(valorCookie) {
  if (!valorCookie) return null;
  for (const u of usuarios()) {
    if (igualConstante(valorCookie, tokenDoUsuario(u.id))) {
      return { id: u.id, nome: u.nome };
    }
  }
  return null;
}

// Compara a senha digitada com a de cada usuário (comparação de tempo
// constante). Retorna o usuário correspondente ou null.
export function autenticar(senhaDigitada) {
  const digitada = crypto.createHash('sha256').update(String(senhaDigitada || '')).digest();
  for (const u of usuarios()) {
    if (!u.senha) continue;
    const alvo = crypto.createHash('sha256').update(String(u.senha)).digest();
    if (crypto.timingSafeEqual(digitada, alvo)) {
      return { id: u.id, nome: u.nome };
    }
  }
  return null;
}
