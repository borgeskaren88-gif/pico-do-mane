import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';
import { disponibilidadeCardapio, aplicarBaixasVendas, aplicarMovimentoItem, qtdNaUnidadeDoItem } from '../../../lib/estoque';
import { num, limparNome, fiadoDaVenda, abertoDaVenda, brl } from '../../../lib/util';
import { enviarPush } from '../../../lib/push';

export const dynamic = 'force-dynamic';

const arr = (v) => (Array.isArray(v) ? v : []);

const PAINEL = 'painel';
const PREFIXO = 'comanda:';

// Só a dona e o garçom mexem em comandas. A cozinha não (ela não vê valores).
function papel() {
  const p = papelDaSessao(cookies().get(nomeCookie())?.value);
  return p === 'dona' || p === 'garcom' ? p : null;
}

const txt = (v, max) => String(v == null ? '' : v).slice(0, max).trim();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const chaveDe = (id) => PREFIXO + id;
// Data de hoje no fuso do Brasil (senão à noite o UTC vira o dia seguinte).
const hojeBrasil = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

async function lerPainel(sb) {
  const { data } = await sb.from('pdm_dados').select('valor').eq('chave', PAINEL).maybeSingle();
  return data?.valor || {};
}
async function lerCardapio(sb) {
  const blob = await lerPainel(sb);
  return Array.isArray(blob.cardapio) ? blob.cardapio : [];
}
// Nº de mesas do salão (configurável pela dona). Padrão 20.
function mesasDe(blob) {
  const n = Math.floor(Number(blob?.mesasQtd));
  return n >= 1 && n <= 80 ? n : 20;
}

async function lerComanda(sb, id) {
  const { data } = await sb.from('pdm_dados').select('valor').eq('chave', chaveDe(id)).maybeSingle();
  return data?.valor || null;
}

// Grava SÓ algumas chaves do painel (estoque/clientes/mesasQtd…), relendo o
// blob mais recente na hora da gravação. Assim não apaga cardápio/clientes que a
// dona salvou em paralelo por outra tela (bug do cardápio que sumia).
async function gravarPainelParcial(sb, patch) {
  const { data } = await sb.from('pdm_dados').select('valor').eq('chave', PAINEL).maybeSingle();
  const base = (data?.valor && typeof data.valor === 'object') ? data.valor : {};
  const { error } = await sb.from('pdm_dados').upsert(
    { chave: PAINEL, valor: { ...base, ...patch }, atualizado_em: new Date().toISOString() },
    { onConflict: 'chave' }
  );
  if (error) throw error;
}

async function gravarComanda(sb, c) {
  const { error } = await sb.from('pdm_dados').upsert(
    { chave: chaveDe(c.id), valor: c, atualizado_em: new Date().toISOString() },
    { onConflict: 'chave' }
  );
  if (error) throw error;
}

// Total da comanda (qtd x preço de cada item).
function totalDe(c) {
  return (c.itens || []).reduce((s, it) => s + (Number(it.qtd) || 0) * (Number(it.preco) || 0), 0);
}

export async function GET() {
  if (!papel()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    const { data, error } = await sb.from('pdm_dados').select('valor').like('chave', PREFIXO + '%');
    if (error) throw error;
    const comandas = (data || [])
      .map((r) => r.valor)
      .filter((c) => c && c.status === 'aberta')
      .sort((a, b) => Number(a.mesa) - Number(b.mesa) || (a.abertaEm || '').localeCompare(b.abertaEm || ''));
    const blob = await lerPainel(sb);
    const cardapioAtivo = (Array.isArray(blob.cardapio) ? blob.cardapio : []).filter((i) => i && i.ativo !== false);
    // Disponibilidade de cada item (via fichas técnicas + estoque), pra avisar o
    // garçom o que está em falta/acabando. disp = null quando não há ficha.
    const disp = disponibilidadeCardapio(cardapioAtivo, arr(blob.fichas), arr(blob.estoque));
    const cardapio = cardapioAtivo.map((i) => ({ ...i, disp: disp[i.id] ? disp[i.id].disp : null }));
    // Só os nomes dos clientes, pro seletor de "quem ficou devendo" no fiado.
    const clientes = (Array.isArray(blob.clientes) ? blob.clientes : []).map((c) => (c && c.nome ? String(c.nome) : '')).filter(Boolean).sort((a, b) => a.localeCompare(b));
    // Itens do estoque (só nome/unidade, SEM custo/saldo) pro garçom registrar
    // perda/quebra sem ver os números do bar.
    const estoqueItens = (Array.isArray(blob.estoque) ? blob.estoque : [])
      .map((it) => ({ id: it.id, nome: it.nome, unidade: it.unidade || 'un', categoria: it.categoria || '' }))
      .filter((it) => it.id && it.nome)
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    return NextResponse.json({ ok: true, comandas, cardapio, mesasQtd: mesasDe(blob), clientes, estoqueItens });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao carregar comandas.' }, { status: 500 });
  }
}

