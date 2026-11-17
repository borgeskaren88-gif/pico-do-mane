import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { bancoDaSessao } from '../../../lib/negocioAtual';
import { num, ymOf, todayISO, diaOperacional, FONTES_NAO_OPERACIONAL } from '../../../lib/util';
import { calcularMeta } from '../../../lib/meta';
import { cobrancasDeFiado } from '../../../lib/clientes';
import { aplicarMovimentoItem } from '../../../lib/estoque';
import {
  lerConfig, embalagemDe, quantoTem, doseDe, resultadoContagem, ultimoDe, vigiados, ehMedido,
} from '../../../lib/controleDoses';

export const dynamic = 'force-dynamic';

// O QUE A GERENTE VÊ QUE O RESTO DA EQUIPE NÃO VÊ — E SÓ ISSO.
//
// "Ela vai aprender todas as áreas, pra quando precisar salvar." Mas a dona
// decidiu o tamanho de cada janela:
//
//   - a META em porcentagem, sem reais ("72%, no ritmo, faltam 9 dias");
//   - o FIADO pra cobrar: quem deve, quanto, e a mensagem pronta;
//   - o CONTROLE DE DOSES: ela conta, e o resultado vem em doses, nunca em
//     reais — quanto isso custou, só a dona vê.
//
// Por isso esta rota existe em vez de abrir pra ela as rotas da dona: as da
// dona devolvem o painel inteiro (faturamento, despesas, custos, salários).
// Aqui cada resposta é montada com o que pode sair, e mais nada.

const PAINEL = 'painel';
const arr = (v) => (Array.isArray(v) ? v : []);

function papel() {
  const p = papelDaSessao(cookies().get(nomeCookie())?.value);
  return p === 'gerente' || p === 'dona' ? p : null;
}

async function lerPainel(sb) {
  const { data, error } = await sb.from('pdm_dados').select('valor').eq('chave', PAINEL).maybeSingle();
  if (error) throw error;
  return (data?.valor && typeof data.valor === 'object') ? data.valor : {};
}

async function lerVendas(sb) {
  const { data, error } = await sb.from('pdm_dados').select('valor').like('chave', 'venda:%');
  if (error) throw error;
  return (data || []).map((r) => r.valor).filter(Boolean);
}

// A META SEM REAIS. A conta é a mesma da tela da dona (calcularMeta, com a
// receita operacional do mês); o que sai daqui é só a porcentagem e o ritmo.
function metaEmPorcentagem(blob) {
  const hoje = todayISO();
  const mes = ymOf(hoje);
  const doMes = arr(blob.receitas).filter((r) => r && ymOf(r.data) === mes && !FONTES_NAO_OPERACIONAL.includes(r.categoria));
  const realizado = doMes.reduce((s, r) => s + num(r.valor), 0);
  const m = calcularMeta({
    metas: blob.metas || null,
    realizado,
    ym: mes,
    hoje,
    temReceitaHoje: doMes.some((r) => r.data === hoje && num(r.valor) > 0),
    diasComReceita: [...new Set(doMes.filter((r) => num(r.valor) > 0).map((r) => r.data))],
  });
  if (m.semMeta) return { semMeta: true };
  return {
    semMeta: false,
    pct: Math.round(m.pct * 100),
    pctProjecao: Math.round(m.pctProjecao * 100),
    estado: m.estado,
    bateu: m.bateu,
    diasRestantes: m.diasRestantes,
  };
}

