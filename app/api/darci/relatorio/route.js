import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../../lib/auth';
import { bancoDaSessao } from '../../../../lib/negocioAtual';
import { semanaDoRelatorio } from '../../../../lib/relatorioSemana';
import { gerar, motorDisponivel, CHAVE } from '../../../../lib/relatorioSemanaIA';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Analisar a semana inteira leva mais tempo que responder uma pergunta.
export const maxDuration = 60;

// O RELATÓRIO DA SEMANA DO DARCI — o app conta, a IA analisa como um CEO.
//
// O relatório pronto fica GUARDADO (uma linha por semana). Abrir de novo não
// gasta IA de novo: a semana passada não muda. A semana em andamento pode ser
// refeita quando ela quiser ("Gerar de novo").
//
// Só a dona: é o dinheiro do bar inteiro.

const soDona = () => papelDaSessao(cookies().get(nomeCookie())?.value) === 'dona';

export async function GET(request) {
  if (!soDona()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  const semana = new URL(request.url).searchParams.get('semana') === 'atual' ? 'atual' : 'passada';
  try {
    const sb = bancoDaSessao();
    const { ini, vazia } = semanaDoRelatorio(semana);
    if (vazia) return NextResponse.json({ ok: true, vazia: true });
    const { data } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE + ini).maybeSingle();
    const guardado = data && data.valor;
    // Semana fechada guardada: vale. Guardada SEM IA e agora com IA ligada:
    // refaz, senão ela ficaria presa no resumo automático pra sempre.
    if (guardado && (guardado.motor || !motorDisponivel())) return NextResponse.json({ ok: true, ...guardado, guardado: true });
    return NextResponse.json({ ok: true, ...(await gerar(sb, semana)) });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Não consegui montar o relatório.' }, { status: 500 });
  }
}

// "Gerar de novo": refaz e guarda por cima.
export async function POST(request) {
  if (!soDona()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  let b = {};
  try { b = await request.json(); } catch { /* sem corpo */ }
  const semana = b.semana === 'atual' ? 'atual' : 'passada';
  try {
    const r = await gerar(bancoDaSessao(), semana);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Não consegui montar o relatório.' }, { status: 500 });
  }
}
