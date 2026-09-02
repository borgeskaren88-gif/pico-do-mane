import { NextResponse } from 'next/server';
import { tokenWidgetValido } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';
import { num, brl, todayISO, addDays, fiadoDaVenda } from '../../../lib/util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const arr = (v) => (Array.isArray(v) ? v : []);
// Dia no fuso do Brasil a partir de um ISO (o caixa guarda só o fechadoEm).
const diaBR = (iso) => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)); } catch { return String(iso || '').slice(0, 10); } };

// Dados do widget (tela inicial via Scriptable). Só LEITURA, autorizado pelo
// token na URL (?t=). Mostra o caixa de ONTEM, o fiado de ontem e o estoque que
// está acabando (é o que a dona quer ver de manhã).
export async function GET(request) {
  const t = new URL(request.url).searchParams.get('t') || '';
  if (!tokenWidgetValido(t)) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    const hoje = todayISO();
    const ontem = addDays(hoje, -1);

    const { data: vrows } = await sb.from('pdm_dados').select('valor').like('chave', 'venda:%');
    const vendas = (vrows || []).map((r) => r.valor).filter(Boolean);
    const vendasHoje = vendas.filter((v) => (v.data || '') === hoje);
    const vendasOntem = vendas.filter((v) => (v.data || '') === ontem);

    // Fiado gerado ontem.
    const fiadoOntem = Math.round(vendasOntem.reduce((s, v) => s + fiadoDaVenda(v), 0) * 100) / 100;

    // Saldo do caixa de ontem: soma o "recebido" dos caixas fechados ontem. Se
    // não fechou caixa ontem, usa as vendas de ontem (total menos o fiado) como
    // aproximação, pra o widget não ficar vazio.
    const { data: cxrows } = await sb.from('pdm_dados').select('valor').like('chave', 'caixa:%');
    const caixasOntem = (cxrows || []).map((r) => r.valor).filter((c) => c && !c.aberto && c.fechadoEm && diaBR(c.fechadoEm) === ontem);
    let caixaOntem = Math.round(caixasOntem.reduce((s, c) => s + num(c.recebido), 0) * 100) / 100;
    if (!caixasOntem.length) {
      const totalOntem = vendasOntem.reduce((s, v) => s + num(v.total), 0);
      caixaOntem = Math.round((totalOntem - fiadoOntem) * 100) / 100;
    }

    // Faturamento de hoje (mantido pra compatibilidade com o script antigo).
    const totalHoje = vendasHoje.reduce((s, v) => s + num(v.total), 0);
    const fiadoHoje = vendasHoje.reduce((s, v) => s + fiadoDaVenda(v), 0);
    const recebidoHoje = Math.round((totalHoje - fiadoHoje) * 100) / 100;

    // Estoque acabando (saldo <= mínimo, com mínimo definido).
    const { data: painelRow } = await sb.from('pdm_dados').select('valor').eq('chave', 'painel').maybeSingle();
    const estoque = arr(painelRow?.valor?.estoque);
    const baixos = estoque.filter((it) => { const min = num(it.minimo); return min > 0 && num(it.saldo) <= min; });

    return NextResponse.json({
      ok: true,
      atualizado: new Date().toISOString(),
      ontem: { data: ontem, caixa: caixaOntem, caixaBRL: brl(caixaOntem), fiado: fiadoOntem, fiadoBRL: brl(fiadoOntem) },
      faturamento: { total: totalHoje, recebido: recebidoHoje, fiado: fiadoHoje, vendas: vendasHoje.length, totalBRL: brl(totalHoje), recebidoBRL: brl(recebidoHoje), fiadoBRL: brl(fiadoHoje) },
      estoqueBaixo: { quantidade: baixos.length, itens: baixos.slice(0, 6).map((it) => it.nome) },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro no widget.' }, { status: 500 });
  }
}
