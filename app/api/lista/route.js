import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

const CHAVE = 'painel';

// Acesso liberado para os dois papéis (dona e cozinha). Este endpoint SÓ toca a
// lista de compras e as tarefas — nunca o financeiro — então é seguro para a
// cozinha. Retorna o papel de quem chamou (ou null se não autorizado).
function papel() {
  return papelDaSessao(cookies().get(nomeCookie())?.value);
}

const txt = (v, max) => String(v == null ? '' : v).slice(0, max);

// Limpa a lista que a cozinha manda: só campos conhecidos, tamanhos limitados,
// sempre "não comprado" (marcar como comprado é ação da dona). Evita que o
// acesso da cozinha injete outros dados ou estoure o tamanho.
function limparItens(entrada) {
  if (!Array.isArray(entrada)) return [];
  return entrada.slice(0, 500).map((i) => ({
    id: txt(i?.id, 40) || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
    nome: txt(i?.nome, 200),
    quantidade: txt(i?.quantidade, 100),
    categoria: txt(i?.categoria, 60),
    comprado: false,
    criadoEm: Number(i?.criadoEm) || Date.now(),
  })).filter((i) => i.nome.trim());
}

export async function GET() {
  if (!papel()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    const { data, error } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE).maybeSingle();
    if (error) throw error;
    const blob = data?.valor || {};
    // A cozinha tem a lista dela (listaCozinha), separada da lista da dona.
    const lista = Array.isArray(blob.listaCozinha) ? blob.listaCozinha.filter((i) => !i.comprado) : [];
    const tarefas = Array.isArray(blob.tarefasCozinha) ? blob.tarefasCozinha : [];
    return NextResponse.json({ ok: true, listaCompras: lista, tarefas });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao carregar a lista.' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!papel()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 });
  }
  try {
    const sb = supabaseServer();
    const { data, error } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE).maybeSingle();
    if (error) throw error;
    const blob = data?.valor || {};
    const novoBlob = { ...blob };
    // Lista da cozinha: só mexe se veio no corpo. Preserva os itens já comprados
    // (histórico) e substitui só os itens em aberto pelo que veio.
    if (Array.isArray(body?.listaCompras)) {
      const comprados = Array.isArray(blob.listaCozinha) ? blob.listaCozinha.filter((i) => i.comprado) : [];
      novoBlob.listaCozinha = [...limparItens(body.listaCompras), ...comprados];
    }
    // Marcar/desmarcar tarefa como feita: só troca o "feito" de tarefas que já
    // existem. A cozinha nunca cria, apaga ou edita o texto (isso é da dona).
    if (body?.tarefasFeito && typeof body.tarefasFeito === 'object') {
      const feitos = body.tarefasFeito;
      const tarefas = Array.isArray(blob.tarefasCozinha) ? blob.tarefasCozinha : [];
      const agora = new Date().toISOString();
      novoBlob.tarefasCozinha = tarefas.map((t) => {
        if (!t || !Object.prototype.hasOwnProperty.call(feitos, t.id)) return t;
        const feito = !!feitos[t.id];
        // Carimba a hora (do servidor) em que a cozinha deu OK; ao desmarcar, limpa.
        return { ...t, feito, feitoEm: feito ? agora : '' };
      });
    }
    const { error: err2 } = await sb.from('pdm_dados').upsert(
      { chave: CHAVE, valor: novoBlob, atualizado_em: new Date().toISOString() },
      { onConflict: 'chave' }
    );
    if (err2) throw err2;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao salvar a lista.' }, { status: 500 });
  }
}
