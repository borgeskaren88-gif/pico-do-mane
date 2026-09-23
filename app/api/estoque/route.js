import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';
import { novoItemEstoque, aplicarMovimentoItem, editarMetadadosItem, aplicarBaixasVendas, aplicarEntradasEstoque, recalcularCustosPelasCompras, resolverCompraNoEstoque, fundirItens, repontarFichas, repontarCompras, comprasPendentesDeEstoque, igualNome, ehPorcionado } from '../../../lib/estoque';
import { separarSacos, abastecerLinha, contarPorcao } from '../../../lib/porcoes';
import { limparNome, num, numQtd, todayISO } from '../../../lib/util';
import { notificarEstoqueCritico, notificarSaidaSemVenda } from '../../../lib/push';

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
  // `patch` pode ser uma FUNÇÃO, e aí ela é aplicada sobre o blob FRESCO.
  // Isso é obrigatório pra quem reescreve uma lista inteira (compras, fichas):
  // montar a lista a partir da cópia lida no começo do request apagaria o que
  // foi salvo em paralelo por /api/data entre as duas leituras — uma compra
  // registrada nesse intervalo sumia das Contas a Pagar.
  const novo = { ...base, ...(typeof patch === 'function' ? patch(base) : patch) };
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
    return NextResponse.json({
      ok: true,
      itens: arr(blob.estoque),
      fichas: p === 'dona' ? arr(blob.fichas) : [],
      duplicadosIgnorados: p === 'dona' ? arr(blob.duplicadosIgnorados) : [],
    });
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
      // Item porcionado mora em dois freezers, e o saldo dele é a SOMA dos
      // dois. Uma entrada ou contagem por aqui mexeria só no total e deixaria
      // os dois freezers dizendo outra coisa — o saldo discordaria de si mesmo,
      // e todo aviso da cozinha nasceria errado a partir daí.
      const alvoMov = itens.find((it) => it.id === id);
      if (ehPorcionado(alvoMov)) {
        return NextResponse.json({ ok: false, erro: 'Esse item é separado em sacos. Use Separei / Levei pra frente / Contei.' }, { status: 400 });
      }
      let achou = false;
      const quem = p === 'cozinha' ? ' (cozinha)' : '';
      // Saída lançada pela COZINHA é sempre Desperdício, decidido aqui e não na
      // tela. Eles perdiam carne na limpeza e marcavam "Consumo da casa" (que
      // era a primeira opção da lista), e aí a perda sumia do balde de perdas.
      // Consumo da casa e cortesia são decisão da dona — ela lança na tela dela.
      const motivo = (p === 'cozinha' && tipo === 'saida') ? 'Desperdício' : String(body?.motivo || '');
      itens = itens.map((it) => { if (it.id !== id) return it; achou = true; return aplicarMovimentoItem(it, tipo, body?.qtd, motivo + quem, body?.validade); });
      if (!achou) return NextResponse.json({ ok: false, erro: 'Item não encontrado.' }, { status: 404 });
      const novo = await gravarEstoque(sb, blob, { estoque: itens });
      // Saída/contagem podem zerar um item: avisa na hora se cruzou pro mínimo/zero.
      if (tipo === 'saida' || tipo === 'contagem') { try { await notificarEstoqueCritico(sb, arr(blob.estoque), itens); } catch (e) { /* push nunca quebra o movimento */ } }
      // Perda, quebra e vencido também avisam na hora — saída sem venda é a que
      // mais come margem calada.
      if (tipo === 'saida' && /(desperd|vencid|quebr|perda)/i.test(motivo)) {
        try {
          const it = itens.find((x) => x.id === id);
          await notificarSaidaSemVenda(sb, {
            titulo: `${motivo || 'Perda'}: ${limparNome(it?.nome)}`,
            descricao: `${num(body?.qtd)} ${it?.unidade || 'un'}${quem ? ' ·' + quem : ''}`,
            valor: num(body?.qtd) * num(it?.custo),
          });
        } catch (e) { /* push nunca quebra o movimento */ }
      }
      return NextResponse.json({ ok: true, itens: arr(novo.estoque) });
    }

    // VÁRIAS ENTRADAS DE UMA VEZ (é o que a entrada por voz usa).
    //
    // Uma chamada por linha faria N gravações do painel inteiro, e duas delas
    // se atropelando perderiam a primeira. Aqui tudo entra numa gravação só.
    if (acao === 'movLote') {
      const entradas = arr(body?.entradas)
        .map((e) => ({ id: String(e?.id || ''), qtd: numQtd(e?.qtd), validade: String(e?.validade || '') }))
        .filter((e) => e.id && e.qtd > 0);
      if (!entradas.length) return NextResponse.json({ ok: false, erro: 'Nenhuma entrada pra lançar.' }, { status: 400 });

      const quem = p === 'cozinha' ? ' (cozinha)' : '';
      const motivo = (String(body?.motivo || '').trim() || 'Entrada por voz') + quem;
      const feitas = [];
      // Aplica uma a uma, em ordem: duas linhas do MESMO item viram dois
      // movimentos somando, e não uma sobrescrevendo a outra.
      for (const e of entradas) {
        let achou = false;
        itens = itens.map((it) => {
          if (it.id !== e.id) return it;
          achou = true;
          return aplicarMovimentoItem(it, 'entrada', e.qtd, motivo, e.validade);
        });
        if (achou) feitas.push(e);
      }
      if (!feitas.length) return NextResponse.json({ ok: false, erro: 'Nenhum dos itens foi encontrado.' }, { status: 404 });

      const novo = await gravarEstoque(sb, blob, { estoque: itens });
      return NextResponse.json({
        ok: true,
        itens: arr(novo.estoque),
        lancadas: feitas.length,
        resumo: feitas.map((e) => {
          const it = itens.find((x) => x.id === e.id);
          return { nome: limparNome(it?.nome), qtd: e.qtd, unidade: it?.unidade || 'un', saldo: num(it?.saldo) };
        }),
      });
    }

    // OS TRÊS MOVIMENTOS DO PORCIONAMENTO — dona OU cozinha.
    //
    // Quem separa e quem abastece é a cozinha; a dona também mexe porque é ela
    // que confere. Os três assinam quem fez: o pedido era "pra eu poder
    // cobrar", e cobrar sem registro é memória contra memória.
    if (acao === 'porcaoSeparar' || acao === 'porcaoAbastecer' || acao === 'porcaoContar') {
      const id = String(body?.id || '');
      const alvo = itens.find((it) => it.id === id);
      if (!alvo) return NextResponse.json({ ok: false, erro: 'Item não encontrado.' }, { status: 404 });
      if (!ehPorcionado(alvo)) return NextResponse.json({ ok: false, erro: 'Esse item não é separado em sacos.' }, { status: 400 });
      const quem = p === 'cozinha' ? 'Cozinha' : 'Karen';

      let r = null;
      let brutoNovo = null;
      if (acao === 'porcaoSeparar') {
        const bruto = itens.find((it) => it.id === alvo.separar.brutoId);
        if (!bruto) return NextResponse.json({ ok: false, erro: 'O pacote fechado desse item não está mais no estoque.' }, { status: 400 });
        r = separarSacos(alvo, bruto, body?.sacos, quem);
        if (r) brutoNovo = r.bruto;
      } else if (acao === 'porcaoAbastecer') {
        r = abastecerLinha(alvo, body?.sacos, quem);
        if (!r) return NextResponse.json({ ok: false, erro: 'O Salva-Vidas está vazio — não tem o que levar pra frente.' }, { status: 400 });
      } else {
        r = contarPorcao(alvo, body?.linha, body?.salva, quem);
      }
      if (!r) return NextResponse.json({ ok: false, erro: 'Não consegui registrar. Confere a quantidade.' }, { status: 400 });

      // Os dois itens trocam na MESMA gravação: separar tira do pacote e põe no
      // freezer, e meio movimento gravado seria comida sumindo do sistema.
      itens = itens.map((it) => (it.id === r.item.id ? r.item : (brutoNovo && it.id === brutoNovo.id ? brutoNovo : it)));
      const novo = await gravarEstoque(sb, blob, { estoque: itens });
      // Separar consome o pacote fechado: é a hora certa de avisar que ele
      // cruzou o mínimo, porque é agora que dá tempo de comprar.
      if (brutoNovo) { try { await notificarEstoqueCritico(sb, arr(blob.estoque), itens); } catch (e) { /* push nunca quebra o movimento */ } }
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
      const comprasNovas = arr(body?.comprasNovas);
      const novoEstoque = aplicarEntradasEstoque(itens, comprasNovas);
      // Quais produtos comprados NÃO acharam um item de estoque com o mesmo nome
      // (por isso não entraram sozinhos). Serve pra avisar a dona.
      const naoEntraram = [...new Set(
        comprasNovas
          .filter((c) => num(c.quantidade) > 0 && !resolverCompraNoEstoque(c, itens))
          .map((c) => limparNome(c.produto)).filter(Boolean)
      )];
      if (novoEstoque !== itens) { const novo = await gravarEstoque(sb, blob, { estoque: novoEstoque }); return NextResponse.json({ ok: true, itens: arr(novo.estoque), naoEntraram }); }
      return NextResponse.json({ ok: true, itens, naoEntraram });
    }

    // Lança no estoque compras que já estão registradas mas nunca viraram
    // saldo. Ela aperta um botão em vez de digitar a nota de novo.
    if (acao === 'lancarCompras') {
      if (p !== 'dona') return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 403 });
      const ids = new Set(arr(body?.ids).map(String));
      const todas = arr(blob.compras);
      // Recalcula as pendentes AQUI, no servidor, com o estoque de agora. Se a
      // tela estiver um passo atrás (ou ela tocar duas vezes), o que já entrou
      // não entra de novo.
      const pendentes = comprasPendentesDeEstoque(todas, itens).filter((x) => ids.has(String(x.compra.id)));
      if (!pendentes.length) return NextResponse.json({ ok: true, itens, lancadas: 0 });
      const novoEstoque = aplicarEntradasEstoque(itens, pendentes.map((x) => x.compra));
      const marcadas = new Set(pendentes.map((x) => String(x.compra.id)));
      // Carimba sobre a lista FRESCA: uma compra registrada enquanto isto rodava
      // não pode sumir porque a nossa cópia é de segundos atrás.
      const novo = await gravarEstoque(sb, blob, (base) => ({
        estoque: novoEstoque,
        compras: arr(base.compras).map((c) => (c && marcadas.has(String(c.id)) ? { ...c, estoqueEm: todayISO() } : c)),
      }));
      return NextResponse.json({
        ok: true, itens: arr(novo.estoque), compras: arr(novo.compras),
        lancadas: pendentes.length,
        resumo: pendentes.map((x) => ({ produto: limparNome(x.compra.produto), item: x.item.nome, qtd: x.entrada.qtd, unidade: x.item.unidade || 'un' })),
      });
    }

    // Dispensar: marca a compra como resolvida SEM tocar no saldo. É pra compra
    // antiga que ela já deu entrada na mão — o aviso some e o estoque fica como
    // está. Guarda o motivo, pra depois dar pra saber por que aquela linha não
    // tem movimento correspondente.
    if (acao === 'dispensarCompras') {
      if (p !== 'dona') return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 403 });
      const ids = new Set(arr(body?.ids).map(String));
      if (!ids.size) return NextResponse.json({ ok: true, itens, dispensadas: 0 });
      const alvo = arr(blob.compras).filter((c) => c && !c.estoqueEm && ids.has(String(c.id))).map((c) => String(c.id));
      if (!alvo.length) return NextResponse.json({ ok: true, itens, dispensadas: 0 });
      const marcar = new Set(alvo);
      const novo = await gravarEstoque(sb, blob, (base) => ({
        compras: arr(base.compras).map((c) => (c && marcar.has(String(c.id)) ? { ...c, estoqueEm: todayISO(), estoqueDispensada: true } : c)),
      }));
      const n = alvo.length;
      return NextResponse.json({ ok: true, itens, compras: arr(novo.compras), dispensadas: n });
    }

    // Pente fino: junta itens repetidos num só. Mexe em receita e em compra,
    // então é só da dona.
    if (acao === 'fundir') {
      if (p !== 'dona') return NextResponse.json({ ok: false, erro: 'Só a dona pode juntar itens.' }, { status: 403 });
      const principalId = String(body?.principalId || '');
      const absorvidos = arr(body?.absorvidos).map(String);
      const r = fundirItens(itens, arr(blob.fichas), arr(blob.compras), principalId, absorvidos);
      if (!r.fundidos) return NextResponse.json({ ok: true, itens, fundidos: 0, naoDeu: r.naoDeu });
      // Refaz o reaponte sobre as listas FRESCAS (ver gravarEstoque).
      const novo = await gravarEstoque(sb, blob, (base) => ({
        estoque: r.estoque,
        fichas: repontarFichas(arr(base.fichas), r.absorvidos, principalId),
        compras: repontarCompras(arr(base.compras), r.absorvidos, principalId),
      }));
      return NextResponse.json({ ok: true, itens: arr(novo.estoque), fichas: arr(novo.fichas), compras: arr(novo.compras), fundidos: r.fundidos, naoDeu: r.naoDeu });
    }

    // "Esses dois são parecidos mas não são a mesma coisa" — pra o aviso não
    // voltar toda vez que ela abrir a tela.
    if (acao === 'ignorarDuplicado') {
      if (p !== 'dona') return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 403 });
      const chave = String(body?.chave || '');
      if (!chave) return NextResponse.json({ ok: false, erro: 'Grupo inválido.' }, { status: 400 });
      const atuais = arr(blob.duplicadosIgnorados).map(String);
      const novo = await gravarEstoque(sb, blob, { duplicadosIgnorados: [...new Set([...atuais, chave])] });
      return NextResponse.json({ ok: true, itens, duplicadosIgnorados: arr(novo.duplicadosIgnorados) });
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
        if (r.mudou) { try { await notificarEstoqueCritico(sb, itens, r.estoque); } catch (e) { /* push nunca quebra a sincronização */ } }
        return NextResponse.json({ ok: true, itens: arr(novo.estoque), fichas: arr(novo.fichas), resumo: r.resumo });
      }
      return NextResponse.json({ ok: true, itens, fichas: arr(blob.fichas), resumo: r.resumo });
    }

    return NextResponse.json({ ok: false, erro: 'Ação inválida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao salvar o estoque.' }, { status: 500 });
  }
}
