import { NextResponse } from 'next/server';
import { tokenCalendarioValido } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';
import { brl, addDays, agruparContasAbertas } from '../../../lib/util';

export const dynamic = 'force-dynamic';

const CHAVE = 'painel';

// Escapa texto conforme o RFC 5545 (iCalendar).
const esc = (s) => String(s == null ? '' : s)
  .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

// Dobra linhas longas (limite de 75 octetos): quebra com CRLF + espaço.
function fold(linha) {
  if (linha.length <= 73) return linha;
  const partes = [];
  let s = linha;
  partes.push(s.slice(0, 73));
  s = s.slice(73);
  while (s.length) { partes.push(' ' + s.slice(0, 72)); s = s.slice(72); }
  return partes.join('\r\n');
}

const dataICS = (iso) => (iso || '').slice(0, 10).replace(/-/g, ''); // YYYYMMDD
const uidSafe = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '-');

function vevento({ uid, data, resumo, descricao, dtstamp }) {
  const ini = dataICS(data);
  const fim = dataICS(addDays(data, 1));
  const linhas = [
    'BEGIN:VEVENT',
    `UID:${uidSafe(uid)}@picoos`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${ini}`,
    `DTEND;VALUE=DATE:${fim}`,
    `SUMMARY:${esc(resumo)}`,
    descricao ? `DESCRIPTION:${esc(descricao)}` : null,
    'TRANSP:TRANSPARENT',
    // Lembrete na véspera (18h) e no dia (9h) — o Calendário do iPhone dispara.
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(resumo)}`, 'TRIGGER:-PT6H', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(resumo)}`, 'TRIGGER:PT9H', 'END:VALARM',
    'END:VEVENT',
  ].filter(Boolean);
  return linhas.map(fold).join('\r\n');
}

function montarICS(dados) {
  const compras = Array.isArray(dados?.compras) ? dados.compras : [];
  const tarefas = Array.isArray(dados?.tarefas) ? dados.tarefas : [];
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

  const eventos = [];

  // Boletos / contas a pagar em aberto (agrupados por nota, como na aba).
  const abertas = compras.filter((c) => c.pago !== 'Sim' && c.vencimento);
  for (const g of agruparContasAbertas(abertas)) {
    if (!g.vencimento) continue;
    const nome = (g.fornecedor && g.fornecedor.trim()) || (g.itens[0] && g.itens[0].produto) || 'Conta';
    const resumo = `Boleto: ${nome} — ${brl(g.total)}`;
    const desc = g.itens.length > 1 ? `${g.itens.length} itens${g.nota ? ` · Nota ${g.nota}` : ''}` : (g.nota ? `Nota ${g.nota}` : '');
    eventos.push(vevento({ uid: `boleto-${g.chave}`, data: g.vencimento, resumo, descricao: desc, dtstamp }));
  }

  // Tarefas do checklist com data marcada e ainda não feitas.
  for (const t of tarefas) {
    if (t.feito || !t.data) continue;
    eventos.push(vevento({ uid: `tarefa-${t.id}`, data: t.data, resumo: `Tarefa: ${t.texto || ''}`, descricao: '', dtstamp }));
  }

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PicoOS//Pico do Mane//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:PicoOS — Pico do Mané',
    'X-WR-TIMEZONE:America/Sao_Paulo',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...eventos,
    'END:VCALENDAR',
  ].join('\r\n');
}

export async function GET(request) {
  const t = new URL(request.url).searchParams.get('t');
  if (!tokenCalendarioValido(t)) {
    return new NextResponse('Nao autorizado', { status: 401 });
  }
  let dados = {};
  try {
    const sb = supabaseServer();
    const { data } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE).maybeSingle();
    dados = data?.valor || {};
  } catch {
    dados = {};
  }
  return new NextResponse(montarICS(dados), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="picoos.ics"',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
