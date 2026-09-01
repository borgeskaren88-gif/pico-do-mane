import crypto from 'crypto';

// Senha da dona: pode ser trocada pela própria dona, dentro do app. A senha nova
// fica guardada no banco (só o hash, nunca o texto puro) na linha 'authDona' e
// tem PRIORIDADE sobre a variável de ambiente APP_PASSWORD (que continua valendo
// como padrão de fábrica, caso nunca tenha sido trocada).
const CHAVE = 'authDona';

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
async function hashSalvo(sb) {
  try {
    const { data } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE).maybeSingle();
    const h = data?.valor?.hash;
    return typeof h === 'string' && h.length ? h : null;
  } catch { return null; }
}

// Existe alguma senha da dona configurada? (banco OU env)
export async function temSenhaDona(sb) {
  if (await hashSalvo(sb)) return true;
  return !!process.env.APP_PASSWORD;
}

// Confere a senha da dona: primeiro contra o hash do banco (se houver), senão
// contra a APP_PASSWORD. Timing-safe nos dois caminhos.
export async function conferirSenhaDona(sb, senha) {
  if (!senha) return false;
  const h = await hashSalvo(sb);
  if (h) return igualHex(hashSenha(senha), h);
  const env = process.env.APP_PASSWORD || '';
  return !!env && igualHex(hashSenha(senha), hashSenha(env));
}

// Grava a nova senha da dona (só o hash).
export async function definirSenhaDona(sb, novaSenha) {
  const { error } = await sb.from('pdm_dados').upsert(
    { chave: CHAVE, valor: { hash: hashSenha(novaSenha), atualizadoEm: new Date().toISOString() }, atualizado_em: new Date().toISOString() },
    { onConflict: 'chave' }
  );
  if (error) throw error;
}
