import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { bancoDaSessao } from '../../../lib/negocioAtual';
import { lerNegocio } from '../../../lib/negocio';
import { montarCena } from '../../../lib/aoVivo';

export const dynamic = 'force-dynamic';

// O BAR AO VIVO: comandas abertas + quem está no turno, numa resposta leve,
// pra tela que se atualiza sozinha a cada poucos segundos. A conta está em
// lib/aoVivo.js. Só a dona e a gerente olham o bar inteiro.
export async function GET() {
  const p = papelDaSessao(cookies().get(nomeCookie())?.value);
  if (p !== 'dona' && p !== 'gerente') return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = bancoDaSessao();
    const [painel, cmd, pto] = await Promise.all([
      sb.from('pdm_dados').select('valor').eq('chave', 'painel').maybeSingle(),
      sb.from('pdm_dados').select('valor').like('chave', 'comanda:%'),
      sb.from('pdm_dados').select('valor').like('chave', 'ponto:%'),
    ]);
    const blob = (painel.data && painel.data.valor) || {};
    const n = Math.floor(Number(blob.mesasQtd));
    const cena = montarCena({
      comandas: (cmd.data || []).map((r) => r.valor).filter(Boolean),
      registros: (pto.data || []).map((r) => r.valor).filter(Boolean),
      mesasQtd: n >= 1 && n <= 80 ? n : 20,
    });
    return NextResponse.json({ ok: true, negocio: lerNegocio(blob).nome || '', ...cena, agora: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao carregar.' }, { status: 500 });
  }
}
