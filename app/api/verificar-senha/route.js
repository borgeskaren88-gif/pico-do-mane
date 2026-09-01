import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

// Confere a senha de quem JÁ está logado, sem alterar o cookie. Usado pela trava
// de tela no computador: ao reabrir o app, a pessoa digita a senha pra destravar
// (a sessão continua a mesma). Compara com a senha do papel do cookie atual.
function comparaSegura(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function POST(request) {
  const papel = papelDaSessao(cookies().get(nomeCookie())?.value);
  if (!papel) return NextResponse.json({ ok: false, erro: 'Sessão expirada. Entre de novo.' }, { status: 401 });

  let senha = '';
  try { const b = await request.json(); senha = b?.senha ?? ''; }
  catch { return NextResponse.json({ ok: false, erro: 'Requisição inválida.' }, { status: 400 }); }

  const alvo = papel === 'dona'
    ? (process.env.APP_PASSWORD || '')
    : papel === 'cozinha'
      ? (process.env.APP_PASSWORD_COZINHA || '1234')
      : (process.env.APP_PASSWORD_GARCOM || '1234');

  if (senha && alvo && comparaSegura(senha, alvo)) return NextResponse.json({ ok: true, papel });
  return NextResponse.json({ ok: false, erro: 'Senha incorreta.' }, { status: 401 });
}
