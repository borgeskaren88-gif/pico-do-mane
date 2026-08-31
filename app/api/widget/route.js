import { NextResponse } from 'next/server';
import { tokenWidgetValido } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';
import { num, brl, todayISO, fiadoDaVenda } from '../../../lib/util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const arr = (v) => (Array.isArray(v) ? v : []);

// Dados do widget (tela inicial via Scriptable). Só LEITURA, autorizado pelo
// token na URL (?t=). Devolve o faturamento de hoje e o estoque no mínimo.
export async function GET(request) {
  const t = new URL(request.url).searchParams.get('t') || '';
  if (!tokenWidgetValido(t)) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    const hoje = todayISO();

    // Faturamento de hoje (vendas fechadas hoje) — total, recebido e fiado.
    const { data: vrows } = await sb.from('pdm_dados').select('valor').like('chave', 'venda:%');
    const vendasHoje = (vrows || []).map((r) => r.valor).filter((v) => v && (v.data || '') === hoje);
    const total = vendasHoje.reduce((s, v) => s + num(v.total), 0);
    const fiado = vendasHoje.reduce((s, v) => s + fiadoDaVenda(v), 0);
    const recebido = Math.round((total - fiado) * 100) / 100;

    // Estoque no mínimo.
    const { data: painelRow } = await sb.from('pdm_dados').select('valor').eq('chave', 'painel').maybeSingle();
    const estoque = arr(painelRow?.valor?.estoque);
    const baixos = estoque.filter((it) => { const min = num(it.estoqueMin); return min > 0 && num(it.saldo) <= min; });

    return NextResponse.json({
      ok: true,
      atualizado: new Date().toISOString(),
      faturamento: { total, recebido, fiado, vendas: vendasHoje.length, totalBRL: brl(total), recebidoBRL: brl(recebido), fiadoBRL: brl(fiado) },
      estoqueBaixo: { quantidade: baixos.length, itens: baixos.slice(0, 6).map((it) => it.nome) },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro no widget.' }, { status: 500 });
  }
}
