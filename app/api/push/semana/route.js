import { NextResponse } from 'next/server';
import { bancoDo } from '../../../../lib/banco';
import { lerNegocios } from '../../../../lib/negocios';
import { enviarPush } from '../../../../lib/push';
import { darciLiberado } from '../../../../lib/darciLiberado';
import { semanaDoRelatorio } from '../../../../lib/relatorioSemana';
import { gerar, CHAVE, fraseDaNotificacao } from '../../../../lib/relatorioSemanaIA';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// SEGUNDA, 8H DA MANHÃ: O RELATÓRIO DA SEMANA NO CELULAR.
//
// "Ele consegue me mandar toda segunda-feira uma notificação com esse
// relatório? Às 8h da manhã."
//
// O despertador da Vercel (vercel.json, "0 11 * * 1" = 8h em Brasília) bate
// aqui. Pra cada bar que tem o Darci (só o da casa), ele monta o relatório da
// semana que acabou — já guardado, então tocar na notificação abre na hora,
// sem esperar a IA — e manda a notificação pra dona com a frase da semana.
//
// Uma vez por semana, no máximo: se bater de novo (a Vercel às vezes repete),
// não manda outra.

function autorizado(request) {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  if (ua.includes('vercel-cron')) return true;
  const secret = process.env.CRON_SECRET;
  if (secret) return request.headers.get('authorization') === `Bearer ${secret}`;
  return true;
}

async function negociosComDarci() {
  const todos = await lerNegocios();
  const ativos = Object.keys(todos).filter((c) => todos[c]?.ativo !== false);
  const lista = ativos.length ? ativos : [String(process.env.NEGOCIO_UNICO || '').trim().toLowerCase()].filter(Boolean);
  return lista.filter((c) => darciLiberado(c));
}

async function umNegocio(sb) {
  const { ini } = semanaDoRelatorio('passada');
  const marca = `relatorioSemanaAvisado:${ini}`;
  const { data: ja } = await sb.from('pdm_dados').select('valor').eq('chave', marca).maybeSingle();
  if (ja && ja.valor) return { ok: true, enviado: false, motivo: 'já avisado nesta semana' };
  // O relatório já pronto (com a análise) vale; senão gera agora.
  const { data: g } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE + ini).maybeSingle();
  const rel = (g && g.valor && g.valor.motor) ? g.valor : await gerar(sb, 'passada');
  const frase = fraseDaNotificacao(rel);
  const r = await enviarPush(sb, {
    titulo: '📊 Relatório da semana',
    corpo: `${frase} Toca pra ver o que fazer esta semana.`,
    url: '/?tela=relatorio',
    tag: 'relatorio-semana',
    audiencia: 'dona',
  });
  await sb.from('pdm_dados').upsert({ chave: marca, valor: { em: new Date().toISOString(), enviados: r.enviados || 0 }, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
  return { ok: true, enviado: true, frase, ...r };
}

export async function GET(request) {
  if (!autorizado(request)) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  const resultados = [];
  for (const codigo of await negociosComDarci()) {
    try { resultados.push({ negocio: codigo, ...(await umNegocio(bancoDo(codigo))) }); }
    catch (e) { resultados.push({ negocio: codigo, ok: false, erro: e?.message || 'falhou' }); }
  }
  return NextResponse.json({ ok: true, negocios: resultados });
}
