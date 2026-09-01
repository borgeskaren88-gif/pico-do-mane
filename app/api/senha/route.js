import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';
import { conferirSenhaDona, definirSenhaDona } from '../../../lib/senha';

export const dynamic = 'force-dynamic';

// Trocar a senha da dona, dentro do app. Exige a senha ATUAL (confere) e grava a
// NOVA (só o hash) no banco, que passa a valer a partir do próximo login/trava.
export async function POST(request) {
  const papel = papelDaSessao(cookies().get(nomeCookie())?.value);
  if (papel !== 'dona') return NextResponse.json({ ok: false, erro: 'Só a Karen troca a senha.' }, { status: 403 });

  let atual = '', nova = '';
  try { const b = await request.json(); atual = String(b?.atual ?? ''); nova = String(b?.nova ?? ''); }
  catch { return NextResponse.json({ ok: false, erro: 'Requisição inválida.' }, { status: 400 }); }

  const novaLimpa = nova.trim();
  if (novaLimpa.length < 4) return NextResponse.json({ ok: false, erro: 'A nova senha precisa ter pelo menos 4 caracteres.' }, { status: 400 });

  const sb = supabaseServer();
  if (!(await conferirSenhaDona(sb, atual))) {
    return NextResponse.json({ ok: false, erro: 'A senha atual está incorreta.' }, { status: 401 });
  }
  try {
    await definirSenhaDona(sb, novaLimpa);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao salvar a nova senha.' }, { status: 500 });
  }
}
