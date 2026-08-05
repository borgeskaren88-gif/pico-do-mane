import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, sessaoEhValida } from '../../../../lib/auth';
import { finalizarLogin, sincronizar } from '../../../../lib/google';
import { supabaseServer } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';

const base = () => process.env.APP_URL || 'http://localhost:3000';

export async function GET(request) {
  const valor = cookies().get(nomeCookie())?.value;
  if (!sessaoEhValida(valor)) return NextResponse.redirect(base());

  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const erro = params.get('error');
  if (erro || !code) return NextResponse.redirect(base() + '/?google=erro');

  try {
    await finalizarLogin(code);
    // Sincroniza os boletos/tarefas assim que conecta.
    try {
      const sb = supabaseServer();
      const { data } = await sb.from('pdm_dados').select('valor').eq('chave', 'painel').maybeSingle();
      await sincronizar(data?.valor || {});
    } catch { /* a sincronização pode ser refeita depois */ }
    return NextResponse.redirect(base() + '/?google=ok');
  } catch (e) {
    const motivo = encodeURIComponent(String(e?.message || '').slice(0, 180));
    return NextResponse.redirect(base() + '/?google=erro&motivo=' + motivo);
  }
}
