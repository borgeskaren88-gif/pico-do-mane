import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, sessaoEhValida } from '../../../../lib/auth';
import { concluirTarefa } from '../../../../lib/google';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const valor = cookies().get(nomeCookie())?.value;
  if (!sessaoEhValida(valor)) return NextResponse.json({ ok: false }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }
  // A agenda manda o id com prefixo "task-"; aqui tiramos pra falar com o Google.
  const id = String(body?.id || '').replace(/^task-/, '');
  try {
    await concluirTarefa(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao concluir a tarefa.' }, { status: 500 });
  }
}
