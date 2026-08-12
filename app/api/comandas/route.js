import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

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
    const cardapio = (Array.isArray(blob.cardapio) ? blob.cardapio : []).filter((i) => i && i.ativo !== false);
    // Só os nomes dos clientes, pro seletor de "quem ficou devendo" no fiado.
    const clientes = (Array.isArray(blob.clientes) ? blob.clientes : []).map((c) => (c && c.nome ? String(c.nome) : '')).filter(Boolean).sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ ok: true, comandas, cardapio, mesasQtd: mesasDe(blob), clientes });
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
      const blob = await lerPainel(sb);
      const { error } = await sb.from('pdm_dados').upsert(
        { chave: PAINEL, valor: { ...blob, mesasQtd: n }, atualizado_em: new Date().toISOString() },
        { onConflict: 'chave' }
      );
      if (error) throw error;
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
      const cardapio = await lerCardapio(sb);
      const prod = cardapio.find((x) => x && x.id === cardapioId);
      if (!prod) return NextResponse.json({ ok: false, erro: 'Item não está no cardápio.' }, { status: 400 });
      const preco = Number(String(prod.preco).replace(/\./g, '').replace(',', '.')) || 0;
      const existe = c.itens.find((it) => it.cardapioId === cardapioId);
      if (existe) existe.qtd = (Number(existe.qtd) || 0) + 1;
      else c.itens.push({ id: uid(), cardapioId, nome: txt(prod.nome, 200), preco, qtd: 1 });
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
      const total = Math.round((subtotal + servico) * 100) / 100;
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
      // Limite de fiado: se o cliente está cadastrado com limite e "bloquear",
      // barra o novo fiado que passaria do limite (soma o que já está em aberto).
      if (fiado > 0.005 && nomeCli) {
        const norm = (s) => (s || '').trim().toLowerCase();
        const numBR = (s) => { const v = parseFloat(String(s).replace(/\./g, '').replace(',', '.')); return isFinite(v) ? v : 0; };
        const fmt = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');
        const fiadoDe = (v) => (v.fiado != null ? (Number(v.fiado) || 0) : (v.pagamento === 'Fiado' ? (Number(v.total) || 0) : 0));
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
        id: uid(), data: hojeBrasil(), mesa: c.mesa, total, subtotal, servico, pessoas,
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
