import { supabaseServer } from './supabase';
import { brl, agruparContasAbertas, addDays } from './util';

const TZ = 'America/Sao_Paulo';

// Integração com o Google Agenda (Calendar API) via OAuth. Escreve os boletos a
// vencer e as tarefas com data direto na agenda principal do usuário, na hora.
// Sem dependências externas: usa fetch nos endpoints oficiais do Google.

const TOKEN_CHAVE = 'google_token';
const SYNC_CHAVE = 'google_sync';
const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/tasks', 'openid', 'email'];

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
  const c = cfg();
  const seg = c.clientSecret || '';
  const id = c.clientId || '';
  // "Impressão digital" (sem revelar a chave) pra diagnosticar problemas de
  // colagem: formato, tamanho e espaços em branco.
  const diag = {
    segStarts: seg.startsWith('GOCSPX-'),
    segLen: seg.length,
    segEspaco: /\s/.test(seg),
    idEnds: id.endsWith('.apps.googleusercontent.com'),
    idLen: id.length,
    idEspaco: /\s/.test(id),
  };
  return { configurado: true, conectado: !!(tok && tok.refresh_token), email: tok?.email || '', diag };
}

// ---- itens a sincronizar (boletos + tarefas) como Tarefas do Google ----
function itensDesejados(dados) {
  const compras = Array.isArray(dados?.compras) ? dados.compras : [];
  const tarefas = Array.isArray(dados?.tarefas) ? dados.tarefas : [];
  const desejados = {};
  const abertas = compras.filter((c) => c.pago !== 'Sim' && c.vencimento);
  for (const g of agruparContasAbertas(abertas)) {
    if (!g.vencimento) continue;
    const nome = (g.fornecedor && g.fornecedor.trim()) || (g.itens[0] && g.itens[0].produto) || 'Conta';
    desejados['boleto-' + g.chave] = {
      title: `Boleto: ${nome} — ${brl(g.total)}`,
      notes: g.itens.length > 1 ? `${g.itens.length} itens${g.nota ? ` · Nota ${g.nota}` : ''}` : (g.nota ? `Nota ${g.nota}` : 'Pico do Mané'),
      due: (g.vencimento || '').slice(0, 10),
    };
  }
  for (const t of tarefas) {
    if (t.feito || !t.data) continue;
    desejados['tarefa-' + t.id] = { title: `Tarefa: ${t.texto || ''}`, notes: 'Pico do Mané', due: (t.data || '').slice(0, 10) };
  }
  return desejados;
}

