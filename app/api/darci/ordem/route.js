import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { nomeCookie, papelDaSessao } from '../../../../lib/auth';
import { supabaseServer } from '../../../../lib/supabase';
import { diaOperacional, addDays, weekday, limparNome, num, brl } from '../../../../lib/util';
import { CUSTO_VARIAVEL, DESPESA_OPERACIONAL, DESPESA_NAO_OPERACIONAL } from '../../../../lib/util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

// O Darci FAZENDO, não só respondendo.
//
// Ele já obedecia ordem falada ("Darci, anota que precisa pagar o gelo"), mas
// por palavra-chave: era preciso acertar o verbo. "Chegou a Ambev, 500 pila,
// vence dia 20" não virava nada. Aqui a frase vai pra IA, que devolve a ordem
// já organizada nos campos certos.
//
// DUAS COISAS QUE NÃO MUDAM:
// 1. Nada é gravado aqui. Esta rota só ENTENDE e devolve. Quem grava é a tela,
//    depois que a Karen confere e confirma — igual era antes.
// 2. Todo campo é conferido aqui no servidor antes de sair (valor é número,
//    data é data, item de estoque existe mesmo). A IA erra; a conferência não
//    deixa o erro virar lançamento.
//
// É de propósito que esta rota NÃO recebe a ficha do bar: pra entender uma
// ordem ela não precisa saber quanto entrou ontem. Só a lista de nomes que ela
// pode usar. Sai bem mais barato que uma pergunta.
const MODELO_CLAUDE = process.env.DARCI_MODELO || 'claude-opus-5';
const MODELO_OPENAI = process.env.DARCI_MODELO_OPENAI || 'gpt-4o-mini';
const motorDisponivel = () => (process.env.ANTHROPIC_API_KEY ? 'claude' : process.env.OPENAI_API_KEY ? 'openai' : '');

const CATEGORIAS = [...CUSTO_VARIAVEL, ...DESPESA_OPERACIONAL, ...DESPESA_NAO_OPERACIONAL];
const MOTIVOS = ['Desperdício', 'Vencido', 'Quebra'];
const TIPOS = ['despesa', 'receita', 'compra', 'tarefa', 'agenda', 'perda', 'nenhum'];

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tipo: { type: 'string', enum: TIPOS, description: 'O que ela mandou fazer. "nenhum" se for pergunta, conversa, ou se faltar informação essencial.' },
    valor: { type: 'number', description: 'Em reais. Para despesa, receita e compra. 0 se não houver.' },
    descricao: { type: 'string', description: 'Do que foi a despesa ou a receita. Vazio se não for esse tipo.' },
    categoria: { type: 'string', description: 'Para despesa: exatamente uma da lista de categorias. Vazio se não souber.' },
    fornecedor: { type: 'string', description: 'Para compra: de quem é a conta. Ex.: Ambev.' },
    produto: { type: 'string', description: 'Para compra: o que foi comprado.' },
    vencimento: { type: 'string', description: 'Para compra: AAAA-MM-DD. Vazio se ela não disse.' },
    texto: { type: 'string', description: 'Para tarefa: o que anotar, curto e direto.' },
    titulo: { type: 'string', description: 'Para agenda: o nome do compromisso.' },
    data: { type: 'string', description: 'Para agenda: AAAA-MM-DD.' },
    hora: { type: 'string', description: 'Para agenda: HH:MM. Vazio se for dia todo.' },
    itemId: { type: 'string', description: 'Para perda: o id exato do item, da lista de estoque.' },
    qtd: { type: 'number', description: 'Para perda: quanto se perdeu. 1 se ela não disse.' },
    motivo: { type: 'string', enum: [...MOTIVOS, ''], description: 'Para perda.' },
  },
  required: ['tipo', 'valor', 'descricao', 'categoria', 'fornecedor', 'produto', 'vencimento', 'texto', 'titulo', 'data', 'hora', 'itemId', 'qtd', 'motivo'],
};

