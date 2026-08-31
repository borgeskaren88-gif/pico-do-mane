import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao, tokenWidget } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

// Devolve o link seguro do widget (só pra dona). O link carrega o token, então
// não precisa de cookie — é o que o Scriptable no iPhone vai chamar.
export async function GET() {
  const papel = papelDaSessao(cookies().get(nomeCookie())?.value);
  if (papel !== 'dona') return NextResponse.json({ ok: false }, { status: 401 });
  const h = headers();
  const host = h.get('host') || '';
  const proto = h.get('x-forwarded-proto') || 'https';
  const url = `${proto}://${host}/api/widget?t=${tokenWidget()}`;
  return NextResponse.json({ ok: true, url });
}
