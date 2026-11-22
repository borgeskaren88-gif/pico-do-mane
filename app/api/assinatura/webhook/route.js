import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { negocioDaAssinatura, mudarNegocio } from '../../../../lib/negocios';
import { creditarPagamento } from '../../../../lib/assinatura';

export const dynamic = 'force-dynamic';

// O AVISO DO ASAAS: "o cliente pagou".
//
// É isto que faz a assinatura não depender da Karen: o cliente paga o Pix, o
// Asaas avisa aqui, e o mês do bar dele é liberado sozinho — de madrugada, em
// feriado, com ela de folga.
//
// Endereço aberto pra internet, então NADA que chega aqui vale sem a senha do
// aviso (ASAAS_WEBHOOK_TOKEN), que a Karen escreve igual nos dois lugares: na
// Vercel e no Asaas (Integrações → Webhooks → Token de autenticação). Sem ela
// configurada, o endereço recusa tudo — ninguém libera um mês mandando um
// "paguei" de mentira.
//
// E o bar certo é achado pelo NÚMERO DA ASSINATURA que nós guardamos, não pelo
// nome escrito no aviso.

function tokenConfere(recebido) {
  const esperado = String(process.env.ASAAS_WEBHOOK_TOKEN || '').trim();
  if (!esperado) return false;
  const a = crypto.createHash('sha256').update(String(recebido || '')).digest();
  const b = crypto.createHash('sha256').update(esperado).digest();
  return crypto.timingSafeEqual(a, b);
}

const PAGOU = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);

export async function POST(request) {
  if (!tokenConfere(request.headers.get('asaas-access-token'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let b = {};
  try { b = await request.json(); } catch { return NextResponse.json({ ok: true, ignorado: 'corpo' }); }

  // O que não for nosso responde 200 e é ignorado: o Asaas PAUSA a fila de
  // avisos quando recebe erro várias vezes, e aí nem os pagamentos certos
  // chegariam mais. Só o banco engasgado responde erro — aí sim queremos que o
  // Asaas mande de novo daqui a pouco, senão o pagamento se perde.
  try {
    const evento = String(b.event || '');
    const p = b.payment || {};
    if (!PAGOU.has(evento) || !p.id || !p.subscription) return NextResponse.json({ ok: true, ignorado: evento || 'sem evento' });
    const n = await negocioDaAssinatura(p.subscription);
    if (!n) return NextResponse.json({ ok: true, ignorado: 'assinatura desconhecida' });
    let creditou = false;
    await mudarNegocio(n.codigo, {
      assinatura: (atual) => {
        const r = creditarPagamento(atual, p.id);
        creditou = r.creditou;
        return r.creditou ? r.assinatura : undefined;
      },
    });
    return NextResponse.json({ ok: true, creditou });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'falhou' }, { status: 500 });
  }
}
