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
    return NextResponse.json({ ok: true, registros });
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
      const reg = { id: uid(), nome, entrada: new Date().toISOString(), saida: null, data: hojeBrasil(), papel: p };
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