const instrucoes = (hoje, estoque, fornecedores) => `Tu organiza ordens faladas pela Karen, dona do bar Pico do Mané, em campos de um sistema.

Hoje é ${hoje} (${weekday(hoje)}). Amanhã é ${addDays(hoje, 1)}.

Devolve SEMPRE pela ferramenta "ordem", nunca em texto.

Escolhe o tipo:
- despesa: dinheiro que já saiu. "paguei", "gastei", "comprei" à vista.
- receita: dinheiro que entrou, fora do caixa normal.
- compra: conta A PAGAR, com fornecedor e vencimento. "chegou o boleto", "vence dia 20".
- tarefa: algo pra lembrar de fazer, sem hora marcada.
- agenda: compromisso com dia (e às vezes hora) marcados.
- perda: algo do estoque que se perdeu, quebrou, venceu ou foi desperdiçado.
- nenhum: quando for PERGUNTA, conversa, ou quando faltar o essencial (uma despesa sem valor, uma agenda sem dia). Na dúvida, "nenhum" — é melhor não fazer nada do que lançar errado.

Regras:
- Datas sempre AAAA-MM-DD, calculadas a partir de hoje. "sexta" é a próxima sexta; "dia 20" é o dia 20 mais próximo que ainda não passou.
- Valores em número puro: 1500.50, nunca "R$ 1.500,50".
- Em "perda", o itemId tem que ser o id EXATO de um item da lista. Se o que ela falou não está na lista, usa tipo "nenhum".
- Em "categoria", usa exatamente uma destas: ${CATEGORIAS.join(' | ')}
- Campos que não servem pro tipo escolhido vão vazios ("" ou 0).

Itens do estoque (id — nome — unidade):
${estoque.length ? estoque.map((i) => `${i.id} — ${i.nome} — ${i.unidade}`).join('\n') : '(estoque vazio)'}

Fornecedores já usados: ${fornecedores.join(', ') || '(nenhum)'}`;

async function catalogo(sb) {
  const { data } = await sb.from('pdm_dados').select('valor').eq('chave', 'painel').maybeSingle();
  const d = data?.valor || {};
  const estoque = (Array.isArray(d.estoque) ? d.estoque : []).slice(0, 80)
    .map((i) => ({ id: String(i.id || ''), nome: limparNome(i.nome), unidade: i.unidade || 'un' }))
    .filter((i) => i.id && i.nome);
  const fornecedores = [...new Set((Array.isArray(d.compras) ? d.compras : [])
    .map((c) => limparNome(c && c.fornecedor)).filter(Boolean))].slice(0, 25);
  return { estoque, fornecedores, despesas: Array.isArray(d.despesas) ? d.despesas : [] };
}

