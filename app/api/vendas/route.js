import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

const PREFIXO = 'venda:';

const txt = (v, max) => String(v == null ? '' : v).slice(0, max).trim();
// Data de hoje no fuso do Brasil (senão à noite o UTC vira o dia seguinte).
const hojeBrasil = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// As vendas do salão são financeiro: só a dona lê e mexe. O garçom não vê valores.
function ehDona() {
  return papelDaSessao(cookies().get(nomeCookie())?.value) === 'dona';
}

export async function GET() {
  if (!ehDona()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    const { data, error } = await sb.from('pdm_dados').select('valor').like('chave', PREFIXO + '%');
    if (error) throw error;
    const vendas = (data || []).map((r) => r.valor).filter(Boolean).sort((a, b) => (b.fechadaEm || '').localeCompare(a.fechadaEm || ''));
    return NextResponse.json({ ok: true, vendas });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao carregar vendas.' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!ehDona()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }
  const acao = txt(body?.acao, 20);
  const id = txt(body?.id, 40);
  if (!id) return NextResponse.json({ ok: false, erro: 'Venda não informada.' }, { status: 400 });
  try {
    const sb = supabaseServer();
    const chave = PREFIXO + id;

    // Receber um fiado: marca como pago e registra quando/como recebeu. Aí ele
    // passa a contar no caixa (na data do recebimento) e sai da lista de fiados.
    if (acao === 'receber') {
      const { data } = await sb.from('pdm_dados').select('valor').eq('chave', chave).maybeSingle();
      const v = data?.valor;
      if (!v) return NextResponse.json({ ok: false, erro: 'Venda não encontrada.' }, { status: 404 });
      v.pago = true;
      v.pagoEm = hojeBrasil();
      v.formaRecebida = txt(body?.formaRecebida, 20) || 'Dinheiro';
      const { error } = await sb.from('pdm_dados').upsert({ chave, valor: v, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
      if (error) throw error;
      return NextResponse.json({ ok: true, venda: v });
    }

    // Excluir uma venda (ex.: lançada por engano).
    if (acao === 'excluir') {
      const { error } = await sb.from('pdm_dados').delete().eq('chave', chave);
      if (error) throw error;
      return NextResponse.json({ ok: true, excluida: true });
    }

    return NextResponse.json({ ok: false, erro: 'Ação inválida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao atualizar venda.' }, { status: 500 });
  }
}
