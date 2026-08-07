import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

const CHAVE = 'painel';

// Acesso liberado para dona e cozinha. Este endpoint só permite DUAS ações no
// controle de garrafas — abrir e encerrar — e carimba quem fez ('cozinha' ou
// 'dona'). Nunca edita nem apaga garrafas, pra cozinha não bagunçar o histórico.
function papel() {
  return papelDaSessao(cookies().get(nomeCookie())?.value);
}

// Data de hoje no fuso do Brasil (senão à noite o UTC vira o dia seguinte).
const hojeISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const txt = (v, max) => String(v == null ? '' : v).slice(0, max).trim();
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export async function GET() {
  if (!papel()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    const { data, error } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE).maybeSingle();
    if (error) throw error;
    const blob = data?.valor || {};
    const todas = Array.isArray(blob.garrafas) ? blob.garrafas : [];
    const abertas = todas.filter((g) => g.dataAbertura && !g.dataTermino);
    const encerradas = todas.filter((g) => g.dataTermino).sort((a, b) => (b.dataTermino || '').localeCompare(a.dataTermino || '')).slice(0, 20);
    return NextResponse.json({ ok: true, garrafas: [...abertas, ...encerradas] });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao carregar as garrafas.' }, { status: 500 });
  }
}

export async function POST(request) {
  const quem = papel();
  if (!quem) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 });
  }
  try {
    const sb = supabaseServer();
    const { data, error } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE).maybeSingle();
    if (error) throw error;
    const blob = data?.valor || {};
    const garrafas = Array.isArray(blob.garrafas) ? blob.garrafas.slice() : [];

    if (body?.acao === 'abrir') {
      const produto = txt(body.produto, 120);
      if (!produto) return NextResponse.json({ ok: false, erro: 'Informe o produto.' }, { status: 400 });
      garrafas.unshift({
        id: novoId(), produto,
        volume: txt(body.volume, 10) || '1000', dose: txt(body.dose, 10) || '50',
        dataAbertura: hojeISO(), dataTermino: '', drinks: '', obs: '', criadoPor: quem,
      });
    } else if (body?.acao === 'encerrar') {
      const id = txt(body.id, 40);
      let achou = false;
      for (let i = 0; i < garrafas.length; i++) {
        if (garrafas[i].id === id && garrafas[i].dataAbertura && !garrafas[i].dataTermino) {
          garrafas[i] = { ...garrafas[i], dataTermino: hojeISO(), encerradoPor: quem };
          achou = true;
          break;
        }
      }
      if (!achou) return NextResponse.json({ ok: false, erro: 'Garrafa não encontrada.' }, { status: 404 });
    } else {
      return NextResponse.json({ ok: false, erro: 'Ação inválida.' }, { status: 400 });
    }

    const { error: err2 } = await sb.from('pdm_dados').upsert(
      { chave: CHAVE, valor: { ...blob, garrafas }, atualizado_em: new Date().toISOString() },
      { onConflict: 'chave' }
    );
    if (err2) throw err2;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao salvar a garrafa.' }, { status: 500 });
  }
}
