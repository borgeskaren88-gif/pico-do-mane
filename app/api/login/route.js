import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, valorSessaoValida } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

function comparaSegura(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function POST(request) {
  const senhaCorreta = process.env.APP_PASSWORD;
  if (!senhaCorreta) {
    return NextResponse.json(
      { ok: false, erro: 'Servidor sem senha configurada (APP_PASSWORD).' },
      { status: 500 }
    );
  }

  let senha = '';
  try {
    const body = await request.json();
    senha = body?.senha ?? '';
  } catch {
    return NextResponse.json({ ok: false, erro: 'Requisição inválida.' }, { status: 400 });
  }

  if (!senha || !comparaSegura(senha, senhaCorreta)) {
    return NextResponse.json({ ok: false, erro: 'Senha incorreta.' }, { status: 401 });
  }

  cookies().set(nomeCookie(), valorSessaoValida(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 90, // 90 dias
  });

  return NextResponse.json({ ok: true });
}
