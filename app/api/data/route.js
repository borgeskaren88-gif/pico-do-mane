import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, sessaoEhValida } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

const CHAVE = 'painel';

function autorizado() {
  const valor = cookies().get(nomeCookie())?.value;
  return sessaoEhValida(valor);
}

export async function GET() {
  if (!autorizado()) {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }
  try {
    const sb = supabaseServer();
    const { data, error } = await sb
      .from('pdm_dados')
      .select('valor')
      .eq('chave', CHAVE)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ ok: true, dados: data?.valor ?? null });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e?.message || 'Erro ao carregar dados.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  if (!autorizado()) {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }
  let dados;
  try {
    dados = await request.json();
  } catch {
    return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 });
  }
  try {
    const sb = supabaseServer();
    const { error } = await sb
      .from('pdm_dados')
      .upsert(
        { chave: CHAVE, valor: dados, atualizado_em: new Date().toISOString() },
        { onConflict: 'chave' }
      );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e?.message || 'Erro ao salvar dados.' },
      { status: 500 }
    );
  }
}
