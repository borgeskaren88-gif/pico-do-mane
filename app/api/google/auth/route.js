import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, sessaoEhValida, valorSessaoValida } from '../../../../lib/auth';
import { googleConfigurado, urlConsentimento } from '../../../../lib/google';

export const dynamic = 'force-dynamic';

const base = () => process.env.APP_URL || 'http://localhost:3000';

export async function GET() {
  const valor = cookies().get(nomeCookie())?.value;
  if (!sessaoEhValida(valor)) return NextResponse.redirect(base());
  if (!googleConfigurado()) return NextResponse.redirect(base() + '/?google=naoconfig');
  return NextResponse.redirect(urlConsentimento(valorSessaoValida()));
}
