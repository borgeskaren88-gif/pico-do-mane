import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';
import { ACESSOS, lerGeracoes, subirGeracao } from '../../../lib/acessos';
import { definirSenhaPapel, senhaFoiTrocada, ehSenhaDeFabrica } from '../../../lib/senha';

export const dynamic = 'force-dynamic';

// OS ACESSOS DA EQUIPE, na mão de quem é dona do bar.
//
// Só a dona entra aqui. Trocar a senha da cozinha e cortar os aparelhos da
// cozinha são poderes de patrão, e deixar isso na mão do próprio acesso que
// está sendo cortado não faria sentido nenhum.
function ehDona() {
  return papelDaSessao(cookies().get(nomeCookie())?.value) === 'dona';
}

export async function GET() {
  if (!ehDona()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    const ger = await lerGeracoes(sb);
    const lista = [];
    for (const a of ACESSOS) {
      lista.push({
        ...a, geracao: ger[a.papel] || 1,
        senhaPropria: await senhaFoiTrocada(sb, a.papel),
        deFabrica: await ehSenhaDeFabrica(sb, a.papel),
      });
    }
    return NextResponse.json({ ok: true, acessos: lista });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao ler os acessos.' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!ehDona()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'Requisição inválida.' }, { status: 400 }); }
  const acao = String(body?.acao || '');
  const papel = String(body?.papel || '');
  if (!ACESSOS.some((a) => a.papel === papel)) {
    return NextResponse.json({ ok: false, erro: 'Esse acesso não existe.' }, { status: 400 });
  }

  try {
    const sb = supabaseServer();

    // Cortar: sobe a geração. Todo crachá antigo daquele acesso morre na hora —
    // inclusive o do celular de quem já não trabalha aqui, que era o problema.
    if (acao === 'desconectar') {
      const g = await subirGeracao(sb, papel);
      return NextResponse.json({ ok: true, geracao: g });
    }

    // Trocar a senha do acesso. A dona não precisa saber a senha antiga: é o
    // bar dela, e exigir a senha de quem saiu seria trancar a porta por fora.
    if (acao === 'senha') {
      const nova = String(body?.nova ?? '').trim();
      if (nova.length < 4) return NextResponse.json({ ok: false, erro: 'A senha precisa ter pelo menos 4 caracteres.' }, { status: 400 });
      await definirSenhaPapel(sb, papel, nova);
      // Trocar a senha SEM cortar deixaria quem já está dentro, dentro — que é
      // o engano que quase todo mundo comete. Então as duas coisas andam
      // juntas, e a tela diz isso.
      const g = await subirGeracao(sb, papel);
      return NextResponse.json({ ok: true, geracao: g });
    }

    return NextResponse.json({ ok: false, erro: 'Ação desconhecida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao mexer no acesso.' }, { status: 500 });
  }
}