// O QUE CONTAR. Nome e unidade, e se o app já sabe o tamanho da embalagem —
// nunca o saldo, que é o que ela vai conferir.
function listaDoses(blob, vendas) {
  const cfg = lerConfig(blob.controleDoses);
  const estoque = arr(blob.estoque);
  const compras = arr(blob.compras);
  const fichas = arr(blob.fichas);
  const forma = (it) => ({
    id: it.id, nome: it.nome, unidade: it.unidade || 'un',
    medido: ehMedido(it), embalagem: (embalagemDe(it, compras, cfg.tamanhos) || {}).tamanho || null,
  });
  const lista = vigiados({ estoque, fichas, vendas, hoje: todayISO(), config: cfg }).map((x) => forma(x.item));
  const comFicha = new Set();
  for (const f of fichas) for (const ing of arr(f && f.itens)) if (ing && ing.estoqueId) comFicha.add(ing.estoqueId);
  const outras = estoque
    .filter((it) => it && it.id && !it.separar && comFicha.has(it.id))
    .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')))
    .map(forma);
  return { semana: lista, todas: outras };
}

export async function GET() {
  const p = papel();
  if (!p) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = bancoDaSessao();
    const [blob, vendas, jr] = await Promise.all([
      lerPainel(sb), lerVendas(sb),
      sb.from('pdm_dados').select('valor').eq('chave', 'jornadas').maybeSingle(),
    ]);
    // O nome dela, pra tela inicial dizer "Boa noite, Sarah". Sai da jornada
    // que a dona configurou no Ponto — só o nome, nunca o salário que mora ali.
    const nome = String((jr?.data?.valor?.gerente && jr.data.valor.gerente.nome) || '').trim();
    return NextResponse.json({
      ok: true,
      nome,
      tarefas: arr(blob.tarefasGerente).filter((t) => t && t.id).map((t) => ({ id: t.id, texto: t.texto, data: t.data || '', feito: !!t.feito })),
      meta: metaEmPorcentagem(blob),
      fiados: cobrancasDeFiado(vendas, arr(blob.clientes), diaOperacional()),
      doses: listaDoses(blob, vendas),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao carregar.' }, { status: 500 });
  }
}

// CONTAR GARRAFAS. A conta inteira acontece aqui: o resultado precisa das
// vendas, das fichas e do custo, que não descem pra tela dela.
//
// O que volta pra ela é o veredito em DOSES ("bateu", "faltaram 4 doses"). O
// registro completo, com o custo e o valor de venda, fica guardado no mesmo
// lugar em que a dona conta — e aparece na tela de Controle de doses dela,
// com o placar do mês em reais.
export async function POST(request) {
  const p = papel();
  if (!p) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }
  // MARCAR TAREFA COMO FEITA. Só troca o "feito" de uma tarefa que a dona já
  // criou — a gerente não cria nem apaga tarefa por aqui.
  if (body?.acao === 'tarefa') {
    try {
      const sb = bancoDaSessao();
      const blob = await lerPainel(sb);
      const id = String(body?.id || '');
      const lista = arr(blob.tarefasGerente);
      if (!lista.some((t) => t && t.id === id)) return NextResponse.json({ ok: false, erro: 'Tarefa não encontrada.' }, { status: 404 });
      const feito = !!body?.feito;
      const nova = lista.map((t) => (t && t.id === id ? { ...t, feito, feitoEm: feito ? Date.now() : null } : t));
      const { error } = await sb.from('pdm_dados').upsert(
        { chave: PAINEL, valor: { ...blob, tarefasGerente: nova }, atualizado_em: new Date().toISOString() },
        { onConflict: 'chave' },
      );
      if (error) throw error;
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao marcar.' }, { status: 500 });
    }
  }
  if (body?.acao !== 'doses') return NextResponse.json({ ok: false, erro: 'Ação desconhecida.' }, { status: 400 });
  const tipo = body?.tipo === 'semanal' ? 'semanal' : 'acabou';
  const pedidos = arr(body?.itens).slice(0, 20);
  if (!pedidos.length) return NextResponse.json({ ok: false, erro: 'Conta pelo menos uma garrafa.' }, { status: 400 });

  try {
    const sb = bancoDaSessao();
    const [blob, vendas] = await Promise.all([lerPainel(sb), lerVendas(sb)]);
    let cfg = lerConfig(blob.controleDoses);
    let estoque = arr(blob.estoque).slice();
    const compras = arr(blob.compras);
    const hoje = todayISO();
    const novos = [];
    const respostas = [];

    for (const ped of pedidos) {
      const idx = estoque.findIndex((it) => it && it.id === String(ped?.id || ''));
      if (idx < 0) return NextResponse.json({ ok: false, erro: 'Garrafa não encontrada no estoque.' }, { status: 404 });
      const item = estoque[idx];
      if (item.separar) return NextResponse.json({ ok: false, erro: `${item.nome} é separado em sacos e não se conta por aqui.` }, { status: 400 });
      const cheias = Math.floor(Number(ped?.cheias));
      if (!(cheias >= 0 && cheias <= 999)) return NextResponse.json({ ok: false, erro: `Diz quantas fechadas de ${item.nome} sobraram — pode ser zero.` }, { status: 400 });

      let emb = embalagemDe(item, compras, cfg.tamanhos);
      if (!emb) {
        const t = num(ped?.tamanho);
        if (!(t > 0)) return NextResponse.json({ ok: false, erro: `Diz quanto vem em cada embalagem de ${item.nome}.`, faltaTamanho: item.id }, { status: 400 });
        cfg = { ...cfg, tamanhos: { ...cfg.tamanhos, [item.id]: t } };
        emb = { tamanho: t, origem: 'dito' };
      }
      // Acabou: a aberta vale zero, sem olhômetro. Semanal: a altura em décimos.
      const nivel = tipo === 'acabou' ? 0 : Math.max(0, Math.min(10, Math.round(Number(ped?.nivel) || 0)));
      const contado = quantoTem({ cheias, nivel }, emb.tamanho);
      const r = resultadoContagem({
        item, contado, tamanho: emb.tamanho,
        dose: doseDe(item, arr(blob.fichas), arr(blob.cardapio), vendas, hoje),
        anterior: ultimoDe(cfg.registros, item.id),
      });
      estoque[idx] = aplicarMovimentoItem(item, 'contagem', contado, 'Controle de doses (gerência)');
      novos.push({ id: `${Date.now().toString(36)}${novos.length}${Math.random().toString(36).slice(2, 6)}`, data: hoje, ts: Date.now() + novos.length, tipo, por: p, ...r });
      // O QUE VOLTA PRA TELA: o veredito em doses, sem custo, sem venda e sem
      // o saldo que o sistema esperava.
      respostas.push({ nome: r.nome, estado: r.estado, doses: r.doses, doseNome: r.doseNome, unidade: r.unidade });
    }

    // Uma gravação só, lendo de novo o painel por baixo: o estoque e o
    // registro mudam juntos, e nada que outra tela gravou no meio se perde.
    const { data: atual } = await sb.from('pdm_dados').select('valor').eq('chave', PAINEL).maybeSingle();
    const base = (atual?.valor && typeof atual.valor === 'object') ? atual.valor : {};
    const porId = new Map(estoque.map((it) => [it.id, it]));
    const tocados = new Set(pedidos.map((x) => String(x?.id || '')));
    const estoqueFinal = arr(base.estoque).map((it) => (it && tocados.has(it.id) && porId.has(it.id) ? porId.get(it.id) : it));
    const cfgBase = lerConfig(base.controleDoses);
    const controleDoses = {
      ...cfgBase,
      tamanhos: { ...cfgBase.tamanhos, ...cfg.tamanhos },
      registros: [...novos, ...cfgBase.registros].slice(0, 400),
    };
    const { error } = await sb.from('pdm_dados').upsert(
      { chave: PAINEL, valor: { ...base, estoque: estoqueFinal, controleDoses }, atualizado_em: new Date().toISOString() },
      { onConflict: 'chave' },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true, resultados: respostas });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao conferir.' }, { status: 500 });
  }
}
