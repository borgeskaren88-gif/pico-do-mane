import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, valorSessao, autenticar, usuarios } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const configurados = usuarios().filter((u) => u.senha);
  if (configurados.length === 0) {
    return NextResponse.json(
      { ok: false, erro: 'Servidor sem senhas configuradas (USUARIO1_SENHA / USUARIO2_SENHA).' },
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

  const usuario = autenticar(senha);
  if (!usuario) {
    return NextResponse.json({ ok: false, erro: 'Senha incorreta.' }, { status: 401 });
  }

  cookies().set(nomeCookie(), valorSessao(usuario.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 90, // 90 dias
  });

  return NextResponse.json({ ok: true, nome: usuario.nome });
}