export async function POST(request) {
  const p = papel();
  if (!p) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }
  const acao = txt(body?.acao, 20);
  try {
    const sb = supabaseServer();

    // Configurar o nº de mesas do salão (só a dona). Preserva o resto do painel.
    if (acao === 'config') {
      if (p !== 'dona') return NextResponse.json({ ok: false, erro: 'Só a dona configura as mesas.' }, { status: 403 });
      const n = Math.floor(Number(body?.mesasQtd));
      if (!(n >= 1 && n <= 80)) return NextResponse.json({ ok: false, erro: 'Número de mesas inválido (1 a 80).' }, { status: 400 });
      await gravarPainelParcial(sb, { mesasQtd: n });
      return NextResponse.json({ ok: true, mesasQtd: n });
    }

    // Abrir uma comanda numa mesa. Se a mesa já tem comanda aberta, devolve ela
    // (não duplica a mesa).
    if (acao === 'abrir') {
      const mesa = txt(body?.mesa, 20);
      if (!mesa) return NextResponse.json({ ok: false, erro: 'Informe a mesa.' }, { status: 400 });
      const { data } = await sb.from('pdm_dados').select('valor').like('chave', PREFIXO + '%');
      const existente = (data || []).map((r) => r.valor).find((c) => c && c.status === 'aberta' && String(c.mesa) === String(mesa));
      if (existente) return NextResponse.json({ ok: true, comanda: existente, jaExistia: true });
      const comanda = { id: uid(), mesa, status: 'aberta', itens: [], abertaEm: new Date().toISOString(), abertaPor: p };
      await gravarComanda(sb, comanda);
      return NextResponse.json({ ok: true, comanda });
    }

    // Salvar um nome novo na lista de clientes (usado quando fecha um fiado com
    // um nome que ainda não está cadastrado). Não duplica se já existir.
    if (acao === 'novoCliente') {
      const nome = txt(body?.nome, 60);
      if (!nome) return NextResponse.json({ ok: false, erro: 'Informe o nome.' }, { status: 400 });
      const norm = (s) => (s || '').trim().toLowerCase();
      const blob = await lerPainel(sb);
      const clientes = Array.isArray(blob.clientes) ? blob.clientes : [];
      if (clientes.some((cli) => norm(cli?.nome) === norm(nome))) {
        return NextResponse.json({ ok: true, jaExistia: true });
      }
      const novo = { id: uid(), nome, telefone: '', limite: '', bloquear: false };
      await gravarPainelParcial(sb, { clientes: [novo, ...clientes] });
      return NextResponse.json({ ok: true, cliente: novo });
    }

    // Registrar perda/quebra: o garçom (ou a dona) baixa um item do estoque por
    // perda (quebrou, congelou, estragou, venceu). Não vira venda nem toca no
    // caixa/DRE — é só ajuste do estoque, com o motivo no histórico do item.
    if (acao === 'perda') {
      const itemId = txt(body?.itemId, 40);
      const qtd = Number(body?.qtd);
      const motivo = (txt(body?.motivo, 40) || 'Perda');
      if (!itemId || !(qtd > 0)) return NextResponse.json({ ok: false, erro: 'Escolha o item e diga quanto se perdeu.' }, { status: 400 });
      const blob = await lerPainel(sb);
      const estoque = Array.isArray(blob.estoque) ? blob.estoque : [];
      let achou = false;
      const novos = estoque.map((it) => { if (it.id !== itemId) return it; achou = true; return aplicarMovimentoItem(it, 'saida', qtd, motivo + ' (atendimento)'); });
      if (!achou) return NextResponse.json({ ok: false, erro: 'Item não encontrado no estoque.' }, { status: 404 });
      await gravarPainelParcial(sb, { estoque: novos });
      return NextResponse.json({ ok: true });
    }

    // Cortesia: um produto do CARDÁPIO liberado de graça. Baixa os ingredientes
    // da ficha técnica (igual a uma venda), com motivo "Cortesia · <prato>". Não
    // vira venda nem toca no caixa/DRE — é só ajuste do estoque.
    if (acao === 'cortesia') {
      const cardapioId = txt(body?.cardapioId, 40);
      const qtd = Math.max(1, Math.floor(Number(body?.qtd) || 1));
      // Motivo: 'Cortesia' (padrão) ou 'Consumo da casa'. Vai no histórico e
      // manda a baixa pra categoria certa do resumo "Para onde foi".
      const motivoBase = txt(body?.motivo, 30) === 'Consumo da casa' ? 'Consumo da casa' : 'Cortesia';
      if (!cardapioId) return NextResponse.json({ ok: false, erro: 'Escolha o produto.' }, { status: 400 });
      const blob = await lerPainel(sb);
      const estoque = Array.isArray(blob.estoque) ? blob.estoque : [];
      const fichas = Array.isArray(blob.fichas) ? blob.fichas : [];
      const cardapio = Array.isArray(blob.cardapio) ? blob.cardapio : [];
      const ficha = fichas.find((f) => f.cardapioId === cardapioId);
      const prato = cardapio.find((c) => c.id === cardapioId)?.nome || motivoBase;
      if (!ficha || !Array.isArray(ficha.itens) || !ficha.itens.length) {
        return NextResponse.json({ ok: false, erro: `"${prato}" não tem ficha técnica, então não dá pra baixar os ingredientes. A dona precisa montar a ficha primeiro.` }, { status: 400 });
      }
      const novoEstoque = estoque.slice();
      const motivo = `${motivoBase} · ${prato}`;
      let mudou = false;
      for (const ing of ficha.itens) {
        const idx = novoEstoque.findIndex((x) => x.id === ing.estoqueId);
        if (idx < 0) continue;
        const baixa = qtd * qtdNaUnidadeDoItem(ing.qtd, ing.unidade, novoEstoque[idx]);
        if (!(baixa > 0)) continue;
        novoEstoque[idx] = aplicarMovimentoItem(novoEstoque[idx], 'saida', baixa, motivo);
        mudou = true;
      }
      if (!mudou) return NextResponse.json({ ok: false, erro: 'Não achei ingredientes pra baixar (confira a ficha).' }, { status: 400 });
      await gravarPainelParcial(sb, { estoque: novoEstoque });
      return NextResponse.json({ ok: true, prato });
    }

    // Ações que mexem numa comanda existente: sempre lê -> altera -> grava
    // (read-modify-write), pra dois garçons na mesma mesa não apagarem o item
    // um do outro.
    const id = txt(body?.comandaId, 40);
    if (!id) return NextResponse.json({ ok: false, erro: 'Comanda não informada.' }, { status: 400 });
    const c = await lerComanda(sb, id);
    if (!c || c.status !== 'aberta') return NextResponse.json({ ok: false, erro: 'Comanda não encontrada ou já fechada.' }, { status: 404 });
    c.itens = Array.isArray(c.itens) ? c.itens : [];

    if (acao === 'add') {
      // O preço vem SEMPRE do cardápio no servidor (não do cliente), pra ninguém
      // adulterar valor. Item repetido só soma a quantidade.
      const cardapioId = txt(body?.cardapioId, 40);
      const saborNome = txt(body?.sabor, 40);
      const cardapio = await lerCardapio(sb);
      const prod = cardapio.find((x) => x && x.id === cardapioId);
      if (!prod) return NextResponse.json({ ok: false, erro: 'Item não está no cardápio.' }, { status: 400 });
      const preco = Number(String(prod.preco).replace(/\./g, '').replace(',', '.')) || 0;
      // Sabor/variação: se o item tem sabores, guarda a escolha em "extras" pra
      // baixar do estoque no fechamento. Dois modos:
      //  - Combo com saboresTotal > 0: o garçom distribui N unidades entre os
      //    sabores (ex.: 3 Tropical + 2 Melancia = 5). Baixa a soma de cada.
      //  - Sabor único (saboresTotal vazio): escolhe 1 sabor (ex.: caipirinha).
      // qStr em vírgula pra o num() ler certo (evita "1.5" virar milhar).
      const qStr = (v) => String(v).replace('.', ',');
      const temSabores = Array.isArray(prod.sabores) && prod.sabores.length;
      const total = Math.floor(Number(prod.saboresTotal) || 0);
      let sabor, extras, mergeKey = '';
      if (temSabores && total > 0) {
        const dist = (body && typeof body.saboresQtd === 'object' && body.saboresQtd) ? body.saboresQtd : {};
        const escolhidos = prod.sabores
          .map((s) => ({ s, n: Math.max(0, Math.floor(Number(dist[s.nome]) || 0)) }))
          .filter((x) => x.n > 0);
        const soma = escolhidos.reduce((a, x) => a + x.n, 0);
        if (soma !== total) return NextResponse.json({ ok: false, erro: `Escolha ${total} no total (você marcou ${soma}).` }, { status: 400 });
        extras = escolhidos.map((x) => ({ estoqueId: String(x.s.estoqueId), qtd: qStr(num(x.s.qtd) * x.n), unidade: String(x.s.unidade || '') }));
        sabor = escolhidos.map((x) => `${x.n} ${x.s.nome}`).join(', ');
        mergeKey = null; // cada distribuição é uma linha própria (nunca junta)
      } else if (temSabores) {
        const s = prod.sabores.find((x) => (x.nome || '').trim().toLowerCase() === saborNome.trim().toLowerCase());
        if (!s) return NextResponse.json({ ok: false, erro: 'Escolha o sabor.' }, { status: 400 });
        sabor = s.nome;
        extras = [{ estoqueId: String(s.estoqueId), qtd: String(s.qtd), unidade: String(s.unidade || '') }];
        mergeKey = sabor;
      }
      const nomeItem = txt(prod.nome, 200) + (sabor ? ` (${sabor})` : '');
      const existe = mergeKey != null ? c.itens.find((it) => it.cardapioId === cardapioId && (it.sabor || '') === mergeKey) : null;
      if (existe) existe.qtd = (Number(existe.qtd) || 0) + 1;
      else c.itens.push({ id: uid(), cardapioId, nome: nomeItem, preco, qtd: 1, ...(sabor ? { sabor, extras } : {}) });
      await gravarComanda(sb, c);
      return NextResponse.json({ ok: true, comanda: c });
    }

    if (acao === 'setQtd') {
      const itemId = txt(body?.itemId, 40);
      const qtd = Math.max(0, Math.floor(Number(body?.qtd) || 0));
      c.itens = qtd <= 0 ? c.itens.filter((it) => it.id !== itemId) : c.itens.map((it) => (it.id === itemId ? { ...it, qtd } : it));
      await gravarComanda(sb, c);
      return NextResponse.json({ ok: true, comanda: c });
    }

    if (acao === 'remover') {
      const itemId = txt(body?.itemId, 40);
      c.itens = c.itens.filter((it) => it.id !== itemId);
      await gravarComanda(sb, c);
      return NextResponse.json({ ok: true, comanda: c });
    }

    // Infos da mesa: nome do cliente, nº de pessoas, observação. Só grava o que
    // vier no corpo (deixa o resto como estava).
    if (acao === 'infos') {
      if ('nome' in body) c.nome = txt(body?.nome, 60);
      if ('obs' in body) c.obs = txt(body?.obs, 200);
      if ('pessoas' in body) { const n = Math.floor(Number(body?.pessoas)); c.pessoas = n >= 1 && n <= 99 ? n : 0; }
      if ('servico' in body) c.servico = !!body.servico; // taxa de 10% liga/desliga
      await gravarComanda(sb, c);
      return NextResponse.json({ ok: true, comanda: c });
    }

    // Fechar a conta: vira uma "venda do salão" (registro próprio, chave
    // venda:<id>) e libera a mesa. A venda é somada como receita no financeiro
    // da dona, sem entrar na lista que ela digita à mão (não tem risco de um
    // salvamento apagar o outro).
    if (acao === 'fechar') {
      const subtotal = totalDe(c);
      if (subtotal <= 0) return NextResponse.json({ ok: false, erro: 'Comanda sem consumo. Use cancelar.' }, { status: 400 });
      // Taxa de serviço (10%): ligada por padrão; a dona/garçom pode tirar na mesa.
      const servicoOn = c.servico !== false;
      const servico = servicoOn ? Math.round(subtotal * 0.10 * 100) / 100 : 0;
      const totalBruto = Math.round((subtotal + servico) * 100) / 100;
      // Desconto (%) dado na hora de fechar. Abate do total; o que o cliente
      // paga (e o que as formas de pagamento têm que somar) é o total já com desconto.
      const descontoPct = Math.max(0, Math.min(100, Number(body?.descontoPct) || 0));
      const desconto = Math.round(totalBruto * descontoPct / 100 * 100) / 100;
      const total = Math.round((totalBruto - desconto) * 100) / 100;
      const pessoas = Math.max(1, Math.floor(Number(body?.pessoas) || 1));
      // Pagamento pode ser dividido em várias formas (novo) ou uma só (compat).
      let pags = [];
      if (Array.isArray(body?.pagamentos)) {
        pags = body.pagamentos
          .map((x) => ({ forma: txt(x?.forma, 20), valor: Math.round((Number(x?.valor) || 0) * 100) / 100 }))
          .filter((x) => x.forma && x.valor > 0);
      } else {
        pags = [{ forma: txt(body?.pagamento, 20) || 'Dinheiro', valor: total }];
      }
      if (!pags.length) return NextResponse.json({ ok: false, erro: 'Informe como foi pago.' }, { status: 400 });
      const soma = Math.round(pags.reduce((s, x) => s + x.valor, 0) * 100) / 100;
      if (Math.abs(soma - total) > 0.05) return NextResponse.json({ ok: false, erro: 'A soma das formas de pagamento não bate com o total.' }, { status: 400 });
      const fiado = Math.round(pags.filter((x) => x.forma === 'Fiado').reduce((s, x) => s + x.valor, 0) * 100) / 100;
      const nomeCli = txt(body?.nome, 60) || c.nome || '';
      // Trava: fiado SEM nome não pode — senão a dívida vira uma "Mesa X" sem dono.
      if (fiado > 0.005 && !nomeCli) return NextResponse.json({ ok: false, erro: 'Fiado precisa do nome de quem ficou devendo.' }, { status: 400 });
      // Limite de fiado: se o cliente está cadastrado com limite e "bloquear",
      // barra o novo fiado que passaria do limite (soma o que já está em aberto).
      if (fiado > 0.005 && nomeCli) {
        const norm = (s) => (s || '').trim().toLowerCase();
        const numBR = (s) => { const v = parseFloat(String(s).replace(/\./g, '').replace(',', '.')); return isFinite(v) ? v : 0; };
        const fmt = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');
        const fiadoDe = (v) => { const base = v.fiado != null ? (Number(v.fiado) || 0) : (v.pagamento === 'Fiado' ? (Number(v.total) || 0) : 0); return Math.max(0, base - (Number(v.abatido) || 0)); };
        const blob = await lerPainel(sb);
        const clientes = Array.isArray(blob.clientes) ? blob.clientes : [];
        const cli = clientes.find((x) => norm(x.nome) === norm(nomeCli) && x.bloquear && numBR(x.limite) > 0);
        if (cli) {
          const limite = numBR(cli.limite);
          const { data: vrows } = await sb.from('pdm_dados').select('valor').like('chave', 'venda:%');
          const abertoAtual = (vrows || []).map((r) => r.valor).filter((v) => v && !v.pago && norm(v.nome) === norm(nomeCli)).reduce((s, v) => s + fiadoDe(v), 0);
          if (abertoAtual + fiado > limite + 0.005) {
            return NextResponse.json({ ok: false, bloqueado: true, erro: `${cli.nome} atingiu o limite de fiado (${fmt(limite)}). Em aberto: ${fmt(abertoAtual)}. Não dá pra fiar mais ${fmt(fiado)}.` }, { status: 400 });
          }
        }
      }
      // Liga a venda ao caixa aberto (se houver), pro fechamento do caixa somar.
      const { data: caixaRows } = await sb.from('pdm_dados').select('valor').like('chave', 'caixa:%');
      const caixaAberto = (caixaRows || []).map((r) => r.valor).find((x) => x && x.aberto);
      const venda = {
        id: uid(), data: hojeBrasil(), mesa: c.mesa, total, subtotal, servico, desconto, descontoPct, pessoas,
        pagamentos: pags, pagamento: pags.length === 1 ? pags[0].forma : 'Dividido', fiado,
        nome: txt(body?.nome, 60) || c.nome || '', itens: c.itens, caixaId: caixaAberto ? caixaAberto.id : null,
        // Só fica "não pago" (na lista de fiados) o que ficou no fiado.
        pago: fiado <= 0.005, fechadaEm: new Date().toISOString(), fechadaPor: p,
      };
      const { error: eV } = await sb.from('pdm_dados').upsert(
        { chave: 'venda:' + venda.id, valor: venda, atualizado_em: new Date().toISOString() },
        { onConflict: 'chave' }
      );
      if (eV) throw eV;
      const { error: eD } = await sb.from('pdm_dados').delete().eq('chave', chaveDe(id));
      if (eD) throw eD;
      // Baixa do estoque pela ficha técnica dos itens vendidos. Best-effort: se
      // algo falhar aqui, a venda NÃO é afetada (a reconciliação pega depois,
      // via /api/estoque sincronizar, porque a venda ainda não está em baixas).
      try {
        const blobAtual = await lerPainel(sb);
        const rb = aplicarBaixasVendas(arr(blobAtual.estoque), arr(blobAtual.fichas), [venda], arr(blobAtual.estoqueBaixas), false);
        if (rb.mudou) {
          await gravarPainelParcial(sb, { estoque: rb.estoque, estoqueBaixas: rb.baixadas });
        }
      } catch (e) { /* estoque nunca quebra a venda */ }
      // Aviso na hora: se essa venda no fiado levou o cliente a bater o limite,
      // manda um push. Best-effort — nunca quebra a venda.
      if (fiado > 0.005 && venda.nome) {
        try {
          const nomeNorm = limparNome(venda.nome).toLowerCase();
          const cli = arr(blob.clientes).find((c) => limparNome(c.nome).toLowerCase() === nomeNorm);
          const limite = cli ? num(cli.limite) : 0;
          if (limite > 0) {
            const { data: vrows } = await sb.from('pdm_dados').select('valor').like('chave', 'venda:%');
            const devido = (vrows || []).map((r) => r.valor).filter((v) => v && !v.pago && limparNome(v.nome).toLowerCase() === nomeNorm).reduce((s, v) => s + abertoDaVenda(v), 0);
            if (devido >= limite - 0.005) {
              await enviarPush(sb, { titulo: 'Fiado no limite', corpo: `${limparNome(venda.nome)} está em ${brl(devido)} de ${brl(limite)}.`, url: '/', tag: 'fiado-' + nomeNorm, audiencia: 'dona' });
            }
          }
        } catch (e) { /* push nunca quebra a venda */ }
      }
      return NextResponse.json({ ok: true, venda });
    }

    // Cancelar (fechar sem virar receita) e remover a comanda. Uma comanda VAZIA
    // (aberta sem querer) qualquer um pode excluir; com consumo, só a dona — pra
    // o garçom não apagar o que já foi lançado.
    if (acao === 'cancelar') {
      const temConsumo = (c.itens || []).length > 0;
      if (temConsumo && p !== 'dona') return NextResponse.json({ ok: false, erro: 'Comanda com consumo: só a dona pode cancelar.' }, { status: 403 });
      const { error } = await sb.from('pdm_dados').delete().eq('chave', chaveDe(id));
      if (error) throw error;
      return NextResponse.json({ ok: true, cancelada: true });
    }

    return NextResponse.json({ ok: false, erro: 'Ação inválida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao salvar comanda.' }, { status: 500 });
  }
}
