import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

// Ponto da equipe: cada registro é um turno { id, nome, entrada, saida, data }.
// Guardado em linhas próprias (chave 'ponto:<id>'), separado do painel — assim
// bater ponto nunca colide com um salvamento do resto do sistema.
const PREFIXO = 'ponto:';
const txt = (v, max) => String(v == null ? '' : v).slice(0, max).trim();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const norm = (s) => (s || '').trim().toLowerCase();
// Padroniza o nome pra NÃO virar "duas pessoas" por causa de maiúscula/espaço:
// "FRANCINE", "francine", " Francine " -> "Francine". Assim as horas somam certo.
const nomeCanonico = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase().replace(/(^|\s)([\p{L}])/gu, (m, sp, c) => sp + c.toUpperCase());
const hojeBrasil = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// A cozinha e o atendimento batem o ponto; a dona também vê e pode corrigir.
function papel() {
  const p = papelDaSessao(cookies().get(nomeCookie())?.value);
  return p === 'dona' || p === 'cozinha' || p === 'garcom' ? p : null;
}

async function lerRegistros(sb) {
  const { data, error } = await sb.from('pdm_dados').select('valor').like('chave', PREFIXO + '%');
  if (error) throw error;
  return (data || []).map((r) => r.valor).filter(Boolean);
}

export async function GET() {
  const p = papel();
  if (!p) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    // Privacidade: cada setor vê só o próprio ponto (cozinha ↔ atendimento). A
    // dona vê todos. Registros antigos sem "papel" (feitos antes da privacidade)
    // aparecem pra qualquer setor, pra não sumir com turno aberto de ninguém.
    const registros = (await lerRegistros(sb))
      .filter((r) => p === 'dona' || !r.papel || r.papel === p)
      .sort((a, b) => (b.entrada || '').localeCompare(a.entrada || ''));
    // Jornada esperada por setor (dona configura): { cozinha:{dias,entrada,saida}, garcom:{...} }.
    const { data: jr } = await sb.from('pdm_dados').select('valor').eq('chave', 'jornadas').maybeSingle();
    const jornadas = (jr?.valor && typeof jr.valor === 'object') ? jr.valor : {};
    return NextResponse.json({ ok: true, registros, jornadas, papel: p });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao carregar o ponto.' }, { status: 500 });
  }
}

