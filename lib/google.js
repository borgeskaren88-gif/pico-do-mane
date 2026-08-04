import { supabaseServer } from './supabase';
import { brl, addDays, agruparContasAbertas } from './util';

// Integração com o Google Agenda (Calendar API) via OAuth. Escreve os boletos a
// vencer e as tarefas com data direto na agenda principal do usuário, na hora.
// Sem dependências externas: usa fetch nos endpoints oficiais do Google.

const TOKEN_CHAVE = 'google_token';
const SYNC_CHAVE = 'google_sync';
const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'openid', 'email'];

function cfg() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  return { clientId, clientSecret, appUrl, redirect: appUrl + '/api/google/callback' };
}

export function googleConfigurado() {
  const c = cfg();
  return !!(c.clientId && c.clientSecret && c.appUrl);
}

export function urlConsentimento(state) {
  const c = cfg();
  const p = new URLSearchParams({
    client_id: c.clientId, redirect_uri: c.redirect, response_type: 'code',
    scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent',
    include_granted_scopes: 'true', state: state || 'picoos',
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + p.toString();
}

// ---- armazenamento do token (mesma tabela do Supabase, outra chave) ----
async function lerToken() {
  const sb = supabaseServer();
  const { data } = await sb.from('pdm_dados').select('valor').eq('chave', TOKEN_CHAVE).maybeSingle();
  return data?.valor || null;
}
async function salvarToken(tok) {
  const sb = supabaseServer();
  await sb.from('pdm_dados').upsert({ chave: TOKEN_CHAVE, valor: tok, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
}
export async function desconectar() {
  const sb = supabaseServer();
  await sb.from('pdm_dados').delete().eq('chave', TOKEN_CHAVE);
  await sb.from('pdm_dados').delete().eq('chave', SYNC_CHAVE);
}

function emailDoIdToken(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString('utf8'));
    return payload.email || '';
  } catch { return ''; }
}

export async function finalizarLogin(code) {
  const c = cfg();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: c.clientId, client_secret: c.clientSecret, redirect_uri: c.redirect, grant_type: 'authorization_code' }),
  });
  if (!res.ok) throw new Error('Falha ao autorizar no Google: ' + (await res.text()));
  const t = await res.json();
  const tok = {
    refresh_token: t.refresh_token || null,
    access_token: t.access_token || '',
    expiry: Date.now() + ((t.expires_in || 3600) * 1000) - 60000,
    email: t.id_token ? emailDoIdToken(t.id_token) : '',
  };
  // Se o Google não devolveu refresh_token (já autorizado antes), mantém o antigo.
  if (!tok.refresh_token) {
    const antigo = await lerToken();
    if (antigo?.refresh_token) tok.refresh_token = antigo.refresh_token;
  }
  await salvarToken(tok);
  return tok;
}

async function accessTokenValido() {
  const tok = await lerToken();
  if (!tok || !tok.refresh_token) return null;
  if (tok.access_token && tok.expiry && Date.now() < tok.expiry) return tok.access_token;
  const c = cfg();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: tok.refresh_token, grant_type: 'refresh_token' }),
  });
  if (!res.ok) throw new Error('Falha ao renovar o acesso do Google: ' + (await res.text()));
  const j = await res.json();
  const novo = { ...tok, access_token: j.access_token, expiry: Date.now() + ((j.expires_in || 3600) * 1000) - 60000 };
  await salvarToken(novo);
  return novo.access_token;
}

export async function statusGoogle() {
  if (!googleConfigurado()) return { configurado: false, conectado: false, email: '' };
  let tok = null;
  try { tok = await lerToken(); } catch { tok = null; }
  return { configurado: true, conectado: !!(tok && tok.refresh_token), email: tok?.email || '' };
}

// ---- montagem dos eventos desejados a partir dos dados ----
function eventosDesejados(dados) {
  const compras = Array.isArray(dados?.compras) ? dados.compras : [];
  const tarefas = Array.isArray(dados?.tarefas) ? dados.tarefas : [];
  const desejados = {};
  const abertas = compras.filter((c) => c.pago !== 'Sim' && c.vencimento);
  for (const g of agruparContasAbertas(abertas)) {
    if (!g.vencimento) continue;
    const nome = (g.fornecedor && g.fornecedor.trim()) || (g.itens[0] && g.itens[0].produto) || 'Conta';
    const data = (g.vencimento || '').slice(0, 10);
    desejados['boleto-' + g.chave] = {
      summary: `Boleto: ${nome} — ${brl(g.total)}`,
      description: g.itens.length > 1 ? `${g.itens.length} itens${g.nota ? ` · Nota ${g.nota}` : ''}` : (g.nota ? `Nota ${g.nota}` : 'Pico do Mané'),
      date: data, dateEnd: addDays(data, 1),
    };
  }
  for (const t of tarefas) {
    if (t.feito || !t.data) continue;
    desejados['tarefa-' + t.id] = {
      summary: `Tarefa: ${t.texto || ''}`, description: 'Pico do Mané',
      date: (t.data || '').slice(0, 10), dateEnd: addDays((t.data || '').slice(0, 10), 1),
    };
  }
  return desejados;
}

async function lerSync() {
  const sb = supabaseServer();
  const { data } = await sb.from('pdm_dados').select('valor').eq('chave', SYNC_CHAVE).maybeSingle();
  return (data?.valor && data.valor.events) || {};
}
async function salvarSync(events) {
  const sb = supabaseServer();
  await sb.from('pdm_dados').upsert({ chave: SYNC_CHAVE, valor: { events }, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
}

function corpoEvento(ev) {
  return {
    summary: ev.summary,
    description: ev.description || '',
    start: { date: ev.date },
    end: { date: ev.dateEnd },
    transparency: 'transparent',
    source: { title: 'PicoOS', url: (process.env.APP_URL || '') },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 540 }] },
  };
}

async function calAPI(path, method, body, accessToken) {
  return fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events' + path, {
    method,
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Faz a agenda do Google refletir exatamente os boletos/tarefas atuais.
export async function sincronizar(dados) {
  const accessToken = await accessTokenValido();
  if (!accessToken) throw new Error('Google não conectado.');
  const desejados = eventosDesejados(dados);
  const map = await lerSync();
  let criados = 0, atualizados = 0, removidos = 0;

  for (const [uid, ev] of Object.entries(desejados)) {
    const corpo = corpoEvento(ev);
    if (map[uid]) {
      const res = await calAPI('/' + map[uid], 'PUT', corpo, accessToken);
      if (res.ok) { atualizados++; continue; }
      if (res.status === 404 || res.status === 410) { delete map[uid]; }
    }
    if (!map[uid]) {
      const res = await calAPI('', 'POST', corpo, accessToken);
      if (res.ok) { const j = await res.json(); map[uid] = j.id; criados++; }
      else throw new Error('Erro ao criar evento no Google: ' + (await res.text()));
    }
  }
  for (const uid of Object.keys(map)) {
    if (!desejados[uid]) {
      const res = await calAPI('/' + map[uid], 'DELETE', null, accessToken);
      if (res.ok || res.status === 404 || res.status === 410) { delete map[uid]; removidos++; }
    }
  }
  await salvarSync(map);
  return { criados, atualizados, removidos, total: Object.keys(desejados).length };
}
