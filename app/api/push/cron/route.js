import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { montarResumoDiario, enviarPush, jaMandouResumoHoje, marcarResumoEnviado } from '../../../../lib/push';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Disparado pela Vercel (cron) uma vez por dia — ver vercel.json. Manda o resumo
// diário no celular. Segurança: se houver um CRON_SECRET configurado, exige ele
// (ou o cabeçalho do cron da Vercel). Se NÃO houver segredo (caso normal, sem
// configuração), libera — a trava de 1x por dia já impede qualquer abuso, e o
// pior que alguém consegue é disparar o próprio resumo da dona uma vez. Assim o
// despertador funciona sem a dona precisar mexer em variável de ambiente.
function autorizado(request) {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  if (ua.includes('vercel-cron')) return true;
  const secret = process.env.CRON_SECRET;
  if (secret) return request.headers.get('authorization') === `Bearer ${secret}`;
  return true;
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
