'use client';
// Helpers de push no lado do navegador (usados pela tela de Notificações da dona
// e pelo aviso da cozinha). Concentra a parte chata (permissão, inscrição) num
// lugar só, pra não repetir e não errar.

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSuportado() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
export function ehIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
export function estaInstalado() {
  if (typeof window === 'undefined') return false;
  return window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
}

export async function statusPush() {
  if (!pushSuportado()) return { suporta: false, inscrito: false, permissao: 'default' };
  let inscrito = false;
  try { const reg = await navigator.serviceWorker.ready; inscrito = !!(await reg.pushManager.getSubscription()); } catch { /* ignora */ }
  return { suporta: true, inscrito, permissao: Notification.permission };
}

// Ativa: pede permissão, pega a chave pública, inscreve e guarda no servidor.
// Devolve { ok, erro }.
export async function ativarPush(apelido) {
  if (!pushSuportado()) return { ok: false, erro: 'Este aparelho não suporta notificações.' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, erro: 'Você precisa permitir as notificações no aparelho.' };
  const r = await fetch('/api/push', { cache: 'no-store' });
  const j = await r.json();
  if (!j.ok || !j.publicKey) return { ok: false, erro: j.erro || 'Não consegui preparar as notificações.' };
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(j.publicKey) });
  const ap = apelido || (ehIOS() ? 'iPhone/iPad' : (/android/i.test(navigator.userAgent) ? 'Android' : 'Computador'));
  const rs = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'inscrever', sub, apelido: ap }) });
  const js = await rs.json();
  if (!js.ok) return { ok: false, erro: js.erro || 'Não consegui salvar a inscrição.' };
  return { ok: true };
}

export async function desativarPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'desinscrever', sub }) }); await sub.unsubscribe(); }
    return { ok: true };
  } catch (e) { return { ok: false, erro: e?.message || 'erro' }; }
}

export async function testarPush() {
  const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'teste' }) });
  return r.json();
}
