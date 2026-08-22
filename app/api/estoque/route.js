import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';
import { novoItemEstoque, aplicarMovimentoItem, editarMetadadosItem, aplicarBaixasVendas, aplicarEntradasEstoque, recalcularCustosPelasCompras } from '../../../lib/estoque';
import { limparNome, num } from '../../../lib/util';

export const dynamic = 'force-dynamic';

const PAINEL = 'painel';

// Ler o estoque e mexer no SALDO (entrada/saída/contagem) vale para a dona e a
// cozinha (a cozinha ajuda a cuidar do estoque no dia a dia). Cadastrar, editar,
// excluir itens e mexer nas fichas técnicas é só da dona. O garçom não acessa o
// estoque inteiro (ele vê a disponibilidade por /api/comandas).
function papelAtual() {
  return papelDaSessao(cookies().get(nomeCookie())?.value);
}

async function lerPainel(sb) {
  const { data } = await sb.from('pdm_dados').select('valor').eq('chave', PAINEL).maybeSingle();
  return data?.valor || {};
}

async function gravarEstoque(sb, blob, patch) {
  // Relê o blob MAIS RECENTE agora (não usa a cópia lida no início do request) e
  // troca só as chaves do patch (estoque/fichas/estoqueBaixas). Assim um
  // salvamento paralelo do cardápio/clientes (feito pela dona em outra tela, via
  // /api/data) NÃO é apagado por uma cópia velha — era isso que sumia com o
  // cardápio/combos quando a sincronização do estoque rodava ao mesmo tempo.
  const { data: atual } = await sb.from('pdm_dados').select('valor').eq('chave', PAINEL).maybeSingle();
  const base = (atual?.valor && typeof atual.valor === 'object') ? atual.valor : (blob || {});
  const novo = { ...base, ...patch };
  const { error } = await sb.from('pdm_dados').upsert(
    { chave: PAINEL, valor: novo, atualizado_em: new Date().toISOString() },
    { onConflict: 'chave' }
  );
  if (error) throw error;
  return novo;
}

const arr = (v) => (Array.isArray(v) ? v : []);

