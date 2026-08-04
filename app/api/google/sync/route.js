import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, sessaoEhValida } from '../../../../lib/auth';
import { sincronizar } from '../../../../lib/google';
import { supabaseServer } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST() {
  const valor = cookies().get(nomeCookie())?.value;
  if (!sessaoEhValida(valor)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const sb = supabaseServer();
    const { data } = await sb.from('pdm_dados').select('valor').eq('chave', 'painel').maybeSingle();
    const resumo = await sincronizar(data?.valor || {});
    return NextResponse.json({ ok: true, ...resumo });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao sincronizar.' }, { status: 500 });
  }
}
