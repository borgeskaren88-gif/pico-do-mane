import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, sessaoEhValida } from '../../../../lib/auth';
import { statusGoogle } from '../../../../lib/google';

export const dynamic = 'force-dynamic';

export async function GET() {
  const valor = cookies().get(nomeCookie())?.value;
  if (!sessaoEhValida(valor)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const s = await statusGoogle();
    return NextResponse.json({ ok: true, ...s });
  } catch (e) {
    return NextResponse.json({ ok: true, configurado: false, conectado: false, email: '', erro: e?.message });
  }
}