export async function POST(request) {
  const p = papel();
  if (!p) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }
  const acao = txt(body?.acao, 20);
  const nome = txt(body?.nome, 60);
  try {
    const sb = supabaseServer();

    if (acao === 'entrada') {
      if (!nome) return NextResponse.json({ ok: false, erro: 'Diga o nome de quem está entrando.' }, { status: 400 });
      const abertos = (await lerRegistros(sb)).filter((v) => !v.saida && norm(v.nome) === norm(nome) && (!v.papel || v.papel === p));
      if (abertos.length) return NextResponse.json({ ok: true, jaAberto: true, registro: abertos[0] });
      const reg = { id: uid(), nome: nomeCanonico(nome), entrada: new Date().toISOString(), saida: null, data: hojeBrasil(), papel: p };
      const { error } = await sb.from('pdm_dados').upsert({ chave: PREFIXO + reg.id, valor: reg, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
      if (error) throw error;
      return NextResponse.json({ ok: true, registro: reg });
    }

    if (acao === 'saida') {
      if (!nome) return NextResponse.json({ ok: false, erro: 'Diga o nome de quem está saindo.' }, { status: 400 });
      const abertos = (await lerRegistros(sb)).filter((v) => !v.saida && norm(v.nome) === norm(nome) && (!v.papel || v.papel === p));
      if (!abertos.length) return NextResponse.json({ ok: false, erro: 'Não há entrada aberta com esse nome.' }, { status: 400 });
      abertos.sort((a, b) => (b.entrada || '').localeCompare(a.entrada || ''));
      const reg = { ...abertos[0], saida: new Date().toISOString() };
      const { error } = await sb.from('pdm_dados').upsert({ chave: PREFIXO + reg.id, valor: reg, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
      if (error) throw error;
      return NextResponse.json({ ok: true, registro: reg });
    }

    // Salvar a jornada esperada por setor (só a dona). Valida dias (0=Dom..6=Sáb)
    // e horários HH:MM. Guarda na linha 'jornadas' (fora do prefixo 'ponto:').
    if (acao === 'jornadas') {
      if (p !== 'dona') return NextResponse.json({ ok: false, erro: 'Só a dona configura a jornada.' }, { status: 403 });
      const entra = (body?.jornadas && typeof body.jornadas === 'object') ? body.jornadas : {};
      const hhmm = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); if (!m) return ''; const h = Math.min(23, Math.max(0, +m[1])); const mi = Math.min(59, Math.max(0, +m[2])); return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`; };
      const limpo = {};
      for (const key of ['cozinha', 'garcom', 'dona']) {
        const j = entra[key];
        if (!j || typeof j !== 'object') continue;
        const nome = nomeCanonico(txt(j.nome, 60));
        const dias = Array.isArray(j.dias) ? [...new Set(j.dias.map(Number).filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b) : [];
        const entrada = hhmm(j.entrada), saida = hhmm(j.saida);
        const temJornada = dias.length && entrada && saida;
        if (!nome && !temJornada) continue;
        limpo[key] = {};
        if (nome) limpo[key].nome = nome;
        if (temJornada) { limpo[key].dias = dias; limpo[key].entrada = entrada; limpo[key].saida = saida; }
      }
      const { error } = await sb.from('pdm_dados').upsert({ chave: 'jornadas', valor: limpo, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
      if (error) throw error;
      return NextResponse.json({ ok: true, jornadas: limpo });
    }

    // Lançar um turno passado à mão (só a dona): pra registrar os dias que a
    // equipe trabalhou antes de começar a bater ponto. Recebe data (YYYY-MM-DD)
    // e horários HH:MM; monta os horários no fuso do Brasil (UTC-3, sem horário
    // de verão). Se a saída for <= entrada, a saída cai no dia seguinte (vira a
    // meia-noite, ex.: 16:00 → 00:00).
    if (acao === 'lancar') {
      if (p !== 'dona') return NextResponse.json({ ok: false, erro: 'Só a dona lança turno à mão.' }, { status: 403 });
      const setor = ['cozinha', 'garcom', 'dona'].includes(body?.setor) ? body.setor : '';
      const data = txt(body?.data, 10);
      const hm = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); if (!m) return null; return `${String(Math.min(23, Math.max(0, +m[1]))).padStart(2, '0')}:${String(Math.min(59, Math.max(0, +m[2]))).padStart(2, '0')}`; };
      const eHM = hm(body?.entrada), sHM = hm(body?.saida);
      if (!nome || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !eHM || !sHM) return NextResponse.json({ ok: false, erro: 'Preencha nome, dia e horários.' }, { status: 400 });
      const mins = (x) => (+x.slice(0, 2)) * 60 + (+x.slice(3, 5));
      const proxDia = (d) => { const dt = new Date(d + 'T12:00:00-03:00'); dt.setDate(dt.getDate() + 1); return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt); };
      const dataSaida = mins(sHM) <= mins(eHM) ? proxDia(data) : data;
      const entradaISO = new Date(`${data}T${eHM}:00-03:00`).toISOString();
      const saidaISO = new Date(`${dataSaida}T${sHM}:00-03:00`).toISOString();
      const reg = { id: uid(), nome: nomeCanonico(nome), entrada: entradaISO, saida: saidaISO, data, papel: setor, manual: true };
      const { error } = await sb.from('pdm_dados').upsert({ chave: PREFIXO + reg.id, valor: reg, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
      if (error) throw error;
      return NextResponse.json({ ok: true, registro: reg });
    }

    // Apagar um registro de ponto (só a dona) — pra corrigir um ponto errado.
    if (acao === 'excluir') {
      if (p !== 'dona') return NextResponse.json({ ok: false, erro: 'Só a dona pode apagar um ponto.' }, { status: 403 });
      const id = txt(body?.id, 40);
      if (!id) return NextResponse.json({ ok: false, erro: 'Registro não informado.' }, { status: 400 });
      const { error } = await sb.from('pdm_dados').delete().eq('chave', PREFIXO + id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, erro: 'Ação inválida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao registrar o ponto.' }, { status: 500 });
  }
}
