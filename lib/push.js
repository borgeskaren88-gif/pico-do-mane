// Configuração das notificações push (Web Push / VAPID).
// A chave PÚBLICA pode ficar no código — ela é pública mesmo. A chave PRIVADA
// é secreta e vem só da variável de ambiente VAPID_PRIVATE_KEY (na Vercel).
export const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  || 'BPSPxpDq3l8r3JuVRtjB2wqZiC0K-tsk0gwQLBOqeCS9A0cz794WjonVUVmWO5WGkgK3MNOtqkEa0U0W-dXbXN0';

// Converte a chave pública (base64url) para o formato que o navegador exige.
export function urlB64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
