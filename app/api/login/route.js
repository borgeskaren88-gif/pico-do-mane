import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, valorSessaoValida, valorSessaoCozinha, valorSessaoGarcom } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

function comparaSegura(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function POST(request) {
  const senhaDona = process.env.APP_PASSWORD;
  // Senha da cozinha e do garçom: padrão "1234" se não houver variável.
  const senhaCozinha = process.env.APP_PASSWORD_COZINHA || '1234';
  const senhaGarcom = process.env.APP_PASSWORD_GARCOM || '1234';
  if (!senhaDona) {
    return NextResponse.json(
      { ok: false, erro: 'Servidor sem senha configurada (APP_PASSWORD).' },
      { status: 500 }
    );
  }

  let senha = '';
  let papelPedido = '';
  // "lembrar": o celular manda true (fica logado). No computador vem false, e aí
  // o cookie é "de sessão" — some quando fecha o navegador, então pede a senha
  // de novo na próxima vez. Assim o computador não fica aberto pra qualquer um.
  let lembrar = false;
  try {
    const body = await request.json();
    senha = body?.senha ?? '';
    papelPedido = body?.papel ?? '';
    lembrar = body?.lembrar === true;
  } catch {
    return NextResponse.json({ ok: false, erro: 'Requisição inválida.' }, { status: 400 });
  }

  let valorCookie = null;
  let papel = null;
  // Com o papel escolhido no login, cozinha e garçom podem usar a mesma senha
  // (1234) sem ambiguidade: o papel é que decide qual acesso abrir.
  if (papelPedido === 'cozinha') {
    if (senha && comparaSegura(senha, senhaCozinha)) { valorCookie = valorSessaoCozinha(); papel = 'cozinha'; }
  } else if (papelPedido === 'garcom') {
    if (senha && comparaSegura(senha, senhaGarcom)) { valorCookie = valorSessaoGarcom(); papel = 'garcom'; }
  } else if (papelPedido === 'dona' || !papelPedido) {
    // 'dona' explícito, ou sem papel (compatibilidade): tenta dona e, se não for,
    // ainda aceita cozinha pela senha (não quebra quem já usava só a senha).
    if (senha && comparaSegura(senha, senhaDona)) { valorCookie = valorSessaoValida(); papel = 'dona'; }
    else if (!papelPedido && senha && comparaSegura(senha, senhaCozinha)) { valorCookie = valorSessaoCozinha(); papel = 'cozinha'; }
  }

  if (!valorCookie) {
    return NextResponse.json({ ok: false, erro: 'Senha incorreta.' }, { status: 401 });
  }

  cookies().set(nomeCookie(), valorCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // Celular: 90 dias (continua logado). Computador: sem maxAge = cookie de
    // sessão, que o navegador apaga ao fechar → pede a senha de novo.
    ...(lembrar ? { maxAge: 60 * 60 * 24 * 90 } : {}),
  });

  return NextResponse.json({ ok: true, papel });
}
