import { NextResponse } from 'next/server';
import { bancoDo } from '../../../../lib/banco';
import { lerNegocios } from '../../../../lib/negocios';
import { montarResumoDiario, enviarPush, jaMandouResumoHoje, marcarResumoEnviado, notificarAgenda, notificarReservasAmanha, notificarPreparoAmanha, notificarValidade } from '../../../../lib/push';

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

// O DESPERTADOR NÃO TEM NINGUÉM LOGADO.
//
// Ele bate sozinho, de madrugada, e não tem crachá que diga de quem é. No app
// de muitos negócios ele tem que passar por TODOS — e um por um, isolado: se o
// resumo de um cliente der erro, os outros ainda recebem o deles. Negócio
// suspenso fica de fora (não paga, não recebe aviso).
//
// Na instalação de um cliente só, a lista de negócios está vazia e a volta é
// uma só, com o NEGOCIO_UNICO — igual a antes.
async function paraCadaNegocio() {
  const todos = await lerNegocios();
  const ativos = Object.keys(todos).filter((c) => todos[c]?.ativo !== false);
  if (ativos.length) return ativos;
  const unico = String(process.env.NEGOCIO_UNICO || '').trim().toLowerCase();
  return unico ? [unico] : [];
}

export async function GET(request) {
  if (!autorizado(request)) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  const negocios = await paraCadaNegocio();
  if (!negocios.length) return NextResponse.json({ ok: false, erro: 'Nenhum negócio configurado.' }, { status: 500 });
  const resultados = [];
  for (const codigo of negocios) {
    resultados.push({ negocio: codigo, ...(await umNegocio(bancoDo(codigo))) });
  }
  return NextResponse.json({ ok: true, negocios: resultados });
}

async function umNegocio(sb) {
  try {
    // Aproveita a batida do cron pra conferir a agenda também (não custa nada e
    // cobre o caso de ninguém ter o app aberto na hora).
    try { await notificarAgenda(sb); } catch { /* agenda nunca quebra o resumo */ }
    // E lembra a Mari de confirmar as mesas de amanhã.
    try { await notificarReservasAmanha(sb); } catch { /* idem */ }
    // E avisa a Karen das mesas de amanhã que pedem preparo (aniversário, bolo, alergia).
    try { await notificarPreparoAmanha(sb); } catch { /* idem */ }
    try { await notificarValidade(sb); } catch { /* idem */ }
    if (await jaMandouResumoHoje(sb)) return { ok: true, enviado: false, motivo: 'já enviado hoje' };
    const resumo = await montarResumoDiario(sb);
    if (!resumo) { await marcarResumoEnviado(sb); return { ok: true, enviado: false, motivo: 'nada a avisar' }; }
    const r = await enviarPush(sb, { ...resumo, tag: 'resumo-diario', audiencia: 'dona' });
    await marcarResumoEnviado(sb);
    return { ok: true, enviado: true, ...r };
  } catch (e) {
    // O erro de um cliente não pode calar o aviso dos outros.
    return { ok: false, erro: e?.message || 'Erro no resumo diário.' };
  }
}
