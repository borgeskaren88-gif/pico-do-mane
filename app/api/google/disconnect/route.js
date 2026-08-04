import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, sessaoEhValida } from '../../../../lib/auth';
import { desconectar } from '../../../../lib/google';

export const dynamic = 'force-dynamic';

export async function POST() {
  const valor = cookies().get(nomeCookie())?.value;
  if (!sessaoEhValida(valor)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    await desconectar();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao desconectar.' }, { status: 500 });
  }
}
