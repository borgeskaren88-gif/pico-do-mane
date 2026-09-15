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

// ---------------------------------------------------------------------------
// O DIAGNÓSTICO da tela do Darci.
//
// O caminho normal engole a falha de propósito (volta pro cérebro local sem
// assustar ninguém no meio do serviço). Isso é bom no dia a dia e péssimo na
// hora de ligar a coisa — então aqui vai uma ESCADA: testa um degrau de cada
// vez, do mais simples pro mais completo, e diz em qual parou.
//
// O primeiro degrau é de propósito o pedido mais pelado possível, por HTTP
// direto, sem SDK e sem nenhum ajuste meu. Assim dá pra separar "a chave está
// errada" de "esse modelo não é liberado pra essa conta" de "algum ajuste que
// eu mandei junto é que foi recusado".
const TEMPO_PASSO = 8000; // cada degrau tem tempo curto: a soma tem que caber no limite da Vercel

async function chamarCru(url, headers, corpo) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(corpo), signal: AbortSignal.timeout(TEMPO_PASSO),
    });
    const txt = (await r.text()).slice(0, 400);
    return { ok: r.ok, status: r.status, texto: txt, ms: Date.now() - t0 };
  } catch (e) {
    const nome = e?.name || '';
    return {
      ok: false, status: 0, ms: Date.now() - t0,
      texto: /Timeout|Abort/i.test(nome) ? `A IA não respondeu em ${TEMPO_PASSO / 1000}s.` : `Não consegui alcançar a IA: ${String(e?.message || e).slice(0, 200)}`,
    };
  }
}

const claudeCru = (corpo) => chamarCru('https://api.anthropic.com/v1/messages', {
  'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01',
}, corpo);
const openaiCru = (corpo) => chamarCru('https://api.openai.com/v1/chat/completions', {
  Authorization: `Bearer ${process.env.OPENAI_API_KEY || ''}`,
}, corpo);

// Erro que veio do corpo da resposta (não de uma exceção do SDK).
function explicarHTTP(status, texto) {
  const t = String(texto || '');
  if (status === 401 || /authentication_error|invalid x-api-key|Incorrect API key/i.test(t)) {
    return 'A chave foi recusada. Confere se colou ela inteira, sem espaço sobrando, e se é a chave da API (do console) — não a senha da conta.';
  }
  if (status === 404 || /model.*(not_found|does not exist|not found)|not_found_error/i.test(t)) {
    return 'Essa conta não tem acesso a esse modelo. O conserto é trocar o modelo numa variável na Vercel — eu te passo qual.';
  }
  if (/credit balance|insufficient|billing|quota/i.test(t)) {
    return 'A conta da IA está sem crédito disponível. Entra no console dela, em Billing, e confere o saldo.';
  }
  if (status === 429) return 'Bateu no limite de uso da IA agora. Espera um pouco e tenta de novo.';
  if (status >= 500) return 'A IA está fora do ar neste momento. Não é coisa tua.';
  if (status === 400) return 'A IA recusou o formato do pedido. Isso é coisa minha pra consertar — me manda o detalhe técnico.';
  if (status === 0) return t;
  return `A IA respondeu com erro ${status}.`;
}

async function testar(motor) {
  const passos = [];
  const chave = (motor === 'claude' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY) || '';
  const modelo = motor === 'claude' ? MODELO_CLAUDE : MODELO_OPENAI;

  // Degrau 1: a cara da chave. Sem mostrar a chave — só o formato dela.
  const temEspaco = /\s/.test(chave);
  const prefixoOk = motor === 'claude' ? chave.startsWith('sk-ant-') : chave.startsWith('sk-');
  passos.push({
    nome: 'A chave',
    ok: prefixoOk && !temEspaco && chave.length > 20,
    detalhe: `${chave.length} caracteres, começa com "${chave.slice(0, 7)}…"${temEspaco ? ' — TEM ESPAÇO OU QUEBRA DE LINHA SOBRANDO' : ''}${prefixoOk ? '' : ' — não parece uma chave de API'}`,
  });

  // Degrau 2: o pedido mais simples que existe, com o modelo configurado.
  const simples = motor === 'claude'
    ? await claudeCru({ model: modelo, max_tokens: 16, messages: [{ role: 'user', content: 'oi' }] })
    : await openaiCru({ model: modelo, max_tokens: 16, messages: [{ role: 'user', content: 'oi' }] });
  passos.push({
    nome: `Falar com o modelo ${modelo}`,
    ok: simples.ok,
    detalhe: simples.ok ? `respondeu em ${simples.ms}ms` : explicarHTTP(simples.status, simples.texto),
    cru: simples.ok ? '' : `HTTP ${simples.status} · ${simples.texto}`,
  });

  // Degrau 2b: falhou por causa do MODELO? Então prova que a chave presta,
  // usando um modelo que toda conta tem. Assim a gente sabe o que trocar.
  let sugestao = '';
  if (!simples.ok && motor === 'claude' && (simples.status === 404 || /model/i.test(simples.texto))) {
    const alt = 'claude-sonnet-5';
    const r = await claudeCru({ model: alt, max_tokens: 16, messages: [{ role: 'user', content: 'oi' }] });
    passos.push({
      nome: `Tentar com ${alt}`,
      ok: r.ok,
      detalhe: r.ok ? 'esse funciona! É só trocar o modelo.' : explicarHTTP(r.status, r.texto),
      cru: r.ok ? '' : `HTTP ${r.status} · ${r.texto}`,
    });
    if (r.ok) sugestao = `Põe na Vercel a variável DARCI_MODELO com o valor ${alt} e publica de novo.`;
  }

  // Degrau 3: o pedido do jeito que o Darci faz de verdade (com os ajustes).
  if (simples.ok) {
    const completo = motor === 'claude'
      ? await claudeCru({ model: modelo, max_tokens: 1000, output_config: { effort: 'low' }, system: 'Responde só: ok', messages: [{ role: 'user', content: 'oi' }] })
      : await openaiCru({ model: modelo, max_tokens: 100, temperature: 0.3, messages: [{ role: 'system', content: 'Responde só: ok' }, { role: 'user', content: 'oi' }] });
    passos.push({
      nome: 'Do jeito que o Darci pergunta',
      ok: completo.ok,
      detalhe: completo.ok ? `respondeu em ${completo.ms}ms` : explicarHTTP(completo.status, completo.texto),
      cru: completo.ok ? '' : `HTTP ${completo.status} · ${completo.texto}`,
    });
    if (!completo.ok) sugestao = 'A chave e o modelo estão bons — o problema é um ajuste que eu mando junto. Me manda o detalhe técnico que eu corrijo.';
  }

  const tudoOk = passos.every((p) => p.ok);
  const primeiroRuim = passos.find((p) => !p.ok);
  return {
    ok: tudoOk, motor, modelo, passos, sugestao,
    erro: tudoOk ? '' : (primeiroRuim?.detalhe || 'Alguma coisa falhou.'),
    cru: tudoOk ? '' : (primeiroRuim?.cru || ''),
  };
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
  if (body?.acao === 'teste') return NextResponse.json(await testar(motor));
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
