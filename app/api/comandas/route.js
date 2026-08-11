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
    return NextResponse.json({ ok: true, comandas, cardapio, mesasQtd: mesasDe(blob) });
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

    // Cancelar (fechar sem virar receita) — só a dona pode, pra o garçom não
    // apagar consumo. Remove a comanda.
    if (acao === 'cancelar') {
      if (p !== 'dona') return NextResponse.json({ ok: false, erro: 'Só a dona pode cancelar.' }, { status: 403 });
      const { error } = await sb.from('pdm_dados').delete().eq('chave', chaveDe(id));
      if (error) throw error;
      return NextResponse.json({ ok: true, cancelada: true });
    }

    return NextResponse.json({ ok: false, erro: 'Ação inválida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao salvar comanda.' }, { status: 500 });
  }
}
