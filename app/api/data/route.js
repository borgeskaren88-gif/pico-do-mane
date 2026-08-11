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
    // Preserva a lista e as tarefas da cozinha se não vierem no corpo: elas são
    // gravadas pelo acesso da cozinha (/api/lista) e não podem ser apagadas por
    // um salvamento da dona que não as incluiu.
    const { data: atual } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE).maybeSingle();
    const anterior = atual?.valor || {};
    const valor = { ...dados };
    if (!('listaCozinha' in valor) && Array.isArray(anterior.listaCozinha)) valor.listaCozinha = anterior.listaCozinha;
    if (!('tarefasCozinha' in valor) && Array.isArray(anterior.tarefasCozinha)) valor.tarefasCozinha = anterior.tarefasCozinha;
    if (!('cardapio' in valor) && Array.isArray(anterior.cardapio)) valor.cardapio = anterior.cardapio;
    const { error } = await sb
      .from('pdm_dados')
      .upsert(
        { chave: CHAVE, valor, atualizado_em: new Date().toISOString() },
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
