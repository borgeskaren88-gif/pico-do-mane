import webpush from 'web-push';
import { VAPID_PUBLIC } from './push';

// Envio de push a partir do servidor (rotas). Best-effort: nunca lança.
// Só funciona se VAPID_PRIVATE_KEY estiver configurada (na Vercel).
let configurado = false;
function configurar() {
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!priv) return false;
  if (!configurado) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:nossacasa@app.local', VAPID_PUBLIC, priv);
    configurado = true;
  }
  return true;
}

// Manda um push pros aparelhos de um usuário (as inscrições ficam no caderno
// privado dele, na chave caderno:<id>).
export async function enviarPushUsuario(sb, userId, { titulo, corpo, url = '/', tag } = {}) {
  try {
    if (!configurar()) return;
    const { data } = await sb.from('casa_dados').select('valor').eq('chave', `caderno:${userId}`).maybeSingle();
    const subs = Array.isArray(data?.valor?.pushSubs) ? data.valor.pushSubs : [];
    if (!subs.length) return;
    const payload = JSON.stringify({ titulo, corpo, url, tag });
    await Promise.all(subs.map((s) => webpush.sendNotification(s, payload).catch(() => {})));
  } catch {}
}