async function lerEstado() {
  const sb = supabaseServer();
  const { data } = await sb.from('pdm_dados').select('valor').eq('chave', SYNC_CHAVE).maybeSingle();
  const v = data?.valor || {};
  return { events: v.events || {}, tasks: v.tasks || {} };
}
async function salvarEstado(estado) {
  const sb = supabaseServer();
  await sb.from('pdm_dados').upsert({ chave: SYNC_CHAVE, valor: estado, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
}

async function calAPI(path, method, body, accessToken) {
  return fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events' + path, {
    method, headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
}
async function tasksAPI(path, method, body, accessToken) {
  return fetch('https://www.googleapis.com/tasks/v1/lists/@default/tasks' + path, {
    method, headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
}
const dueRFC = (data) => `${data}T00:00:00.000Z`;

// Lê os próximos compromissos: eventos da agenda + tarefas do Google (com data).
// Retorna null se não estiver conectado.
export async function listarEventos() {
  const accessToken = await accessTokenValido();
  if (!accessToken) return null;
  const agora = new Date();
  const timeMax = new Date(agora.getTime() + 30 * 24 * 3600 * 1000);
  const itens = [];
  // Eventos da agenda
  const params = new URLSearchParams({ timeMin: agora.toISOString(), timeMax: timeMax.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '20' });
  const resEv = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?' + params.toString(), { headers: { Authorization: 'Bearer ' + accessToken } });
  if (resEv.ok) {
    const j = await resEv.json();
    for (const e of (j.items || [])) {
      const inicio = (e.start && (e.start.dateTime || e.start.date)) || '';
      if (inicio) itens.push({ id: e.id, titulo: e.summary || '(sem título)', inicio, diaTodo: !(e.start && e.start.dateTime), tarefa: false });
    }
  }
  // Tarefas do Google (com data de vencimento, dentro da janela)
  try {
    const resT = await fetch('https://www.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=false&maxResults=100', { headers: { Authorization: 'Bearer ' + accessToken } });
    if (resT.ok) {
      const jt = await resT.json();
      const hojeD = agora.toISOString().slice(0, 10);
      const fimD = timeMax.toISOString().slice(0, 10);
      for (const t of (jt.items || [])) {
        if (!t.due) continue;
        const d = t.due.slice(0, 10);
        if (d < hojeD || d > fimD) continue;
        itens.push({ id: 'task-' + t.id, titulo: t.title || '(tarefa)', inicio: d, diaTodo: true, tarefa: true });
      }
    }
  } catch { /* Tasks pode não estar autorizado ainda */ }
  itens.sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));
  return itens.filter((e) => e.inicio);
}

// Cria um compromisso no Google Agenda (agenda principal). `data` = 'YYYY-MM-DD';
// se `diaTodo`, vira evento de dia inteiro; senão usa `hora` ('HH:MM') e dura 1h.
function maisUmaHora(data, h) {
  let [hh, mm] = String(h || '12:00').split(':').map((n) => parseInt(n, 10) || 0);
  hh += 1;
  let d = data;
  if (hh >= 24) { hh -= 24; d = addDays(data, 1); }
  const p = (n) => String(n).padStart(2, '0');
  return `${d}T${p(hh)}:${p(mm)}:00-03:00`;
}

export async function criarEvento({ titulo, data, hora, diaTodo }) {
  const accessToken = await accessTokenValido();
  if (!accessToken) throw new Error('Google não conectado.');
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data inválida.');
  const nome = String(titulo || '').trim().slice(0, 200) || '(sem título)';
  let body;
  if (diaTodo) {
    body = { summary: nome, start: { date: data }, end: { date: addDays(data, 1) } };
  } else {
    const h = /^\d{2}:\d{2}$/.test(hora || '') ? hora : '12:00';
    body = { summary: nome, start: { dateTime: `${data}T${h}:00-03:00`, timeZone: TZ }, end: { dateTime: maisUmaHora(data, h), timeZone: TZ } };
  }
  const res = await calAPI('', 'POST', body, accessToken);
  if (!res.ok) throw new Error('Erro ao criar o evento no Google: ' + (await res.text()));
  return await res.json();
}

// Marca uma Tarefa do Google como concluída (o "dar ok" na agenda). Recebe o id
// da tarefa (sem o prefixo "task-"). Concluída, ela some da lista de pendentes.
export async function concluirTarefa(taskId) {
  const accessToken = await accessTokenValido();
  if (!accessToken) throw new Error('Google não conectado.');
  const id = String(taskId || '').trim();
  if (!id) throw new Error('Tarefa não informada.');
  const res = await tasksAPI('/' + encodeURIComponent(id), 'PATCH', { status: 'completed' }, accessToken);
  if (!res.ok) throw new Error('Erro ao concluir a tarefa no Google: ' + (await res.text()));
  return true;
}

// Faz as Tarefas do Google refletirem exatamente os boletos/tarefas atuais.
export async function sincronizar(dados) {
  const accessToken = await accessTokenValido();
  if (!accessToken) throw new Error('Google não conectado.');
  const estado = await lerEstado();
  const desejados = itensDesejados(dados);
  const map = estado.tasks;
  let criados = 0, atualizados = 0, removidos = 0;

  // 1) Tarefas primeiro. Se faltar a permissão de Tasks, lança aqui e NÃO mexe
  //    nos eventos antigos (evita apagar tudo sem ter criado as tarefas).
  for (const [uid, it] of Object.entries(desejados)) {
    if (map[uid]) {
      const res = await tasksAPI('/' + map[uid], 'PATCH', { title: it.title, notes: it.notes || '', due: dueRFC(it.due) }, accessToken);
      if (res.ok) { atualizados++; continue; }
      if (res.status === 404) delete map[uid];
    }
    if (!map[uid]) {
      const res = await tasksAPI('', 'POST', { title: it.title, notes: it.notes || '', due: dueRFC(it.due), status: 'needsAction' }, accessToken);
      if (res.ok) { const j = await res.json(); map[uid] = j.id; criados++; }
      else throw new Error('Erro ao criar tarefa no Google: ' + (await res.text()));
    }
  }
  for (const uid of Object.keys(map)) {
    if (!desejados[uid]) { try { await tasksAPI('/' + map[uid], 'DELETE', null, accessToken); } catch { /* ignora */ } delete map[uid]; removidos++; }
  }

  // 2) Migração: remove os eventos "dia todo" que criávamos antes.
  for (const uid of Object.keys(estado.events)) {
    try { await calAPI('/' + estado.events[uid], 'DELETE', null, accessToken); } catch { /* ignora */ }
    delete estado.events[uid];
  }

  await salvarEstado({ events: estado.events, tasks: map });
  return { criados, atualizados, removidos, total: Object.keys(desejados).length };
}
