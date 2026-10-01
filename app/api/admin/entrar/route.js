import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookieAdmin, valorSessaoAdmin, senhaAdminConfere, consoleLigado } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

// A porta da sala de máquinas. Fica num endereço próprio, com cookie próprio e
// senha própria — não é um papel a mais no login dos clientes.
//
// Sem ADMIN_PASSWORD no servidor, esta porta responde 404: não é "senha errada",
// é "não existe isso aqui". Numa instalação de cliente, procurar por ela não
// devolve nem a informação de que ela poderia existir.
export async function POST(request) {
  if (!consoleLigado()) return NextResponse.json({ ok: false }, { status: 404 });

  let senha = '';
  let sair = false;
  try {
    const body = await request.json();
    senha = body?.senha ?? '';
    sair = body?.sair === true;
  } catch {
    return NextResponse.json({ ok: false, erro: 'Requisição inválida.' }, { status: 400 });
  }

  if (sair) {
    cookies().set(nomeCookieAdmin(), '', { path: '/', maxAge: 0 });
    return NextResponse.json({ ok: true });
  }

  if (!senhaAdminConfere(senha)) {
    return NextResponse.json({ ok: false, erro: 'Senha incorreta.' }, { status: 401 });
  }

  cookies().set(nomeCookieAdmin(), valorSessaoAdmin(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // Sem maxAge de propósito: cookie de sessão. A sala de máquinas mexe em
    // todos os clientes de uma vez — não é lugar de ficar logado pra sempre num
    // navegador que ela deixou aberto.
  });
  return NextResponse.json({ ok: true });
}
