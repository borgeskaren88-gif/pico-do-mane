import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, usuarioDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';
import { CORES_HABITO } from '../../../lib/util';

// Escolhe uma cor válida: usa a pedida se estiver na paleta; senão, a primeira
// cor ainda não usada pela pessoa (pra hábitos saírem com cores diferentes).
function corHabito(pedida, habitos, usuarioNome) {
  if (CORES_HABITO.includes(pedida)) return pedida;
  const usadas = habitos.filter((h) => h.usuario === usuarioNome).map((h) => h.cor);
  return CORES_HABITO.find((c) => !usadas.includes(c)) || CORES_HABITO[habitos.length % CORES_HABITO.length];
}

export const dynamic = 'force-dynamic';

const CHAVE = 'casa';

function usuarioLogado() {
  return usuarioDaSessao(cookies().get(nomeCookie())?.value);
}

const txt = (v, max) => String(v == null ? '' : v).slice(0, max).trim();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const arr = (v) => (Array.isArray(v) ? v : []);

async function lerCasa(sb) {
  const { data } = await sb.from('casa_dados').select('valor').eq('chave', CHAVE).maybeSingle();
  const v = data?.valor || {};
  return { habitos: arr(v.habitos), checkins: (v.checkins && typeof v.checkins === 'object') ? v.checkins : {}, lista: arr(v.lista) };
}

async function gravarCasa(sb, casa) {
  const { error } = await sb.from('casa_dados').upsert(
    { chave: CHAVE, valor: casa, atualizado_em: new Date().toISOString() },
    { onConflict: 'chave' }
  );
  if (error) throw error;
  return casa;
}

export async function GET() {
  if (!usuarioLogado()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const casa = await lerCasa(supabaseServer());
    return NextResponse.json({ ok: true, ...casa });
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
    const casa = await lerCasa(sb); // read-modify-write, pra os dois não se sobrescreverem

    // ---- Hábitos (cada um cria/edita os seus; os dois veem tudo) ----
    if (acao === 'habitoAdd') {
      const nome = txt(body?.nome, 60);
      if (!nome) return NextResponse.json({ ok: false, erro: 'Dê um nome ao hábito.' }, { status: 400 });
      const cor = corHabito(txt(body?.cor, 9), casa.habitos, usuario.nome);
      casa.habitos = [{ id: uid(), usuario: usuario.nome, nome, cor, criadoEm: Date.now() }, ...casa.habitos];
      await gravarCasa(sb, casa);
      return NextResponse.json({ ok: true, ...casa });
    }
    if (acao === 'habitoCor') {
      const id = txt(body?.id, 40);
      const cor = txt(body?.cor, 9);
      if (!CORES_HABITO.includes(cor)) return NextResponse.json({ ok: false, erro: 'Cor inválida.' }, { status: 400 });
      const h = casa.habitos.find((x) => x.id === id);
      if (!h) return NextResponse.json({ ok: false, erro: 'Hábito não encontrado.' }, { status: 404 });
      if (h.usuario !== usuario.nome) return NextResponse.json({ ok: false, erro: 'Só quem criou pode mudar a cor.' }, { status: 403 });
      casa.habitos = casa.habitos.map((x) => x.id === id ? { ...x, cor } : x);
      await gravarCasa(sb, casa);
      return NextResponse.json({ ok: true, ...casa });
    }
    if (acao === 'habitoDel') {
      const id = txt(body?.id, 40);
      const h = casa.habitos.find((x) => x.id === id);
      if (h && h.usuario !== usuario.nome) return NextResponse.json({ ok: false, erro: 'Só quem criou pode apagar o hábito.' }, { status: 403 });
      casa.habitos = casa.habitos.filter((x) => x.id !== id);
      // Limpa os check-ins desse hábito.
      for (const k of Object.keys(casa.checkins)) if (k.startsWith(id + '|')) delete casa.checkins[k];
      await gravarCasa(sb, casa);
      return NextResponse.json({ ok: true, ...casa });
    }
    if (acao === 'checkin') {
      const id = txt(body?.habitoId, 40);
      const dia = txt(body?.data, 10);
      const h = casa.habitos.find((x) => x.id === id);
      if (!h) return NextResponse.json({ ok: false, erro: 'Hábito não encontrado.' }, { status: 404 });
      if (h.usuario !== usuario.nome) return NextResponse.json({ ok: false, erro: 'Você só marca os seus hábitos.' }, { status: 403 });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return NextResponse.json({ ok: false, erro: 'Data inválida.' }, { status: 400 });
      const chave = `${id}|${dia}`;
      if (body?.feito) casa.checkins[chave] = true; else delete casa.checkins[chave];
      await gravarCasa(sb, casa);
      return NextResponse.json({ ok: true, ...casa });
    }

    // ---- Lista de compras (compartilhada: os dois mexem) ----
    if (acao === 'listaAdd') {
      const nome = txt(body?.nome, 80);
      if (!nome) return NextResponse.json({ ok: false, erro: 'Escreva o item.' }, { status: 400 });
      casa.lista = [{ id: uid(), nome, quantidade: txt(body?.quantidade, 40), comprado: false, criadoPor: usuario.nome, criadoEm: Date.now() }, ...casa.lista];
      await gravarCasa(sb, casa);
      return NextResponse.json({ ok: true, ...casa });
    }
    if (acao === 'listaToggle') {
      const id = txt(body?.id, 40);
      casa.lista = casa.lista.map((it) => it.id === id ? { ...it, comprado: !it.comprado } : it);
      await gravarCasa(sb, casa);
      return NextResponse.json({ ok: true, ...casa });
    }
    if (acao === 'listaDel') {
      const id = txt(body?.id, 40);
      casa.lista = casa.lista.filter((it) => it.id !== id);
      await gravarCasa(sb, casa);
      return NextResponse.json({ ok: true, ...casa });
    }
    if (acao === 'listaLimparComprados') {
      casa.lista = casa.lista.filter((it) => !it.comprado);
      await gravarCasa(sb, casa);
      return NextResponse.json({ ok: true, ...casa });
    }

    return NextResponse.json({ ok: false, erro: 'Ação inválida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao salvar.' }, { status: 500 });
  }
}
