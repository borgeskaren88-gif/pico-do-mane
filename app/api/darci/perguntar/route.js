import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { nomeCookie, papelDaSessao } from '../../../../lib/auth';
import { supabaseServer } from '../../../../lib/supabase';
import { fichaDoBar, INSTRUCOES } from '../../../../lib/ficha';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30; // a IA pensa alguns segundos; o padrão curto demais cortaria

// O Darci entendendo qualquer jeito de perguntar.
//
// Antes ele respondia por palavra-chave: acertava "quanto tenho a receber" e
// não entendia "o pessoal tá me devendo muito?". Aqui a pergunta vai pra uma IA
// JUNTO COM A FICHA DO BAR — os números reais, montados no servidor a partir do
// mesmo banco que as telas usam. A IA entende e escreve; os números continuam
// sendo os do PicoOS, porque é tudo que ela recebe.
//
// A chave fica só na Vercel (variável de ambiente), nunca no navegador. Sem
// chave, isto responde `semChave` e a tela volta sozinha pro jeito antigo, que
// funciona igual — de graça e na hora.
const MODELO_CLAUDE = process.env.DARCI_MODELO || 'claude-opus-5';
const MODELO_OPENAI = process.env.DARCI_MODELO_OPENAI || 'gpt-4o-mini';

const motorDisponivel = () => {
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return '';
};

// O ajuste "Leve / Manezinho / Carregado" da tela dele continua valendo: em vez
// de mexer no texto depois de pronto, avisa a IA antes de ela escrever.
const JEITO = {
  leve: 'Nesta conversa, fala português certinho, sem gíria e sem sotaque.',
  manezinho: '',
  carregado: 'Nesta conversa, carrega mais no jeito manezinho da ilha, à vontade.',
};

// O que ela já falou antes, pra ele não perder o fio ("e no mês passado?").
// Só as últimas trocas, e cortadas: conversa longa é cara e não ajuda.
const historico = (v) => (Array.isArray(v) ? v : [])
  .filter((m) => m && (m.de === 'karen' || m.de === 'darci') && String(m.texto || '').trim())
  .slice(-6)
  .map((m) => ({ role: m.de === 'karen' ? 'user' : 'assistant', content: String(m.texto).slice(0, 1200) }));

async function lerTudo(sb) {
  const [painel, vendas, reservas] = await Promise.all([
    sb.from('pdm_dados').select('valor').eq('chave', 'painel').maybeSingle(),
    sb.from('pdm_dados').select('valor').like('chave', 'venda:%'),
    sb.from('pdm_dados').select('valor').like('chave', 'reserva:%'),
  ]);
  return {
    dados: painel?.data?.valor || {},
    vendas: (vendas?.data || []).map((r) => r.valor).filter(Boolean),
    reservas: (reservas?.data || []).map((r) => r.valor).filter(Boolean),
  };
}

const sistema = (ficha, jeito) => `${INSTRUCOES}${jeito ? '\n- ' + jeito : ''}\n\n===== FICHA DO BAR =====\n${ficha}\n===== FIM DA FICHA =====`;

async function perguntarClaude(ficha, jeito, antes, pergunta) {
  const client = new Anthropic({ timeout: 25000, maxRetries: 1 });
  const r = await client.messages.create({
    model: MODELO_CLAUDE,
    max_tokens: 4000,
    // Pergunta de bar, resposta curta: esforço baixo responde bem e sai barato.
    output_config: { effort: 'low' },
    system: sistema(ficha, jeito),
    messages: [...antes, { role: 'user', content: pergunta }],
  });
  if (r.stop_reason === 'refusal') return '';
  return r.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

async function perguntarOpenAI(ficha, jeito, antes, pergunta) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELO_OPENAI,
      max_tokens: 700,
      temperature: 0.3,
      messages: [
        { role: 'system', content: sistema(ficha, jeito) },
        ...antes, { role: 'user', content: pergunta },
      ],
    }),
  });
  if (!r.ok) throw new Error('OpenAI respondeu ' + r.status);
  const j = await r.json();
  return String(j?.choices?.[0]?.message?.content || '').trim();
}

export async function POST(request) {
  if (papelDaSessao(cookies().get(nomeCookie())?.value) !== 'dona') {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }
  const motor = motorDisponivel();
  // Sem chave não é erro: é o estado normal de quem ainda não ligou a IA.
  if (!motor) return NextResponse.json({ ok: false, semChave: true });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }
  const pergunta = String(body?.pergunta || '').trim().slice(0, 500);
  if (!pergunta) return NextResponse.json({ ok: false, erro: 'Pergunta vazia.' }, { status: 400 });

  try {
    const sb = supabaseServer();
    const { dados, vendas, reservas } = await lerTudo(sb);
    const ficha = fichaDoBar(dados, vendas, reservas);
    const antes = historico(body?.antes);
    const jeito = JEITO[String(body?.sotaque || 'manezinho')] || '';
    const resposta = motor === 'claude'
      ? await perguntarClaude(ficha, jeito, antes, pergunta)
      : await perguntarOpenAI(ficha, jeito, antes, pergunta);
    // Resposta vazia (recusa, corte) conta como falha: a tela usa o jeito antigo.
    if (!resposta) return NextResponse.json({ ok: false, erro: 'Resposta vazia.' }, { status: 502 });
    return NextResponse.json({ ok: true, resposta, motor });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao perguntar.' }, { status: 502 });
  }
}
