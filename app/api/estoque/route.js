import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';
import { novoItemEstoque, aplicarMovimentoItem, editarMetadadosItem, aplicarBaixasVendas, aplicarEntradasEstoque } from '../../../lib/estoque';

export const dynamic = 'force-dynamic';

const PAINEL = 'painel';

// O catálogo e as fichas são da dona. O garçom vê a disponibilidade por outro
// caminho (dentro de /api/comandas), sem acesso ao estoque inteiro.
function ehDona() {
  return papelDaSessao(cookies().get(nomeCookie())?.value) === 'dona';
}

async function lerPainel(sb) {
  const { data } = await sb.from('pdm_dados').select('valor').eq('chave', PAINEL).maybeSingle();
  return data?.valor || {};
}

// Grava de volta SÓ as chaves do estoque, preservando todo o resto do painel
// (read-modify-write). Assim edições do estoque não brigam com outros dados.
async function gravarEstoque(sb, blob, patch) {
  const novo = { ...blob, ...patch };
  const { error } = await sb.from('pdm_dados').upsert(
    { chave: PAINEL, valor: novo, atualizado_em: new Date().toISOString() },
    { onConflict: 'chave' }
  );
  if (error) throw error;
  return novo;
}

const arr = (v) => (Array.isArray(v) ? v : []);

export async function GET() {
  if (!ehDona()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    const blob = await lerPainel(sb);
    return NextResponse.json({ ok: true, itens: arr(blob.estoque), fichas: arr(blob.fichas) });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao carregar o estoque.' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!ehDona()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }
  const acao = String(body?.acao || '');
  try {
    const sb = supabaseServer();
    const blob = await lerPainel(sb);
    let itens = arr(blob.estoque);

    if (acao === 'add') {
      const item = novoItemEstoque(body?.item || {});
      if (!item.nome) return NextResponse.json({ ok: false, erro: 'Informe o nome do item.' }, { status: 400 });
      // Evita duplicar por nome.
      const jaTem = itens.some((it) => (it.nome || '').trim().toLowerCase() === item.nome.toLowerCase());
      if (jaTem) return NextResponse.json({ ok: true, itens, jaExistia: true });
      itens = [item, ...itens];
      const novo = await gravarEstoque(sb, blob, { estoque: itens });
      return NextResponse.json({ ok: true, itens: arr(novo.estoque), novoId: item.id });
    }

    if (acao === 'mov') {
      const id = String(body?.id || '');
      const tipo = ['entrada', 'saida', 'contagem'].includes(body?.tipo) ? body.tipo : null;
      if (!id || !tipo) return NextResponse.json({ ok: false, erro: 'Dados do movimento incompletos.' }, { status: 400 });
      let achou = false;
      itens = itens.map((it) => { if (it.id !== id) return it; achou = true; return aplicarMovimentoItem(it, tipo, body?.qtd, body?.motivo); });
      if (!achou) return NextResponse.json({ ok: false, erro: 'Item não encontrado.' }, { status: 404 });
      const novo = await gravarEstoque(sb, blob, { estoque: itens });
      return NextResponse.json({ ok: true, itens: arr(novo.estoque) });
    }

    if (acao === 'edit') {
      const id = String(body?.id || '');
      let achou = false;
      itens = itens.map((it) => { if (it.id !== id) return it; achou = true; return editarMetadadosItem(it, body?.campos || {}); });
      if (!achou) return NextResponse.json({ ok: false, erro: 'Item não encontrado.' }, { status: 404 });
      const novo = await gravarEstoque(sb, blob, { estoque: itens });
      return NextResponse.json({ ok: true, itens: arr(novo.estoque) });
    }

    if (acao === 'del') {
      const id = String(body?.id || '');
      itens = itens.filter((it) => it.id !== id);
      const novo = await gravarEstoque(sb, blob, { estoque: itens });
      return NextResponse.json({ ok: true, itens: arr(novo.estoque) });
    }

    // Entrada automática vinda das Compras: soma no saldo dos itens já
    // cadastrados (itens não cadastrados são ignorados -> viram sugestão).
    if (acao === 'entradaCompras') {
      const novoEstoque = aplicarEntradasEstoque(itens, arr(body?.comprasNovas));
      if (novoEstoque !== itens) { const novo = await gravarEstoque(sb, blob, { estoque: novoEstoque }); return NextResponse.json({ ok: true, itens: arr(novo.estoque) }); }
      return NextResponse.json({ ok: true, itens });
    }

    if (acao === 'fichas') {
      const fichas = arr(body?.fichas).filter((f) => f && f.cardapioId).map((f) => ({ cardapioId: String(f.cardapioId), itens: arr(f.itens).map((x) => ({ estoqueId: String(x.estoqueId), qtd: String(x.qtd), unidade: String(x.unidade || '') })) }));
      const novo = await gravarEstoque(sb, blob, { fichas });
      return NextResponse.json({ ok: true, fichas: arr(novo.fichas) });
    }

    // Reconciliação: baixa qualquer venda que ainda não foi processada (rede de
    // segurança caso a baixa no fechamento da comanda tenha falhado).
    if (acao === 'sincronizar') {
      const { data: vrows } = await sb.from('pdm_dados').select('valor').like('chave', 'venda:%');
      const vendas = (vrows || []).map((r) => r.valor).filter(Boolean);
      const r = aplicarBaixasVendas(itens, arr(blob.fichas), vendas, arr(blob.estoqueBaixas));
      if (r.mudou || r.baixadas !== arr(blob.estoqueBaixas)) {
        const novo = await gravarEstoque(sb, blob, { estoque: r.estoque, estoqueBaixas: r.baixadas });
        return NextResponse.json({ ok: true, itens: arr(novo.estoque), fichas: arr(novo.fichas), resumo: r.resumo });
      }
      return NextResponse.json({ ok: true, itens, fichas: arr(blob.fichas), resumo: r.resumo });
    }

    return NextResponse.json({ ok: false, erro: 'Ação inválida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao salvar o estoque.' }, { status: 500 });
  }
}
