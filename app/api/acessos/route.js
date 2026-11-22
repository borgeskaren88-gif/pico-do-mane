import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao, negocioDaSessao } from '../../../lib/auth';
import { ehBarDaCasa } from '../../../lib/darciLiberado';
import { lerLogins, criarLogin, editarLogin, apagarLogin, publico, MAX_LOGINS, TIPOS } from '../../../lib/loginsEquipe';
import { bancoDaSessao } from '../../../lib/negocioAtual';
import { ACESSOS, lerGeracoes, subirGeracao } from '../../../lib/acessos';
import { definirSenhaPapel, senhaFoiTrocada, ehSenhaDeFabrica, acessoFechado, apagarSenhaPapel, nasceFechado } from '../../../lib/senha';

export const dynamic = 'force-dynamic';

// OS ACESSOS DA EQUIPE, na mão de quem é dona do bar.
//
// Só a dona entra aqui. Trocar a senha da cozinha e cortar os aparelhos da
// cozinha são poderes de patrão, e deixar isso na mão do próprio acesso que
// está sendo cortado não faria sentido nenhum.
function ehDona() {
  return papelDaSessao(cookies().get(nomeCookie())?.value) === 'dona';
}

// A GERENTE MEXE EM UM ACESSO SÓ: O DO EXTRA.
//
// "Quando vier alguém trabalhar de extra, a Sarah pode abrir e fechar o acesso
// do Extra?" — "Sim." Só isso: criar a senha do dia e fechar no fim da noite.
// A senha dela mesma, a do atendimento, a da cozinha e a da dona continuam
// fora do alcance. E a regra mora aqui, não na tela: tela é sugestão.
const ehGerente = () => papelDaSessao(cookies().get(nomeCookie())?.value) === 'gerente';
const GERENTE_PODE = new Set(['extra']);

// Bar novo (não é o da casa): a equipe é por PESSOA, até 5 logins com nome.
const porPessoa = () => {
  const n = negocioDaSessao(cookies().get(nomeCookie())?.value);
  return !!n && !ehBarDaCasa(n);
};

export async function GET() {
  const gerente = ehGerente();
  if (!ehDona() && !gerente) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  if (porPessoa()) {
    // Só a dona cria e mexe nos logins. A gerência daqui não tem Extra.
    if (!ehDona()) return NextResponse.json({ ok: true, modo: 'pessoas', acessos: [], logins: [] });
    try {
      const logins = (await lerLogins(bancoDaSessao())).map(publico);
      return NextResponse.json({ ok: true, modo: 'pessoas', acessos: [], logins, max: MAX_LOGINS, tipos: TIPOS });
    } catch (e) {
      return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao ler os logins.' }, { status: 500 });
    }
  }
  try {
    const sb = bancoDaSessao();
    const ger = await lerGeracoes(sb);
    const lista = [];
    for (const a of ACESSOS) {
      if (gerente && !GERENTE_PODE.has(a.papel)) continue;
      lista.push({
        ...a, geracao: ger[a.papel] || 1,
        senhaPropria: await senhaFoiTrocada(sb, a.papel),
        deFabrica: await ehSenhaDeFabrica(sb, a.papel),
        // Só o extra pode estar fechado (sem senha nenhuma). E só ele pode ser
        // fechado de novo — os outros acessos existem todo dia.
        fechado: await acessoFechado(sb, a.papel),
        podeFechar: nasceFechado(a.papel),
      });
    }
    return NextResponse.json({ ok: true, acessos: lista });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao ler os acessos.' }, { status: 500 });
  }
}

export async function POST(request) {
  const gerente = ehGerente();
  if (!ehDona() && !gerente) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'Requisição inválida.' }, { status: 400 }); }
  const acao = String(body?.acao || '');
  if (porPessoa()) {
    if (!ehDona()) return NextResponse.json({ ok: false, erro: 'Só a dona mexe nos logins.' }, { status: 403 });
    try {
      const sb = bancoDaSessao();
      if (acao === 'criarLogin') return NextResponse.json({ ok: true, login: await criarLogin(sb, body || {}) });
      if (acao === 'editarLogin') return NextResponse.json({ ok: true, login: await editarLogin(sb, String(body?.id || ''), body || {}) });
      if (acao === 'apagarLogin') { await apagarLogin(sb, String(body?.id || '')); return NextResponse.json({ ok: true }); }
      return NextResponse.json({ ok: false, erro: 'Neste bar a equipe é por pessoa: cria, edita ou apaga um login.' }, { status: 400 });
    } catch (e) {
      return NextResponse.json({ ok: false, erro: e?.message || 'Não deu certo.' }, { status: 400 });
    }
  }
  const papel = String(body?.papel || '');
  if (!ACESSOS.some((a) => a.papel === papel)) {
    return NextResponse.json({ ok: false, erro: 'Esse acesso não existe.' }, { status: 400 });
  }
  if (gerente && !GERENTE_PODE.has(papel)) {
    return NextResponse.json({ ok: false, erro: 'Esse acesso só a dona mexe.' }, { status: 403 });
  }

  try {
    const sb = bancoDaSessao();

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

    // FECHAR o acesso do extra: a noite acabou, ele foi embora.
    //
    // Apaga a senha (ninguém mais entra) e sobe a geração (quem estava dentro
    // cai). As duas coisas, sempre: só apagar a senha deixaria o celular dele
    // logado por noventa dias. O ponto que ele bateu fica guardado.
    if (acao === 'fechar') {
      if (!nasceFechado(papel)) return NextResponse.json({ ok: false, erro: 'Esse acesso não fecha: ele é da equipe de todo dia.' }, { status: 400 });
      await apagarSenhaPapel(sb, papel);
      const g = await subirGeracao(sb, papel);
      return NextResponse.json({ ok: true, geracao: g, fechado: true });
    }

    return NextResponse.json({ ok: false, erro: 'Ação desconhecida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao mexer no acesso.' }, { status: 500 });
  }
}
