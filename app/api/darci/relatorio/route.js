import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { nomeCookie, papelDaSessao } from '../../../../lib/auth';
import { bancoDaSessao } from '../../../../lib/negocioAtual';
import { lerNegocio } from '../../../../lib/negocio';
import { diaOperacional } from '../../../../lib/util';
import { semanaDoRelatorio, montarRelatorio, relatorioEmTexto, instrucoesCEO, relatorioSemIA } from '../../../../lib/relatorioSemana';

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

const MODELO_CLAUDE = process.env.DARCI_MODELO || 'claude-opus-5';
const MODELO_OPENAI = process.env.DARCI_MODELO_OPENAI || 'gpt-4o-mini';
const motorDisponivel = () => (process.env.ANTHROPIC_API_KEY ? 'claude' : process.env.OPENAI_API_KEY ? 'openai' : '');
const CHAVE = 'relatorioSemana:';

async function lerDados(sb) {
  const pegar = (prefixo) => sb.from('pdm_dados').select('valor').like('chave', prefixo + '%');
  const [painel, vendas, caixas, ponto, reservas] = await Promise.all([
    sb.from('pdm_dados').select('valor').eq('chave', 'painel').maybeSingle(),
    pegar('venda:'), pegar('caixa:'), pegar('ponto:'), pegar('reserva:'),
  ]);
  const lista = (r) => (r?.data || []).map((x) => x.valor).filter(Boolean);
  return { dados: painel?.data?.valor || {}, vendas: lista(vendas), caixas: lista(caixas), registros: lista(ponto), reservas: lista(reservas) };
}

async function analisarClaude(sistema, ficha) {
  const client = new Anthropic({ timeout: 55000, maxRetries: 0 });
  const r = await client.messages.create({
    model: MODELO_CLAUDE,
    max_tokens: 6000,
    // Aqui vale pensar mais: é análise, não resposta rápida.
    output_config: { effort: 'medium' },
    system: sistema,
    messages: [{ role: 'user', content: `===== FICHA DA SEMANA =====\n${ficha}\n===== FIM DA FICHA =====\n\nEscreve o relatório da semana.` }],
  });
  if (r.stop_reason === 'refusal') return '';
  return r.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

async function analisarOpenAI(sistema, ficha) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELO_OPENAI, max_tokens: 1800, temperature: 0.3,
      messages: [{ role: 'system', content: sistema }, { role: 'user', content: `===== FICHA DA SEMANA =====\n${ficha}\n===== FIM DA FICHA =====\n\nEscreve o relatório da semana.` }],
    }),
    signal: AbortSignal.timeout(55000),
  });
  if (!r.ok) throw new Error('OpenAI respondeu ' + r.status);
  const j = await r.json();
  return String(j?.choices?.[0]?.message?.content || '').trim();
}

// O que vai pro topo da tela, sem precisar ler o texto: os números grandes.
const destaques = (rel) => ({
  faturamento: rel.faturamento.total, pctAnterior: rel.faturamento.pctAnterior, pctMedia4: rel.faturamento.pctMedia4,
  ticket: rel.ticket, pctTicket: rel.pctTicket, cmvPct: rel.cmv.pct, semVender: rel.semVenderTotal,
  metaPct: rel.meta ? rel.meta.pct : null,
  dias: rel.dias.map((d) => ({ data: d.data, dia: d.dia, total: d.total, mediaIgual: d.mediaIgual })),
});

async function gerar(sb, semana) {
  const hoje = diaOperacional();
  const { ini, fim, parcial, vazia } = semanaDoRelatorio(semana, hoje);
  if (vazia) return { vazia: true, ini, fim };
  const base = await lerDados(sb);
  const neg = lerNegocio(base.dados);
  const rel = montarRelatorio({ ...base, ini, fim, hoje });
  const ficha = relatorioEmTexto(rel, { nomeBar: neg.nome, cidade: neg.cidade });
  const motor = motorDisponivel();
  let texto = '';
  let erroIA = '';
  if (motor) {
    try {
      const sistema = instrucoesCEO({ nomeBar: neg.nome || 'bar', dona: neg.dona });
      texto = motor === 'claude' ? await analisarClaude(sistema, ficha) : await analisarOpenAI(sistema, ficha);
    } catch (e) { erroIA = e?.message || 'A IA não respondeu.'; }
  }
  const comIA = !!texto;
  const pronto = {
    ini, fim, parcial, semana, geradoEm: new Date().toISOString(),
    motor: comIA ? motor : '', texto: comIA ? texto : relatorioSemIA(rel),
    numeros: destaques(rel), ficha,
    ...(erroIA ? { erroIA } : {}),
  };
  // Guarda só o que a IA escreveu (ou a semana fechada): o resumo automático
  // da semana em andamento é de graça refazer.
  if (comIA || !parcial) {
    await sb.from('pdm_dados').upsert({ chave: CHAVE + ini, valor: pronto, atualizado_em: pronto.geradoEm }, { onConflict: 'chave' });
  }
  return pronto;
}

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
