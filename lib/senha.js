import crypto from 'crypto';

// Senhas de quem troca a própria senha dentro do app. A senha nova fica
// guardada no banco (só o hash, nunca o texto puro) e tem PRIORIDADE sobre a
// variável de ambiente, que continua valendo como padrão de fábrica.
//
// Cada papel tem a linha dele no banco e a variável dele. É assim que a Mari
// entra com "1234" da primeira vez e, depois que trocar, com a dela.
const PAPEIS = {
  dona: { chave: 'authDona', env: () => process.env.APP_PASSWORD || '' },
  reservas: { chave: 'authReservas', env: () => process.env.APP_PASSWORD_RESERVAS || '1234' },
};

// Hash da senha (sha256 com um prefixo do projeto). Guardamos só isto no banco.
export function hashSenha(s) {
  return crypto.createHash('sha256').update('pico-do-mane:senha:' + String(s == null ? '' : s)).digest('hex');
}

function igualHex(a, b) {
  try {
    const x = Buffer.from(String(a), 'hex');
    const y = Buffer.from(String(b), 'hex');
    if (x.length !== y.length || x.length === 0) return false;
    return crypto.timingSafeEqual(x, y);
  } catch { return false; }
}

// Lê o hash da senha trocada (ou null se nunca trocou).
async function hashSalvo(sb, papel = 'dona') {
  const cfg = PAPEIS[papel];
  if (!cfg) return null;
  try {
    const { data } = await sb.from('pdm_dados').select('valor').eq('chave', cfg.chave).maybeSingle();
    const h = data?.valor?.hash;
    return typeof h === 'string' && h.length ? h : null;
  } catch { return null; }
}

// Existe alguma senha da dona configurada? (banco OU env)
export async function temSenhaDona(sb) {
  if (await hashSalvo(sb)) return true;
  return !!process.env.APP_PASSWORD;
}

// Confere a senha de um papel qualquer (hoje: dona e reservas). O banco tem
// prioridade; sem nada no banco, vale o padrão de fábrica.
export async function conferirSenhaPapel(sb, papel, senha) {
  const cfg = PAPEIS[papel];
  if (!cfg || !senha) return false;
  const h = await hashSalvo(sb, papel);
  if (h) return igualHex(hashSenha(senha), h);
  const env = cfg.env();
  return !!env && igualHex(hashSenha(senha), hashSenha(env));
}

// Grava a senha nova de um papel (só o hash, nunca o texto puro).
export async function definirSenhaPapel(sb, papel, novaSenha) {
  const cfg = PAPEIS[papel];
  if (!cfg) throw new Error('Papel sem senha própria.');
  const { error } = await sb.from('pdm_dados').upsert(
    { chave: cfg.chave, valor: { hash: hashSenha(novaSenha), atualizadoEm: new Date().toISOString() }, atualizado_em: new Date().toISOString() },
    { onConflict: 'chave' }
  );
  if (error) throw error;
}

// Atalhos da dona — o resto do app já chamava por estes nomes.
export function conferirSenhaDona(sb, senha) {
  return conferirSenhaPapel(sb, 'dona', senha);
}

export function definirSenhaDona(sb, novaSenha) {
  return definirSenhaPapel(sb, 'dona', novaSenha);
}
