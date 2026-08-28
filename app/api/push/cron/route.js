import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { montarResumoDiario, enviarPush, jaMandouResumoHoje, marcarResumoEnviado } from '../../../../lib/push';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Disparado pela Vercel (cron) uma vez por dia — ver vercel.json. Manda o resumo
// diário no celular. Protegido: só o cron da Vercel chega aqui (ou um teste com
// o segredo), e há trava de 1x por dia mesmo que bata mais de uma vez.
function autorizado(request) {
  const ua = request.headers.get('user-agent') || '';
  if (ua.toLowerCase().includes('vercel-cron')) return true;
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') === `Bearer ${secret}`) return true;
  return false;
}

export async function GET(request) {
  if (!autorizado(request)) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    if (await jaMandouResumoHoje(sb)) return NextResponse.json({ ok: true, enviado: false, motivo: 'já enviado hoje' });
    const resumo = await montarResumoDiario(sb);
    if (!resumo) { await marcarResumoEnviado(sb); return NextResponse.json({ ok: true, enviado: false, motivo: 'nada a avisar' }); }
    const r = await enviarPush(sb, { ...resumo, tag: 'resumo-diario', audiencia: 'dona' });
    await marcarResumoEnviado(sb);
    return NextResponse.json({ ok: true, enviado: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro no resumo diário.' }, { status: 500 });
  }
}
