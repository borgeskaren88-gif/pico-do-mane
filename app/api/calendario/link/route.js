import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, sessaoEhValida, tokenCalendario, negocioDaSessao } from '../../../../lib/auth';
import { negocioAtual } from '../../../../lib/negocioAtual';

export const dynamic = 'force-dynamic';

export async function GET() {
  const valor = cookies().get(nomeCookie())?.value;
  if (!sessaoEhValida(valor)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const h = headers();
  const host = h.get('host') || '';
  const proto = h.get('x-forwarded-proto') || 'https';

  // Quem busca esta agenda (o Google, o iPhone) não manda crachá nenhum. Então,
  // no app de muitos negócios, o nome do negócio vai escrito na própria URL — e
  // o token é feito com esse nome, pra o link de um cliente não abrir o do
  // outro.
  //
  // Na instalação de um cliente só, o "n=" não vai: lá o negócio é o da
  // configuração do site, e o link segue com a cara de sempre.
  const doCracha = negocioDaSessao(valor) || '';
  const negocio = doCracha || negocioAtual() || '';
  const sufixo = doCracha ? `&n=${encodeURIComponent(doCracha)}` : '';
  const url = `${proto}://${host}/api/calendario?t=${tokenCalendario(negocio)}${sufixo}`;
  return NextResponse.json({ ok: true, url });
}
