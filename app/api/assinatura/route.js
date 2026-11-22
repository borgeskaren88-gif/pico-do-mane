import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao, negocioDaSessao } from '../../../lib/auth';
import { lerNegocio, mudarNegocio, lerConfigVenda } from '../../../lib/negocios';
import { situacao, documentoValido } from '../../../lib/assinatura';
import { asaasLigado, criarCliente, criarAssinatura, linkEmAberto, cancelarAssinatura } from '../../../lib/asaas';

export const dynamic = 'force-dynamic';

// A ASSINATURA, vista de dentro do bar.
//
// GET: em que pé está (teste, em dia, atrasado...). Qualquer um logado pode
// perguntar — a equipe precisa saber se o app está pausado — mas só a dona
// recebe preço e datas.
// POST (só a dona): assinar, pagar a mensalidade em aberto, cancelar.
//
// O bar que não tem assinatura (o Pico do Mané, os criados na mão) responde
// "isento" e a tela não mostra nada.

const sessao = () => {
  const v = cookies().get(nomeCookie())?.value;
  return { papel: papelDaSessao(v), negocio: negocioDaSessao(v) };
};
const erro = (msg, status = 400) => NextResponse.json({ ok: false, erro: msg }, { status });
const WHATSAPP_KAREN = '5548988784016';

export async function GET() {
  const { papel, negocio } = sessao();
  if (!papel) return erro('Não autorizado.', 401);
  if (!negocio) return NextResponse.json({ ok: true, estado: 'isento' });
  const n = await lerNegocio(negocio);
  const s = situacao(n);
  if (papel !== 'dona') return NextResponse.json({ ok: true, estado: s.estado, podeUsar: s.podeUsar });
  const cfg = await lerConfigVenda().catch(() => ({ preco: 99.9 }));
  const a = (n && n.assinatura) || {};
  return NextResponse.json({
    ok: true, ...s,
    preco: cfg.preco,
    assinou: !!a.asaasAssinatura && !a.cancelada,
    cancelada: !!a.cancelada,
    pagamentoLigado: asaasLigado(),
    whatsapp: WHATSAPP_KAREN,
    nomeContato: (n && n.contato && n.contato.nome) || '',
  });
}

export async function POST(request) {
  const { papel, negocio } = sessao();
  if (papel !== 'dona' || !negocio) return erro('Só a dona do negócio mexe na assinatura.', 401);
  let b = {};
  try { b = await request.json(); } catch { return erro('Requisição inválida.'); }
  const n = await lerNegocio(negocio);
  if (!n) return erro('Negócio não encontrado.', 404);
  const s = situacao(n);
  if (s.estado === 'isento') return erro('Este negócio não tem cobrança.');
  if (!asaasLigado()) return erro('O pagamento pelo app ainda não está ligado. Fala com a gente pelo WhatsApp.', 503);
  const a = n.assinatura || {};
  const acao = String(b.acao || '');

  try {
    // ASSINAR (ou voltar a assinar depois de cancelar): cria o cliente no
    // Asaas (uma vez só) e a assinatura mensal, e devolve o link da primeira
    // mensalidade.
    if (acao === 'assinar') {
      if (a.asaasAssinatura && !a.cancelada) {
        const link = await linkEmAberto(a.asaasAssinatura);
        return NextResponse.json({ ok: true, link: link && link.url, jaPago: !(link && link.url), proxima: link && link.proxima });
      }
      const doc = documentoValido(b.documento);
      if (!doc) return erro('Confere o CPF ou CNPJ: os números não batem.');
      const nome = String(b.nome || (n.contato && n.contato.nome) || n.nome || '').trim();
      if (nome.length < 2) return erro('Escreve o nome que vai na cobrança.');
      const cfg = await lerConfigVenda();
      const cliente = a.asaasCliente || await criarCliente({
        nome, documento: doc, email: n.contato && n.contato.email, whatsapp: n.contato && n.contato.whatsapp, codigo: negocio,
      });
      const idAss = await criarAssinatura({ cliente, valor: cfg.preco, codigo: negocio, nomeBar: n.nome });
      await mudarNegocio(negocio, {
        assinatura: (atual) => ({ ...(atual || {}), asaasCliente: cliente, asaasAssinatura: idAss, cancelada: false, valor: cfg.preco, assinouEm: new Date().toISOString() }),
      });
      const link = await linkEmAberto(idAss);
      return NextResponse.json({ ok: true, link: link && link.url });
    }

    if (acao === 'pagar') {
      if (!a.asaasAssinatura || a.cancelada) return erro('Ainda não tem assinatura. Toca em "Assinar".');
      const link = await linkEmAberto(a.asaasAssinatura);
      if (!link || !link.url) return NextResponse.json({ ok: true, jaPago: true, proxima: link && link.proxima });
      return NextResponse.json({ ok: true, link: link.url, vence: link.vence });
    }

    // CANCELAR: para as cobranças. O que já foi pago vale até o fim — o app
    // continua aberto até a data "liberado até", e os dados nunca são apagados.
    if (acao === 'cancelar') {
      if (!a.asaasAssinatura || a.cancelada) return erro('Não há assinatura ativa pra cancelar.');
      await cancelarAssinatura(a.asaasAssinatura);
      await mudarNegocio(negocio, { assinatura: (atual) => ({ ...(atual || {}), cancelada: true, canceladaEm: new Date().toISOString() }) });
      return NextResponse.json({ ok: true, ate: s.liberadoAte });
    }

    return erro('Ação desconhecida.');
  } catch (e) {
    return erro(e?.message || 'Não deu certo com o Asaas. Tenta de novo.', 502);
  }
}
