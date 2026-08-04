import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, sessaoEhValida, tokenCalendario } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const valor = cookies().get(nomeCookie())?.value;
  if (!sessaoEhValida(valor)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const h = headers();
  const host = h.get('host') || '';
  const proto = h.get('x-forwarded-proto') || 'https';
  const url = `${proto}://${host}/api/calendario?t=${tokenCalendario()}`;
  return NextResponse.json({ ok: true, url });
}
