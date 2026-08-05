import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, valorSessaoValida, valorSessaoCozinha } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

function comparaSegura(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function POST(request) {
  const senhaDona = process.env.APP_PASSWORD;
  // Senha da cozinha: padrão "1234" se não houver variável configurada.
  const senhaCozinha = process.env.APP_PASSWORD_COZINHA || '1234';
  if (!senhaDona) {
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

  let valorCookie = null;
  let papel = null;
  if (senha && comparaSegura(senha, senhaDona)) { valorCookie = valorSessaoValida(); papel = 'dona'; }
  else if (senha && comparaSegura(senha, senhaCozinha)) { valorCookie = valorSessaoCozinha(); papel = 'cozinha'; }

  if (!valorCookie) {
    return NextResponse.json({ ok: false, erro: 'Senha incorreta.' }, { status: 401 });
  }

  cookies().set(nomeCookie(), valorCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 90, // 90 dias
  });

  return NextResponse.json({ ok: true, papel });
}
