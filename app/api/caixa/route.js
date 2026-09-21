import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';
import { notificarCaixa, notificarConferencia } from '../../../lib/push';
import { diaOperacional } from '../../../lib/util';
import { conferirFechamento, movimentoDoDia } from '../../../lib/fechamento';

export const dynamic = 'force-dynamic';

const CX = 'caixa:';
const VD = 'venda:';
const arr = (v) => (Array.isArray(v) ? v : []);
const FORMAS = ['Dinheiro', 'Pix', 'Crédito', 'Débito', 'Fiado'];

// Dona e garçom operam o caixa (é o dinheiro do turno). A cozinha não.
function papel() {
  const p = papelDaSessao(cookies().get(nomeCookie())?.value);
  return p === 'dona' || p === 'garcom' ? p : null;
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// Aceita número ou texto em formato brasileiro ("1.234,50") e arredonda em 2 casas.
// Os produtos que vale a pena contar no fechamento: os que mexeram hoje, do
// que girou mais valor pro que girou menos.
//
// Vai com NOME e UNIDADE só, pra qualquer um que esteja fechando. Quem vê "o
// sistema diz 6" digita 6 — não por má fé, é o que a cabeça faz com um número
// pronto na frente. E como tem noite que quem fecha é a dona e tem noite que é
// o atendimento, a tela tem que ser a mesma nas duas, senão as noites não são
// comparáveis entre si.
async function itensParaContar(sb, limite = 12) {
  const { data } = await sb.from('pdm_dados').select('valor').eq('chave', 'painel').maybeSingle();
  const blob = (data?.valor && typeof data.valor === 'object') ? data.valor : {};
  const hoje = diaOperacional();
  return arr(blob.estoque)
    .filter((it) => it && it.id)
    .map((it) => {
      const m = movimentoDoDia(it, hoje);
      const girou = m.venda + m.entrou + m.perda + m.cortesia + m.consumo + m.outras;
      // Ordena pelo dinheiro que girou; sem custo cadastrado, vale a quantidade,
      // pra o item não sumir da lista só por faltar o preço.
      return { id: it.id, nome: it.nome, unidade: it.unidade || 'un', girou, peso: girou * (Number(it.custo) || 0) };
    })
    .filter((x) => x.girou > 0)
    .sort((a, b) => b.peso - a.peso || b.girou - a.girou)
    .slice(0, limite)
    .map(({ id, nome, unidade }) => ({ id, nome, unidade }));
}

// A CONFERÊNCIA É CALCULADA AQUI, no servidor, e não na tela.
//
// Quem fecha o caixa no fim da noite é o atendimento, não a dona. Se a conta
// dependesse da tela da dona, ela simplesmente nunca rodaria — foi o que
// aconteceu na primeira versão. Aqui o cliente manda só o que foi CONTADO na
// prateleira; o resto (estoque, fichas, cardápio, vendas do dia) o servidor já
// tem, e ninguém precisa estar olhando pra conta sair.
async function conferirNoServidor(sb, contagens, caixaResumo) {
  const limpas = {};
  for (const [k, v] of Object.entries(contagens || {})) {
    if (typeof k !== 'string' || !k || k.length > 40) continue;
    if (v == null || v === '') continue;
    limpas[k] = String(v).slice(0, 20);
  }
  if (!Object.keys(limpas).length) return null;

  const { data: prow } = await sb.from('pdm_dados').select('valor').eq('chave', 'painel').maybeSingle();
  const blob = (prow?.valor && typeof prow.valor === 'object') ? prow.valor : {};
  const hoje = diaOperacional();
  const { data: vrows } = await sb.from('pdm_dados').select('valor').like('chave', VD + '%');
  const vendas = (vrows || []).map((r) => r.valor).filter((v) => v && v.data === hoje);

  const r = conferirFechamento({
    estoque: arr(blob.estoque), fichas: arr(blob.fichas), cardapio: arr(blob.cardapio),
    vendas, contagens: limpas, caixa: caixaResumo, hoje,
  });
  return conferenciaSegura({
    totais: r.totais,
    faltas: r.linhas.filter((l) => l.nivel !== 'ok'),
    veredito: r.veredito,
  });
}

// Poda o que vai ser gravado: o que fica guardado tem que ser previsível.
function conferenciaSegura(c) {
  if (!c || typeof c !== 'object' || !c.totais) return null;
  const n = (x) => (Number.isFinite(Number(x)) ? Math.round(Number(x) * 100) / 100 : 0);
  const faltas = (Array.isArray(c.faltas) ? c.faltas : []).slice(0, 30).map((x) => ({
    nome: String(x?.nome || '').slice(0, 60),
    falta: Number.isFinite(Number(x?.falta)) ? Math.round(Number(x.falta) * 1000) / 1000 : 0,
    unidade: String(x?.unidade || 'un').slice(0, 10),
    nivel: ['certo', 'duvidoso', 'sobra'].includes(x?.nivel) ? x.nivel : 'duvidoso',
    sistema: Number.isFinite(Number(x?.sistema)) ? Math.round(Number(x.sistema) * 1000) / 1000 : 0,
    contado: Number.isFinite(Number(x?.contado)) ? Math.round(Number(x.contado) * 1000) / 1000 : 0,
    receitaPerdida: n(x?.receitaPerdida), custoPerdido: n(x?.custoPerdido),
  }));
  return {
    totais: {
      conferidos: Math.max(0, parseInt(c.totais.conferidos, 10) || 0),
      comFalta: Math.max(0, parseInt(c.totais.comFalta, 10) || 0),
      custoPerdido: n(c.totais.custoPerdido), receitaPerdida: n(c.totais.receitaPerdida),
      receitaPerdidaCerta: n(c.totais.receitaPerdidaCerta),
      saidasNaMao: n(c.totais.saidasNaMao), faltaNoCaixa: n(c.totais.faltaNoCaixa),
    },
    faltas,
    veredito: { nivel: String(c.veredito?.nivel || '').slice(0, 20), texto: String(c.veredito?.texto || '').slice(0, 600) },
  };
}

const n2 = (n) => {
  const v = typeof n === 'string' ? parseFloat(n.replace(/\./g, '').replace(',', '.')) : Number(n);
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
};

// Soma as entradas de um caixa, separadas por forma. Duas origens:
//  - Comandas fechadas no turno (vendas ligadas ao caixa) — venda de hoje.
//  - Fiado RECEBIDO no turno (recebimentos ligados ao caixa, de qualquer venda,
//    inclusive de dívidas antigas) — dinheiro que entrou de fiado, NÃO é comanda
//    de hoje. Fica num balde próprio (fiadoRecebido) pra dar pra separar na tela.
async function entradasDoCaixa(sb, caixaId) {
  const { data } = await sb.from('pdm_dados').select('valor').like('chave', VD + '%');
  const todas = (data || []).map((r) => r.valor).filter(Boolean);
  const vendas = todas.filter((v) => v.caixaId === caixaId);
  const ent = { Dinheiro: 0, Pix: 0, 'Crédito': 0, 'Débito': 0, Fiado: 0 };
  let servico = 0;
  for (const v of vendas) {
    servico = n2(servico + (Number(v.servico) || 0));
    const pags = Array.isArray(v.pagamentos) ? v.pagamentos : (v.pagamento ? [{ forma: v.pagamento, valor: Number(v.total) || 0 }] : []);
    for (const pg of pags) { if (ent[pg.forma] != null) ent[pg.forma] = n2(ent[pg.forma] + (Number(pg.valor) || 0)); }
  }
  // Fiado recebido neste caixa (dinheiro que entrou de contas antigas/do mês).
  const fiadoRecebido = { Dinheiro: 0, Pix: 0, 'Crédito': 0, 'Débito': 0, total: 0 };
  for (const v of todas) {
    for (const rc of (Array.isArray(v.recebimentos) ? v.recebimentos : [])) {
      if (!rc || rc.caixaId !== caixaId) continue;
      const val = n2(rc.valor);
      if (!(val > 0)) continue;
      const forma = fiadoRecebido[rc.forma] != null ? rc.forma : 'Dinheiro';
      fiadoRecebido[forma] = n2(fiadoRecebido[forma] + val);
      fiadoRecebido.total = n2(fiadoRecebido.total + val);
    }
  }
  return { entradas: ent, qtdVendas: vendas.length, servico, fiadoRecebido };
}

function resumo(caixa, entradas, fiadoRecebido) {
  const fr = fiadoRecebido || { Dinheiro: 0, Pix: 0, 'Crédito': 0, 'Débito': 0, total: 0 };
  // Recebido = comandas (sem o fiado gerado) + fiado recebido de verdade.
  const recebido = n2(entradas.Dinheiro + entradas.Pix + entradas['Crédito'] + entradas['Débito'] + fr.total);
  // Na gaveta entra o dinheiro das comandas + o fiado recebido em dinheiro.
  const dinheiroFinal = n2((Number(caixa.saldoInicial) || 0) + entradas.Dinheiro + fr.Dinheiro);
  return { recebido, dinheiroFinal, fiado: entradas.Fiado };
}

// Vendas de HOJE que ficaram sem caixa nenhum (fechadas com o caixa fechado).
async function vendasSoltasDoDia(sb) {
  const hoje = diaOperacional();
  const { data } = await sb.from('pdm_dados').select('valor').like('chave', VD + '%');
  return (data || []).map((r) => r.valor).filter((v) => v && !v.caixaId && v.data === hoje);
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
    let entradas = null, extra = null, qtdVendas = 0, servico = 0, fiadoRecebido = null;
    if (aberto) {
      const r = await entradasDoCaixa(sb, aberto.id);
      entradas = r.entradas; qtdVendas = r.qtdVendas; servico = r.servico; fiadoRecebido = r.fiadoRecebido; extra = resumo(aberto, r.entradas, r.fiadoRecebido);
    }
    // Comanda fechada sem caixa aberto fica "solta": não entra no fechamento
    // nem, por consequência, na receita do dia. Em vez de sumir calada, ela é
    // contada aqui pra tela poder oferecer o resgate.
    const soltas = await vendasSoltasDoDia(sb);
    const historico = caixas.filter((c) => !c.aberto).sort((a, b) => (b.fechadoEm || '').localeCompare(a.fechadoEm || '')).slice(0, 15);
    // A lista vale pros dois papéis: a contagem é às cegas pra quem estiver
    // fechando, inclusive pra dona. Ver o saldo esperado enquanto conta faz a
    // pessoa digitar o esperado — e aí a conferência não mede nada.
    const paraContar = aberto ? await itensParaContar(sb) : null;
    return NextResponse.json({
      ok: true, aberto, entradas, servico, fiadoRecebido, ...(extra || {}), qtdVendas, historico, paraContar,
      soltas: { qtd: soltas.length, total: n2(soltas.reduce((t, v) => t + (Number(v.total) || 0), 0)) },
    });
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

    // Puxa pro caixa aberto as vendas de hoje que ficaram soltas. Só mexe no
    // caixaId — a venda em si (itens, pagamento, fiado) fica intacta —, e como
    // só pega venda SEM caixa, não tem como roubar venda de outro turno nem
    // contar duas vezes.
    if (acao === 'adotarSoltas') {
      if (!aberto) return NextResponse.json({ ok: false, erro: 'Abra o caixa antes de puxar as vendas.' }, { status: 400 });
      const soltas = await vendasSoltasDoDia(sb);
      if (!soltas.length) return NextResponse.json({ ok: true, adotadas: 0 });
      for (const v of soltas) {
        const nova = { ...v, caixaId: aberto.id, puxadaPraCaixa: new Date().toISOString() };
        const { error } = await sb.from('pdm_dados').upsert(
          { chave: VD + v.id, valor: nova, atualizado_em: new Date().toISOString() },
          { onConflict: 'chave' },
        );
        if (error) throw error;
      }
      return NextResponse.json({ ok: true, adotadas: soltas.length, total: n2(soltas.reduce((t, v) => t + (Number(v.total) || 0), 0)) });
    }

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
      try { await notificarCaixa(sb, caixa, 'abrir'); } catch (e) { /* push nunca quebra a abertura */ }
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
      const { entradas, qtdVendas, servico, fiadoRecebido } = await entradasDoCaixa(sb, caixa.id);
      const r = resumo(caixa, entradas, fiadoRecebido);
      const contado = body?.contado != null && body?.contado !== '' ? n2(body.contado) : null;
      const fechado = {
        ...caixa, aberto: false, fechadoEm: new Date().toISOString(), fechadoPor: p,
        entradas, fiadoRecebido, recebido: r.recebido, dinheiroFinal: r.dinheiroFinal, fiado: r.fiado, servico,
        qtdVendas, contado, diferenca: contado != null ? n2(contado - r.dinheiroFinal) : null,
        // Resultado da conferência de estoque feita na tela do fechamento.
        // Vem pronto do cliente porque quem contou a prateleira foi ela — o
        // servidor não tem como refazer essa parte.
        conferencia: await conferirNoServidor(sb, body?.contagens, { dinheiroFinal: r.dinheiroFinal, contado }),
        conferidoPor: body?.contagens && Object.keys(body.contagens).length ? p : null,
      };
      const { error } = await sb.from('pdm_dados').upsert({ chave: CX + caixa.id, valor: fechado, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
      if (error) throw error;
      try { await notificarCaixa(sb, fechado, 'fechar'); } catch (e) { /* push nunca quebra o fechamento */ }
      try { await notificarConferencia(sb, fechado); } catch (e) { /* idem */ }
      return NextResponse.json({ ok: true, caixa: fechado });
    }

    return NextResponse.json({ ok: false, erro: 'Ação inválida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao atualizar o caixa.' }, { status: 500 });
  }
}
