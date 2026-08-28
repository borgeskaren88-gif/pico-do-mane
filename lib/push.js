import webpush from 'web-push';

// Push (avisos no celular) do PicoOS. Estratégia pensada pra dona não precisar
// mexer em configuração nenhuma (nem variável de ambiente na Vercel):
//   - As chaves VAPID (assinatura do push) são geradas UMA vez e guardadas na
//     nuvem, na linha 'pushConfig'. Depois é só ler de lá.
//   - Cada aparelho que ativa as notificações vira uma linha 'push:<id>'. Mandar
//     push é ler todas essas linhas e disparar. Se um aparelho expira (a pessoa
//     desinstalou / limpou), a linha é apagada sozinha (erro 404/410).
// Tudo fica no mesmo banco dos outros dados — mesmo nível de confiança.

const CHAVE_CONFIG = 'pushConfig';
const PREFIXO_SUB = 'push:';
export const SUBJECT = 'mailto:borgeskaren88@gmail.com';

// Lê (ou cria na primeira vez) as chaves VAPID guardadas na nuvem.
export async function obterConfigPush(sb) {
  const { data } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE_CONFIG).maybeSingle();
  const cfg = data?.valor;
  if (cfg && cfg.publicKey && cfg.privateKey) return cfg;
  // Primeira vez: gera o par de chaves e guarda.
  const chaves = webpush.generateVAPIDKeys();
  const novo = { publicKey: chaves.publicKey, privateKey: chaves.privateKey, subject: SUBJECT, criadoEm: new Date().toISOString() };
  await sb.from('pdm_dados').upsert({ chave: CHAVE_CONFIG, valor: novo, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
  return novo;
}

// Id estável por aparelho, derivado do endereço da inscrição (não guarda dado sensível em claro).
function idDaSub(sub) {
  const ep = (sub && sub.endpoint) || '';
  let h = 0;
  for (let i = 0; i < ep.length; i++) { h = (h * 31 + ep.charCodeAt(i)) | 0; }
  return PREFIXO_SUB + (h >>> 0).toString(36) + '-' + ep.length.toString(36);
}

export async function salvarInscricao(sb, sub, apelido) {
  if (!sub || !sub.endpoint) throw new Error('Inscrição inválida.');
  const chave = idDaSub(sub);
  const valor = { sub, apelido: apelido || '', criadoEm: new Date().toISOString() };
  await sb.from('pdm_dados').upsert({ chave, valor, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
  return chave;
}

export async function removerInscricao(sb, sub) {
  if (!sub || !sub.endpoint) return;
  await sb.from('pdm_dados').delete().eq('chave', idDaSub(sub));
}

async function lerInscricoes(sb) {
  const { data } = await sb.from('pdm_dados').select('chave, valor').like('chave', PREFIXO_SUB + '%');
  return (data || []).map((r) => ({ chave: r.chave, sub: r.valor?.sub })).filter((x) => x.sub && x.sub.endpoint);
}

// Manda um push pra TODOS os aparelhos inscritos. Best-effort: nunca lança —
// devolve um resumo. Aparelho morto (404/410) é apagado na hora.
export async function enviarPush(sb, { titulo, corpo, url = '/', tag, dados } = {}) {
  let cfg;
  try { cfg = await obterConfigPush(sb); } catch { return { ok: false, enviados: 0, erro: 'sem config' }; }
  webpush.setVapidDetails(cfg.subject || SUBJECT, cfg.publicKey, cfg.privateKey);
  const inscricoes = await lerInscricoes(sb);
  if (!inscricoes.length) return { ok: true, enviados: 0, total: 0 };
  const payload = JSON.stringify({ title: titulo || 'PicoOS', body: corpo || '', url, tag, dados: dados || {} });
  let enviados = 0;
  const mortas = [];
  await Promise.all(inscricoes.map(async ({ chave, sub }) => {
    try { await webpush.sendNotification(sub, payload); enviados += 1; }
    catch (e) { const s = e?.statusCode; if (s === 404 || s === 410) mortas.push(chave); }
  }));
  if (mortas.length) { try { await sb.from('pdm_dados').delete().in('chave', mortas); } catch { /* ignora */ } }
  return { ok: true, enviados, total: inscricoes.length, removidas: mortas.length };
}