export async function GET() {
  const p = papelAtual();
  if (p !== 'dona' && p !== 'cozinha') return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    const blob = await lerPainel(sb);
    // As fichas só interessam à dona; a cozinha recebe só os itens.
    return NextResponse.json({ ok: true, itens: arr(blob.estoque), fichas: p === 'dona' ? arr(blob.fichas) : [] });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao carregar o estoque.' }, { status: 500 });
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
    const blob = await lerPainel(sb);
    let itens = arr(blob.estoque);

    // Movimento de saldo (entrada/saída/contagem): dona OU cozinha.
    if (acao === 'mov') {
      const id = String(body?.id || '');
      const tipo = ['entrada', 'saida', 'contagem'].includes(body?.tipo) ? body.tipo : null;
      if (!id || !tipo) return NextResponse.json({ ok: false, erro: 'Dados do movimento incompletos.' }, { status: 400 });
      let achou = false;
      const quem = p === 'cozinha' ? ' (cozinha)' : '';
      itens = itens.map((it) => { if (it.id !== id) return it; achou = true; return aplicarMovimentoItem(it, tipo, body?.qtd, (body?.motivo || '') + quem); });
      if (!achou) return NextResponse.json({ ok: false, erro: 'Item não encontrado.' }, { status: 404 });
      const novo = await gravarEstoque(sb, blob, { estoque: itens });
      return NextResponse.json({ ok: true, itens: arr(novo.estoque) });
    }

    // A partir daqui, só a dona.
    if (p !== 'dona') return NextResponse.json({ ok: false, erro: 'Essa ação é só da dona.' }, { status: 403 });

    if (acao === 'add') {
      const item = novoItemEstoque(body?.item || {});
      if (!item.nome) return NextResponse.json({ ok: false, erro: 'Informe o nome do item.' }, { status: 400 });
      const jaTem = itens.some((it) => (it.nome || '').trim().toLowerCase() === item.nome.toLowerCase());
      if (jaTem) return NextResponse.json({ ok: true, itens, jaExistia: true });
      itens = [item, ...itens];
      const novo = await gravarEstoque(sb, blob, { estoque: itens });
      return NextResponse.json({ ok: true, itens: arr(novo.estoque), novoId: item.id });
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

    // Apaga UMA linha do histórico de um item (ex.: saída digitada errada). NÃO
    // altera o saldo — o saldo atual continua sendo a verdade (a dona já ajustou
    // com o Contar). Só remove o registro, pra ele parar de contar no resumo.
    if (acao === 'delMov') {
      const id = String(body?.id || '');
      const movId = String(body?.movId || '');
      let achou = false;
      itens = itens.map((it) => {
        if (it.id !== id) return it;
        const movs = (it.movimentos || []).filter((m) => m.id !== movId);
        if (movs.length !== (it.movimentos || []).length) achou = true;
        return { ...it, movimentos: movs };
      });
      if (!achou) return NextResponse.json({ ok: false, erro: 'Movimento não encontrado.' }, { status: 404 });
      const novo = await gravarEstoque(sb, blob, { estoque: itens });
      return NextResponse.json({ ok: true, itens: arr(novo.estoque) });
    }

    // Desfazer (estornar) um movimento: reverte o efeito no saldo E remove a
    // linha. Saída/venda voltam ao estoque; entrada/compra saem. Contagem não dá
    // pra estornar com segurança (não guarda o "antes"), então só é removida.
    if (acao === 'estornarMov') {
      const id = String(body?.id || '');
      const movId = String(body?.movId || '');
      let achou = false;
      itens = itens.map((it) => {
        if (it.id !== id) return it;
        const mov = (it.movimentos || []).find((m) => m.id === movId);
        if (!mov) return it;
        achou = true;
        let saldo = num(it.saldo);
        const q = num(mov.qtd);
        if (mov.tipo === 'saida' || mov.tipo === 'venda') saldo = saldo + q;
        else if (mov.tipo === 'entrada' || mov.tipo === 'compra') saldo = Math.max(0, saldo - q);
        saldo = Math.round(saldo * 1000) / 1000;
        return { ...it, saldo, movimentos: (it.movimentos || []).filter((m) => m.id !== movId) };
      });
      if (!achou) return NextResponse.json({ ok: false, erro: 'Movimento não encontrado.' }, { status: 404 });
      const novo = await gravarEstoque(sb, blob, { estoque: itens });
      return NextResponse.json({ ok: true, itens: arr(novo.estoque) });
    }

    // Corrige custos inflados recalculando pelo preço das Compras (fonte da verdade).
    if (acao === 'corrigirCustos') {
      const r = recalcularCustosPelasCompras(itens, arr(blob.compras));
      if (r.corrigidos > 0) { const novo = await gravarEstoque(sb, blob, { estoque: r.estoque }); return NextResponse.json({ ok: true, itens: arr(novo.estoque), corrigidos: r.corrigidos }); }
      return NextResponse.json({ ok: true, itens, corrigidos: 0 });
    }

    // Entrada automática vinda das Compras.
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

    // Importa um "modelo" de fichas: cria os ingredientes que faltam no estoque
    // e monta as fichas ligando cada prato ao item do CARDÁPIO com o mesmo nome.
    // Genérico: o modelo (ingredientes + fichas) vem do cliente. Não mexe em
    // preço nem cria itens no cardápio — só relata os pratos que não casaram.
    if (acao === 'importarModelo') {
      const norm = (s) => limparNome(s).toLowerCase();
      const ingredientes = arr(body?.ingredientes);
      const fichasModelo = arr(body?.fichas);
      const cardapio = arr(blob.cardapio);

      const idPorNome = new Map(itens.map((it) => [norm(it.nome), it.id]));
      let criados = 0;
      for (const ing of ingredientes) {
        if (!ing?.nome || idPorNome.has(norm(ing.nome))) continue;
        const item = novoItemEstoque({ nome: ing.nome, categoria: ing.categoria || 'Cozinha', unidade: ing.unidade || 'un', conteudo: ing.conteudo, conteudoUnid: ing.conteudoUnid, saldo: 0 });
        itens = [item, ...itens];
        idPorNome.set(norm(item.nome), item.id);
        criados += 1;
      }

      const card = cardapio.map((c) => ({ id: c.id, n: norm(c.nome) }));
      const acharCardapio = (prato) => {
        const p = norm(prato);
        let c = card.find((x) => x.n === p);
        if (c) return c.id;
        c = card.find((x) => x.n && (x.n.includes(p) || p.includes(x.n)));
        return c ? c.id : null;
      };

      let fichas = arr(blob.fichas);
      const naoEncontrados = [];
      let fichasCriadas = 0;
      for (const fm of fichasModelo) {
        const cid = acharCardapio(fm?.prato || '');
        if (!cid) { naoEncontrados.push(fm?.prato || '?'); continue; }
        const itensFicha = arr(fm.itens)
          .map((x) => ({ estoqueId: idPorNome.get(norm(x.ingrediente)), qtd: String(x.qtd), unidade: String(x.unidade || '') }))
          .filter((x) => x.estoqueId);
        if (!itensFicha.length) { naoEncontrados.push((fm?.prato || '?') + ' (sem ingredientes)'); continue; }
        fichas = [...fichas.filter((f) => f.cardapioId !== cid), { cardapioId: cid, itens: itensFicha }];
        fichasCriadas += 1;
      }

      const novo = await gravarEstoque(sb, blob, { estoque: itens, fichas });
      return NextResponse.json({ ok: true, itens: arr(novo.estoque), fichas: arr(novo.fichas), report: { criados, fichasCriadas, naoEncontrados, cardapioVazio: cardapio.length === 0 } });
    }

    // Reconciliação: baixa qualquer venda ainda não processada (rede de segurança).
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
