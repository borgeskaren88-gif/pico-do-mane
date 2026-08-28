import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';
import { obterConfigPush, salvarInscricao, removerInscricao, enviarPush, montarResumoDiario } from '../../../lib/push';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // web-push precisa do Node (crypto), não do Edge.

function papelAtual() {
  return papelDaSessao(cookies().get(nomeCookie())?.value);
}

// GET: devolve a chave pública (o app precisa dela pra inscrever o aparelho).
export async function GET() {
  const p = papelAtual();
  if (p !== 'dona' && p !== 'cozinha') return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    const cfg = await obterConfigPush(sb);
    return NextResponse.json({ ok: true, publicKey: cfg.publicKey });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao preparar notificações.' }, { status: 500 });
  }
}

export async function POST(request) {
  const p = papelAtual();
  if (p !== 'dona' && p !== 'cozinha') return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }
  const acao = String(body?.acao || '');
  try {
    const sb = supabaseServer();

    if (acao === 'inscrever') {
      await salvarInscricao(sb, body?.sub, body?.apelido);
      return NextResponse.json({ ok: true });
    }
    if (acao === 'desinscrever') {
      await removerInscricao(sb, body?.sub);
      return NextResponse.json({ ok: true });
    }
    // Teste: manda um push pra todos os aparelhos (a dona confere se chega).
    if (acao === 'teste') {
      const r = await enviarPush(sb, { titulo: 'PicoOS ✅', corpo: 'Notificações ativadas! É assim que você vai receber os avisos.', url: '/', tag: 'teste' });
      return NextResponse.json({ ok: true, ...r });
    }
    // Manda o resumo diário AGORA (a dona quer ver como fica, sem esperar a manhã).
    if (acao === 'digest') {
      if (p !== 'dona') return NextResponse.json({ ok: false, erro: 'Só a dona.' }, { status: 403 });
      const resumo = await montarResumoDiario(sb);
      if (!resumo) return NextResponse.json({ ok: true, enviados: 0, vazio: true });
      const r = await enviarPush(sb, { ...resumo, tag: 'resumo-diario' });
      return NextResponse.json({ ok: true, ...r });
    }
    return NextResponse.json({ ok: false, erro: 'Ação inválida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro nas notificações.' }, { status: 500 });
  }
}
