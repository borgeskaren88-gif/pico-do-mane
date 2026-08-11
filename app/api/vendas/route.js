import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

const PREFIXO = 'venda:';

// As vendas do salão são financeiro: só a dona lê. O garçom não vê valores.
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
