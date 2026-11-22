// A CONVERSA COM O ASAAS — quem cobra a mensalidade de cada bar.
//
// Por que o Asaas: não tem mensalidade. Só cobra uma taxinha quando o cliente
// PAGA (no Pix, perto de R$ 2). Sem cliente, custo zero.
//
// A chave fica SÓ na Vercel (ASAAS_API_KEY). A Karen cola lá ela mesma, direto
// do Asaas — nunca por WhatsApp, nunca pra ninguém. Sem a chave, o app não
// quebra: o botão "Assinar" diz que o pagamento ainda não está ligado e mostra
// o WhatsApp da Karen.
//
// ASAAS_SANDBOX=1 usa o Asaas de teste (dinheiro de mentira), pra conferir
// tudo antes de valer. ASAAS_URL existe só pro laboratório.

export function asaasLigado() {
  return !!String(process.env.ASAAS_API_KEY || '').trim();
}

function base() {
  const propria = String(process.env.ASAAS_URL || '').trim();
  if (propria) return propria.replace(/\/+$/, '');
  return process.env.ASAAS_SANDBOX === '1' ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3';
}

async function chamar(metodo, caminho, corpo) {
  const r = await fetch(base() + caminho, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'PicoOS',
      access_token: String(process.env.ASAAS_API_KEY || '').trim(),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    // O Asaas devolve { errors: [{ description }] } — em português, quase sempre
    // legível. Passa adiante; se não vier nada, uma frase nossa.
    const msg = (Array.isArray(j.errors) && j.errors[0] && j.errors[0].description) || `O Asaas recusou (${r.status}).`;
    throw new Error(msg);
  }
  return j;
}

const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

export async function criarCliente({ nome, documento, email, whatsapp, codigo }) {
  const c = await chamar('POST', '/customers', {
    name: String(nome || '').slice(0, 100),
    cpfCnpj: documento,
    email: email || undefined,
    mobilePhone: whatsapp ? String(whatsapp).replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '') : undefined,
    externalReference: codigo,
  });
  return c.id;
}

// A assinatura mensal. "UNDEFINED" deixa o cliente escolher na hora de pagar:
// Pix, boleto ou cartão. A primeira cobrança vence hoje — e o mês pago soma
// aos dias de teste que ainda faltam (ver lib/assinatura.js).
export async function criarAssinatura({ cliente, valor, codigo, nomeBar }) {
  const s = await chamar('POST', '/subscriptions', {
    customer: cliente,
    billingType: 'UNDEFINED',
    value: valor,
    nextDueDate: hojeSP(),
    cycle: 'MONTHLY',
    description: `PicoOS — ${String(nomeBar || codigo).slice(0, 60)}`,
    externalReference: codigo,
  });
  return s.id;
}

// O link da cobrança que está em aberto (a do mês). É a página do próprio
// Asaas, onde o cliente escolhe como pagar.
//
// O Asaas cria a cobrança do mês seguinte bem antes do vencimento (uns 40
// dias). Então, logo depois de pagar, já existe uma "em aberto" pro mês que
// vem — e mostrar o link dela como se fosse dívida assustaria. Atrasada
// aparece sempre; a que vence só daqui a mais de 10 dias vira "próxima".
export async function linkEmAberto(idAssinatura, agora = Date.now()) {
  const limite = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(agora + 10 * 86400000));
  let proxima = null;
  for (const status of ['OVERDUE', 'PENDING']) {
    const j = await chamar('GET', `/subscriptions/${encodeURIComponent(idAssinatura)}/payments?status=${status}`);
    const p = Array.isArray(j.data) ? j.data.filter((x) => x && x.invoiceUrl).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0] : null;
    if (!p) continue;
    if (status === 'OVERDUE' || String(p.dueDate || '') <= limite) return { url: p.invoiceUrl, vence: p.dueDate || null, valor: p.value || null };
    proxima = p.dueDate || null;
  }
  return proxima ? { url: null, proxima } : null;
}

export async function cancelarAssinatura(idAssinatura) {
  await chamar('DELETE', `/subscriptions/${encodeURIComponent(idAssinatura)}`);
}
