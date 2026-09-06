import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../../lib/auth';
import { supabaseServer } from '../../../../lib/supabase';
import { notificarAgenda } from '../../../../lib/push';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // web-push precisa do Node (crypto), não do Edge.

// Confere se tem reserva/compromisso começando agora e avisa quem está no salão.
// Quem chama é o próprio app aberto, de tempos em tempos — assim o aviso sai na
// hora certa sem depender de robô de servidor rodando de minuto em minuto.
// É idempotente: o mesmo evento nunca é avisado duas vezes.
export async function POST() {
  const p = papelDaSessao(cookies().get(nomeCookie())?.value);
  if (p !== 'dona' && p !== 'garcom' && p !== 'cozinha') {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }
  try {
    const r = await notificarAgenda(supabaseServer());
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao conferir a agenda.' }, { status: 500 });
  }
}
