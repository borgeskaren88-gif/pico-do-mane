import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao, tokenWidget, negocioDaSessao } from '../../../../lib/auth';
import { negocioAtual } from '../../../../lib/negocioAtual';

export const dynamic = 'force-dynamic';

// Devolve o link seguro do widget (só pra dona). O link carrega o token, então
// não precisa de cookie — é o que o Scriptable no iPhone vai chamar.
export async function GET() {
  const valor = cookies().get(nomeCookie())?.value;
  const papel = papelDaSessao(valor);
  if (papel !== 'dona') return NextResponse.json({ ok: false }, { status: 401 });
  const h = headers();
  const host = h.get('host') || '';
  const proto = h.get('x-forwarded-proto') || 'https';
  // No app de muitos negócios o link leva o nome do negócio junto, porque quem
  // busca essa URL não manda crachá nenhum. Numa instalação de um cliente só o
  // "n=" não aparece — o link continua igual ao de sempre.
  const doCracha = negocioDaSessao(valor) || '';
  const negocio = doCracha || negocioAtual() || '';
  const sufixo = doCracha ? `&n=${encodeURIComponent(doCracha)}` : '';
  const url = `${proto}://${host}/api/widget?t=${tokenWidget(negocio)}${sufixo}`;
  return NextResponse.json({ ok: true, url });
}