// Confere tudo o que a IA devolveu e monta o pedido do jeito que a tela espera.
// Se alguma coisa não bater, devolve null: melhor "não entendi" do que um
// lançamento torto no dinheiro dela.
function conferir(bruto, { estoque, despesas }, hoje) {
  const o = bruto || {};
  const tipo = TIPOS.includes(o.tipo) ? o.tipo : 'nenhum';
  if (tipo === 'nenhum') return null;
  const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const valor = Math.round(Number(o.valor || 0) * 100) / 100;
  const txt = (v, n) => limparNome(String(v || '')).slice(0, n);
  const ddmm = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

  if (tipo === 'despesa' || tipo === 'receita') {
    if (!(valor > 0)) return null;
    const descricao = txt(o.descricao, 120);
    const ehDesp = tipo === 'despesa';
    let categoria = CATEGORIAS.includes(o.categoria) ? o.categoria : '';
    // Sem categoria: repete a da última despesa parecida, como o jeito antigo fazia.
    if (ehDesp && !categoria) {
      const parecida = despesas.find((x) => x && x.descricao && descricao && String(x.descricao).toLowerCase().includes(descricao.toLowerCase().slice(0, 6)));
      categoria = (parecida && parecida.categoria) || 'A classificar';
    }
    return {
      tipo: ehDesp ? 'despesa' : 'receita',
      titulo: ehDesp ? 'Lançar despesa' : 'Lançar entrada',
      resumo: `${ehDesp ? 'Lançar despesa' : 'Lançar entrada'} de ${brl(valor)}${descricao ? ` — ${descricao}` : ''}${ehDesp ? ` (${categoria})` : ''}, hoje.`,
      dados: ehDesp ? { valor, descricao, categoria } : { valor, descricao },
    };
  }

  if (tipo === 'compra') {
    if (!(valor > 0)) return null;
    const fornecedor = txt(o.fornecedor, 80);
    const produto = txt(o.produto, 80) || fornecedor;
    if (!fornecedor && !produto) return null;
    const vencimento = ehData(o.vencimento) ? o.vencimento : '';
    return {
      tipo: 'compra',
      titulo: 'Lançar conta a pagar',
      resumo: `Conta de ${brl(valor)} — ${produto}${fornecedor ? `, de ${fornecedor}` : ''}${vencimento ? `, vence ${ddmm(vencimento)}` : ' (sem vencimento)'}.`,
      dados: { valor, fornecedor, produto, vencimento },
    };
  }

  if (tipo === 'tarefa') {
    const texto = txt(o.texto, 200);
    if (texto.length < 3) return null;
    return { tipo: 'tarefa', titulo: 'Anotar no TO DO', resumo: `Anotar no TO DO: "${texto}".`, dados: { texto } };
  }

  if (tipo === 'agenda') {
    const titulo = txt(o.titulo, 150);
    if (titulo.length < 3 || !ehData(o.data)) return null;
    const hora = /^\d{2}:\d{2}$/.test(String(o.hora || '')) ? o.hora : '';
    return {
      tipo: 'agenda',
      titulo: 'Marcar na agenda',
      resumo: `${titulo} — ${ddmm(o.data)}${hora ? ` às ${hora}` : ' (dia todo)'}.`,
      dados: { titulo, data: o.data, hora, diaTodo: !hora },
    };
  }

  if (tipo === 'perda') {
    const it = estoque.find((x) => x.id === String(o.itemId || ''));
    if (!it) return null; // item inventado: não baixa nada
    const qtd = Number(o.qtd) > 0 ? Math.round(Number(o.qtd) * 1000) / 1000 : 1;
    const motivo = MOTIVOS.includes(o.motivo) ? o.motivo : 'Desperdício';
    return {
      tipo: 'perda',
      titulo: 'Baixar do estoque',
      resumo: `Baixar ${qtd} ${it.unidade} de ${it.nome}, como ${motivo.toLowerCase()}.`,
      dados: { itemId: it.id, nome: it.nome, qtd, motivo, unidade: it.unidade },
    };
  }
  return null;
}

async function entenderClaude(sistema, frase) {
  const client = new Anthropic({ timeout: 20000, maxRetries: 0 });
  const r = await client.messages.create({
    model: MODELO_CLAUDE,
    max_tokens: 1500,
    output_config: { effort: 'low' },
    system: sistema,
    tools: [{ name: 'ordem', description: 'Devolve a ordem organizada nos campos do sistema.', input_schema: ESQUEMA, strict: true }],
    tool_choice: { type: 'tool', name: 'ordem' },
    messages: [{ role: 'user', content: frase }],
  });
  const uso = r.content.find((b) => b.type === 'tool_use');
  return uso ? uso.input : null;
}

async function entenderOpenAI(sistema, frase) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELO_OPENAI, max_tokens: 500, temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${sistema}\n\nResponde SÓ um objeto JSON com estes campos: ${ESQUEMA.required.join(', ')}.` },
        { role: 'user', content: frase },
      ],
    }),
  });
  if (!r.ok) throw new Error('OpenAI respondeu ' + r.status);
  const j = await r.json();
  try { return JSON.parse(j?.choices?.[0]?.message?.content || '{}'); } catch { return null; }
}

export async function POST(request) {
  if (papelDaSessao(cookies().get(nomeCookie())?.value) !== 'dona') {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }
  const motor = motorDisponivel();
  if (!motor) return NextResponse.json({ ok: false, semChave: true });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }
  const frase = String(body?.texto || '').trim().slice(0, 400);
  if (frase.length < 3) return NextResponse.json({ ok: false, erro: 'Frase vazia.' }, { status: 400 });

  try {
    const sb = supabaseServer();
    const cat = await catalogo(sb);
    const hoje = diaOperacional();
    const sistema = instrucoes(hoje, cat.estoque, cat.fornecedores);
    const bruto = motor === 'claude' ? await entenderClaude(sistema, frase) : await entenderOpenAI(sistema, frase);
    const pedido = conferir(bruto, cat, hoje);
    // Sem ordem reconhecida não é erro: a frase provavelmente era uma pergunta.
    return NextResponse.json({ ok: true, pedido: pedido || null });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao entender a ordem.' }, { status: 502 });
  }
}
