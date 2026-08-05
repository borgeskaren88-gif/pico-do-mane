import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, sessaoEhValida } from '../../../../lib/auth';
import { listarEventos } from '../../../../lib/google';

export const dynamic = 'force-dynamic';

export async function GET() {
  const valor = cookies().get(nomeCookie())?.value;
  if (!sessaoEhValida(valor)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const eventos = await listarEventos();
    if (eventos === null) return NextResponse.json({ ok: true, conectado: false, eventos: [] });
    return NextResponse.json({ ok: true, conectado: true, eventos });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao listar a agenda.' }, { status: 500 });
  }
}
