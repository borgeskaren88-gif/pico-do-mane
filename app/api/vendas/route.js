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

// Id do caixa aberto agora (pra o fiado recebido entrar no caixa do dia). Null
// se não houver caixa aberto — aí o recebimento fica registrado sem caixa.
async function caixaAbertoId(sb) {
  const { data } = await sb.from('pdm_dados').select('valor').like('chave', 'caixa:%');
  const c = (data || []).map((r) => r.valor).find((x) => x && x.aberto);
  return c ? c.id : null;
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

  // Receber um VALOR do cliente e abater dos fiados dele (do mais antigo pro mais
  // novo). Fiado que o valor cobre todo vira "pago"; no último, se sobrar dívida,
  // guarda o parcial em v.abatido — assim o cliente continua na lista só com o
  // que ainda falta. Não precisa clicar "Recebi" compra por compra.
  if (acao === 'receberValor') {
    const ids = Array.isArray(body?.ids) ? body.ids.map((x) => txt(x, 40)).filter(Boolean) : [];
    const valor = Math.round((Number(body?.valor) || 0) * 100) / 100;
    const forma = txt(body?.formaRecebida, 20) || 'Dinheiro';
    if (!ids.length) return NextResponse.json({ ok: false, erro: 'Nenhum fiado informado.' }, { status: 400 });
    if (!(valor > 0)) return NextResponse.json({ ok: false, erro: 'Informe um valor maior que zero.' }, { status: 400 });
    try {
      const sb = supabaseServer();
      const hoje = hojeBrasil();
      const cxId = await caixaAbertoId(sb);
      // Lê os fiados escolhidos, mantém só os ainda em aberto, mais antigo primeiro.
      const linhas = [];
      for (const vid of ids) {
        const { data } = await sb.from('pdm_dados').select('valor').eq('chave', PREFIXO + vid).maybeSingle();
        const v = data?.valor;
        if (v && !v.pago) linhas.push(v);
      }
      linhas.sort((a, b) => (a.fechadaEm || a.data || '').localeCompare(b.fechadaEm || b.data || ''));
      let resta = valor;
      const alterados = [];
      for (const v of linhas) {
        if (resta <= 0.005) break;
        const aberto = Math.round(((Number(v.fiado != null ? v.fiado : (v.pagamento === 'Fiado' ? v.total : 0)) || 0) - (Number(v.abatido) || 0)) * 100) / 100;
        if (aberto <= 0.005) continue;
        const paga = Math.min(aberto, resta);
        v.abatido = Math.round(((Number(v.abatido) || 0) + paga) * 100) / 100;
        v.recebimentos = Array.isArray(v.recebimentos) ? v.recebimentos : [];
        v.recebimentos.push({ data: hoje, valor: paga, forma, caixaId: cxId });
        if (v.abatido >= (Number(v.fiado != null ? v.fiado : (v.pagamento === 'Fiado' ? v.total : 0)) || 0) - 0.005) {
          v.pago = true; v.pagoEm = hoje; v.formaRecebida = forma;
        }
        alterados.push(v);
        resta = Math.round((resta - paga) * 100) / 100;
      }
      if (!alterados.length) return NextResponse.json({ ok: false, erro: 'Esses fiados já estão quitados.' }, { status: 400 });
      for (const v of alterados) {
        const { error } = await sb.from('pdm_dados').upsert({ chave: PREFIXO + v.id, valor: v, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
        if (error) throw error;
      }
      const aplicado = Math.round((valor - Math.max(0, resta)) * 100) / 100;
      return NextResponse.json({ ok: true, aplicado, sobra: Math.max(0, resta), quitados: alterados.filter((v) => v.pago).length });
    } catch (e) {
      return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao receber o fiado.' }, { status: 500 });
    }
  }

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
      const hoje = hojeBrasil();
      const forma = txt(body?.formaRecebida, 20) || 'Dinheiro';
      // Quanto ainda faltava (fiado menos o já abatido) — é o que entra no caixa agora.
      const base = Number(v.fiado != null ? v.fiado : (v.pagamento === 'Fiado' ? v.total : 0)) || 0;
      const falta = Math.round((base - (Number(v.abatido) || 0)) * 100) / 100;
      if (falta > 0.005) {
        v.recebimentos = Array.isArray(v.recebimentos) ? v.recebimentos : [];
        v.recebimentos.push({ data: hoje, valor: falta, forma, caixaId: await caixaAbertoId(sb) });
        v.abatido = Math.round(((Number(v.abatido) || 0) + falta) * 100) / 100;
      }
      v.pago = true;
      v.pagoEm = hoje;
      v.formaRecebida = forma;
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
