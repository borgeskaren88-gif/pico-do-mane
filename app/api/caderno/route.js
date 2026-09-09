import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, usuarioDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';

// Caderno PRIVADO de cada pessoa. Fica na mesma tabela casa_dados, mas numa
// chave separada por usuário (ex.: "caderno:u1"). A chave vem SEMPRE do id de
// quem está logado (do cookie), então cada uma só lê/grava o próprio caderno —
// a outra nunca vê. Guarda notas, lembretes e checklist.
export const dynamic = 'force-dynamic';

function usuarioLogado() {
  return usuarioDaSessao(cookies().get(nomeCookie())?.value);
}

const txt = (v, max) => String(v == null ? '' : v).slice(0, max).trim();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const arr = (v) => (Array.isArray(v) ? v : []);
const LIM = 500; // teto de itens por seção, só pra não crescer sem controle

function chaveDe(usuario) {
  return `caderno:${usuario.id}`;
}

async function lerCaderno(sb, usuario) {
  const { data } = await sb.from('casa_dados').select('valor').eq('chave', chaveDe(usuario)).maybeSingle();
  const v = data?.valor || {};
  return { notas: arr(v.notas), lembretes: arr(v.lembretes), checklist: arr(v.checklist) };
}

async function gravarCaderno(sb, usuario, cad) {
  const { error } = await sb.from('casa_dados').upsert(
    { chave: chaveDe(usuario), valor: cad, atualizado_em: new Date().toISOString() },
    { onConflict: 'chave' }
  );
  if (error) throw error;
  return cad;
}

export async function GET() {
  const usuario = usuarioLogado();
  if (!usuario) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const cad = await lerCaderno(supabaseServer(), usuario);
    return NextResponse.json({ ok: true, ...cad });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao carregar.' }, { status: 500 });
  }
}

export async function POST(request) {
  const usuario = usuarioLogado();
  if (!usuario) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }
  const acao = txt(body?.acao, 24);
  try {
    const sb = supabaseServer();
    const cad = await lerCaderno(sb, usuario);
    const ok = () => NextResponse.json({ ok: true, ...cad });

    // ---- Notas ----
    if (acao === 'notaAdd') {
      const titulo = txt(body?.titulo, 80);
      const texto = txt(body?.texto, 4000);
      if (!titulo && !texto) return NextResponse.json({ ok: false, erro: 'Escreva algo na nota.' }, { status: 400 });
      cad.notas = [{ id: uid(), titulo, texto, criadoEm: Date.now(), atualizadoEm: Date.now() }, ...cad.notas].slice(0, LIM);
      await gravarCaderno(sb, usuario, cad); return ok();
    }
    if (acao === 'notaEdit') {
      const id = txt(body?.id, 40);
      const titulo = txt(body?.titulo, 80);
      const texto = txt(body?.texto, 4000);
      cad.notas = cad.notas.map((n) => n.id === id ? { ...n, titulo, texto, atualizadoEm: Date.now() } : n);
      await gravarCaderno(sb, usuario, cad); return ok();
    }
    if (acao === 'notaDel') {
      const id = txt(body?.id, 40);
      cad.notas = cad.notas.filter((n) => n.id !== id);
      await gravarCaderno(sb, usuario, cad); return ok();
    }

    // ---- Lembretes ----
    if (acao === 'lembreteAdd') {
      const texto = txt(body?.texto, 200);
      if (!texto) return NextResponse.json({ ok: false, erro: 'Escreva o lembrete.' }, { status: 400 });
      const data = /^\d{4}-\d{2}-\d{2}$/.test(body?.data) ? body.data : '';
      cad.lembretes = [{ id: uid(), texto, data, feito: false, criadoEm: Date.now() }, ...cad.lembretes].slice(0, LIM);
      await gravarCaderno(sb, usuario, cad); return ok();
    }
    if (acao === 'lembreteToggle') {
      const id = txt(body?.id, 40);
      cad.lembretes = cad.lembretes.map((l) => l.id === id ? { ...l, feito: !l.feito } : l);
      await gravarCaderno(sb, usuario, cad); return ok();
    }
    if (acao === 'lembreteDel') {
      const id = txt(body?.id, 40);
      cad.lembretes = cad.lembretes.filter((l) => l.id !== id);
      await gravarCaderno(sb, usuario, cad); return ok();
    }

    // ---- Checklist ----
    if (acao === 'checkAdd') {
      const texto = txt(body?.texto, 200);
      if (!texto) return NextResponse.json({ ok: false, erro: 'Escreva o item.' }, { status: 400 });
      cad.checklist = [{ id: uid(), texto, feito: false, criadoEm: Date.now() }, ...cad.checklist].slice(0, LIM);
      await gravarCaderno(sb, usuario, cad); return ok();
    }
    if (acao === 'checkToggle') {
      const id = txt(body?.id, 40);
      cad.checklist = cad.checklist.map((c) => c.id === id ? { ...c, feito: !c.feito } : c);
      await gravarCaderno(sb, usuario, cad); return ok();
    }
    if (acao === 'checkDel') {
      const id = txt(body?.id, 40);
      cad.checklist = cad.checklist.filter((c) => c.id !== id);
      await gravarCaderno(sb, usuario, cad); return ok();
    }
    if (acao === 'checkLimparFeitos') {
      cad.checklist = cad.checklist.filter((c) => !c.feito);
      await gravarCaderno(sb, usuario, cad); return ok();
    }

    return NextResponse.json({ ok: false, erro: 'Ação inválida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao salvar.' }, { status: 500 });
  }
}
