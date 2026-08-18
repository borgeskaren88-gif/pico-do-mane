import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

const CX = 'caixa:';
const VD = 'venda:';
const FORMAS = ['Dinheiro', 'Pix', 'Crédito', 'Débito', 'Fiado'];

// Dona e garçom operam o caixa (é o dinheiro do turno). A cozinha não.
function papel() {
  const p = papelDaSessao(cookies().get(nomeCookie())?.value);
  return p === 'dona' || p === 'garcom' ? p : null;
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// Aceita número ou texto em formato brasileiro ("1.234,50") e arredonda em 2 casas.
const n2 = (n) => {
  const v = typeof n === 'string' ? parseFloat(n.replace(/\./g, '').replace(',', '.')) : Number(n);
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
};

// Soma as entradas das vendas ligadas a um caixa, separadas por forma.
async function entradasDoCaixa(sb, caixaId) {
  const { data } = await sb.from('pdm_dados').select('valor').like('chave', VD + '%');
  const vendas = (data || []).map((r) => r.valor).filter((v) => v && v.caixaId === caixaId);
  const ent = { Dinheiro: 0, Pix: 0, 'Crédito': 0, 'Débito': 0, Fiado: 0 };
  let servico = 0;
  for (const v of vendas) {
    servico = n2(servico + (Number(v.servico) || 0));
    const pags = Array.isArray(v.pagamentos) ? v.pagamentos : (v.pagamento ? [{ forma: v.pagamento, valor: Number(v.total) || 0 }] : []);
    for (const pg of pags) { if (ent[pg.forma] != null) ent[pg.forma] = n2(ent[pg.forma] + (Number(pg.valor) || 0)); }
  }
  return { entradas: ent, qtdVendas: vendas.length, servico };
}

function resumo(caixa, entradas) {
  const recebido = n2(entradas.Dinheiro + entradas.Pix + entradas['Crédito'] + entradas['Débito']);
  const dinheiroFinal = n2((Number(caixa.saldoInicial) || 0) + entradas.Dinheiro);
  return { recebido, dinheiroFinal, fiado: entradas.Fiado };
}

export async function GET() {
  const p = papel();
  if (!p) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    const { data, error } = await sb.from('pdm_dados').select('valor').like('chave', CX + '%');
    if (error) throw error;
    const caixas = (data || []).map((r) => r.valor).filter(Boolean);
    const aberto = caixas.find((c) => c.aberto) || null;
    let entradas = null, extra = null, qtdVendas = 0, servico = 0;
    if (aberto) {
      const r = await entradasDoCaixa(sb, aberto.id);
      entradas = r.entradas; qtdVendas = r.qtdVendas; servico = r.servico; extra = resumo(aberto, r.entradas);
    }
    const historico = caixas.filter((c) => !c.aberto).sort((a, b) => (b.fechadoEm || '').localeCompare(a.fechadoEm || '')).slice(0, 15);
    return NextResponse.json({ ok: true, aberto, entradas, servico, ...(extra || {}), qtdVendas, historico });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao carregar o caixa.' }, { status: 500 });
  }
}

export async function POST(request) {
  const p = papel();
  if (!p) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }
  const acao = String(body?.acao || '').slice(0, 20);
  try {
    const sb = supabaseServer();
    const { data } = await sb.from('pdm_dados').select('valor').like('chave', CX + '%');
    const caixas = (data || []).map((r) => r.valor).filter(Boolean);
    const aberto = caixas.find((c) => c.aberto) || null;

    if (acao === 'abrir') {
      if (aberto) return NextResponse.json({ ok: false, erro: 'Já existe um caixa aberto.' }, { status: 400 });
      // O garçom (atendimento) só abre o caixa se tiver batido o ponto (entrada
      // aberta). A dona abre livremente.
      if (p === 'garcom') {
        const { data: prows } = await sb.from('pdm_dados').select('valor').like('chave', 'ponto:%');
        const temPontoAberto = (prows || []).map((r) => r.valor).some((v) => v && !v.saida && (!v.papel || v.papel === 'garcom'));
        if (!temPontoAberto) return NextResponse.json({ ok: false, semPonto: true, erro: 'Bata seu ponto (Entrada) antes de abrir o caixa.' }, { status: 400 });
      }
      const saldoInicial = n2(body?.saldoInicial);
      const caixa = { id: uid(), aberto: true, saldoInicial, abertoEm: new Date().toISOString(), abertoPor: p };
      const { error } = await sb.from('pdm_dados').upsert({ chave: CX + caixa.id, valor: caixa, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
      if (error) throw error;
      return NextResponse.json({ ok: true, caixa });
    }

    // Corrigir o saldo inicial de um caixa já aberto (ex.: abriu sem o valor).
    if (acao === 'ajustar') {
      const id = String(body?.id || '').slice(0, 40);
      const caixa = caixas.find((c) => c.id === id && c.aberto);
      if (!caixa) return NextResponse.json({ ok: false, erro: 'Caixa não encontrado ou já fechado.' }, { status: 404 });
      caixa.saldoInicial = n2(body?.saldoInicial);
      const { error } = await sb.from('pdm_dados').upsert({ chave: CX + caixa.id, valor: caixa, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
      if (error) throw error;
      return NextResponse.json({ ok: true, caixa });
    }

    if (acao === 'fechar') {
      const id = String(body?.id || '').slice(0, 40);
      const caixa = caixas.find((c) => c.id === id && c.aberto);
      if (!caixa) return NextResponse.json({ ok: false, erro: 'Caixa não encontrado ou já fechado.' }, { status: 404 });
      const { entradas, qtdVendas, servico } = await entradasDoCaixa(sb, caixa.id);
      const r = resumo(caixa, entradas);
      const contado = body?.contado != null && body?.contado !== '' ? n2(body.contado) : null;
      const fechado = {
        ...caixa, aberto: false, fechadoEm: new Date().toISOString(), fechadoPor: p,
        entradas, recebido: r.recebido, dinheiroFinal: r.dinheiroFinal, fiado: r.fiado, servico,
        qtdVendas, contado, diferenca: contado != null ? n2(contado - r.dinheiroFinal) : null,
      };
      const { error } = await sb.from('pdm_dados').upsert({ chave: CX + caixa.id, valor: fechado, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
      if (error) throw error;
      return NextResponse.json({ ok: true, caixa: fechado });
    }

    return NextResponse.json({ ok: false, erro: 'Ação inválida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao atualizar o caixa.' }, { status: 500 });
  }
}
