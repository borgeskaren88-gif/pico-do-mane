import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { bancoDaSessao } from '../../../lib/negocioAtual';
// `limparNome` e `abertoDaVenda` entram aqui pelo 'juntar'. O build NÃO acusa
// identificador solto — só quebra na hora de rodar, com ela na frente.
import { limparNome, abertoDaVenda } from '../../../lib/util';

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
    const sb = bancoDaSessao();
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
    // Baixa SEM entrada de dinheiro (desconto no salário, cortesia, acerto):
    // a dívida some da lista, mas nada entra no caixa nem vira receita. Por isso
    // o recebimento fica sem caixaId — é ele que faz o valor contar no turno.
    const semDinheiro = !!body?.semDinheiro;
    const motivo = txt(body?.motivo, 40);
    const forma = semDinheiro ? (motivo || 'Sem dinheiro') : (txt(body?.formaRecebida, 20) || 'Dinheiro');
    const ref = txt(body?.ref, 40); // etiqueta pra poder desfazer depois
    if (!ids.length) return NextResponse.json({ ok: false, erro: 'Nenhum fiado informado.' }, { status: 400 });
    if (!(valor > 0)) return NextResponse.json({ ok: false, erro: 'Informe um valor maior que zero.' }, { status: 400 });
    try {
      const sb = bancoDaSessao();
      const hoje = hojeBrasil();
      const cxId = semDinheiro ? null : await caixaAbertoId(sb);
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
        v.recebimentos.push({ data: hoje, valor: paga, forma, caixaId: cxId, ref: ref || undefined, semDinheiro: semDinheiro || undefined, motivo: motivo || undefined });
        if (v.abatido >= (Number(v.fiado != null ? v.fiado : (v.pagamento === 'Fiado' ? v.total : 0)) || 0) - 0.005) {
          v.pago = true; v.pagoEm = hoje; v.formaRecebida = forma;
          v.semDinheiro = semDinheiro || undefined; // pra tela mostrar que não entrou grana
          if (ref) v.quitadoPor = ref; // foi ESTA baixa que quitou — o desfazer precisa saber
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
      return NextResponse.json({ ok: true, aplicado, sobra: Math.max(0, resta), quitados: alterados.filter((v) => v.pago).length, ref: ref || null });
    } catch (e) {
      return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao receber o fiado.' }, { status: 500 });
    }
  }

  // JUNTAR DUAS CONTAS DE FIADO QUE SÃO A MESMA PESSOA.
  //
  // A lista dela tinha "igor" e "Igor Bittencourt"; "Gabreil" e "Gabriel
  // Bittencourt". Travar a criação de conta nova (ver api/comandas) impede que
  // apareçam mais; não conserta as que já estão lá.
  //
  // E elas fazem estrago enquanto existirem: o Gabriel tem limite de R$ 600 e
  // está em R$ 504, mas os R$ 47,30 do "Gabreil" não contam pro limite dele.
  // Na prática já passou, e o sistema não sabe.
  //
  // JUNTAR É RENOMEAR, NÃO SOMAR.
  //
  // Cada venda continua inteira, com a data e o que foi consumido — só passa a
  // responder pelo nome certo. Somar os totais numa dívida só apagaria o
  // histórico, e aí ela nunca mais saberia o que aquela pessoa consumiu.
  //
  // Guarda o nome de antes em `nomeAntes`. Se eu errar — ou se ela escolher as
  // duas contas trocadas — dá pra achar e voltar. Operação que mexe em dívida
  // de gente sem deixar rastro é operação que eu não escrevo.
  if (acao === 'juntar') {
    const de = limparNome(txt(body?.de, 60));
    const para = limparNome(txt(body?.para, 60));
    const norm = (x) => limparNome(x).toLowerCase();
    if (!de || !para) return NextResponse.json({ ok: false, erro: 'Diz as duas contas.' }, { status: 400 });
    if (norm(de) === norm(para)) return NextResponse.json({ ok: false, erro: 'São a mesma conta.' }, { status: 400 });
    try {
      const sb = bancoDaSessao();
      const { data, error } = await sb.from('pdm_dados').select('chave, valor').like('chave', PREFIXO + '%');
      if (error) throw error;
      let movidas = 0, total = 0;
      for (const linha of (data || [])) {
        const v = linha?.valor;
        if (!v || norm(v.nome) !== norm(de)) continue;
        // O nome ORIGINAL só se grava uma vez: juntar duas vezes seguidas não
        // pode apagar de onde a venda veio de verdade.
        if (!v.nomeAntes) v.nomeAntes = v.nome;
        v.nome = para;
        total += Number(abertoDaVenda(v)) || 0;
        movidas += 1;
        const { error: e2 } = await sb.from('pdm_dados').upsert({ chave: linha.chave, valor: v, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
        if (e2) throw e2;
      }
      // O nome errado sai do cadastro de clientes, senão ela torna a escolher
      // ele na próxima conta e o problema volta na semana que vem.
      const { data: pr } = await sb.from('pdm_dados').select('valor').eq('chave', 'painel').maybeSingle();
      const blob = pr?.valor || {};
      const antes = Array.isArray(blob.clientes) ? blob.clientes : [];
      const ficam = antes.filter((c) => norm(c && c.nome) !== norm(de));
      let tirouDoCadastro = false;
      if (ficam.length !== antes.length) {
        await sb.from('pdm_dados').upsert({ chave: 'painel', valor: { ...blob, clientes: ficam }, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
        tirouDoCadastro = true;
      }
      return NextResponse.json({ ok: true, movidas, total: Math.round(total * 100) / 100, tirouDoCadastro });
    } catch (e) {
      return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao juntar as contas.' }, { status: 500 });
    }
  }

  // DESFAZER UM JUNTAR.
  //
  // "E caso uma hora eu erre também."
  //
  // Eu guardava o nome de antes em `nomeAntes` e não dava a ela nenhum jeito
  // de usar isso — rastro que só eu consigo ler não serve pra quem está com o
  // bar aberto. Se ela juntar as duas contas trocadas, tem que conseguir
  // voltar sozinha, na hora, sem me chamar.
  //
  // Desfaz PELO PAR, não por nome solto: devolve só as vendas que estão em
  // `para` e vieram de `de`. Assim um juntar antigo, certo e já esquecido não
  // se desfaz junto com o errado de agora.
  if (acao === 'desjuntar') {
    const de = limparNome(txt(body?.de, 60));
    const para = limparNome(txt(body?.para, 60));
    const norm = (x) => limparNome(x).toLowerCase();
    if (!de || !para) return NextResponse.json({ ok: false, erro: 'Diz as duas contas.' }, { status: 400 });
    try {
      const sb = bancoDaSessao();
      const { data, error } = await sb.from('pdm_dados').select('chave, valor').like('chave', PREFIXO + '%');
      if (error) throw error;
      let voltaram = 0;
      for (const linha of (data || [])) {
        const v = linha?.valor;
        if (!v || norm(v.nome) !== norm(para) || norm(v.nomeAntes) !== norm(de)) continue;
        v.nome = v.nomeAntes;
        delete v.nomeAntes;
        voltaram += 1;
        const { error: e2 } = await sb.from('pdm_dados').upsert({ chave: linha.chave, valor: v, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
        if (e2) throw e2;
      }
      if (!voltaram) return NextResponse.json({ ok: false, erro: 'Não achei compras pra devolver.' }, { status: 404 });
      return NextResponse.json({ ok: true, voltaram });
    } catch (e) {
      return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao desfazer.' }, { status: 500 });
    }
  }

  // Desfazer uma baixa de fiado inteira, pela etiqueta que ela recebeu. Tira o
  // recebimento de cada venda que ele tocou, devolve o valor pra dívida e, se a
  // venda tinha sido quitada por essa baixa, ela volta a ficar em aberto.
  if (acao === 'desfazer') {
    const ref = txt(body?.ref, 40);
    if (!ref) return NextResponse.json({ ok: false, erro: 'Baixa não informada.' }, { status: 400 });
    try {
      const sb = bancoDaSessao();
      const { data, error } = await sb.from('pdm_dados').select('chave, valor').like('chave', PREFIXO + '%');
      if (error) throw error;
      let devolvido = 0;
      const alterados = [];
      for (const linha of (data || [])) {
        const v = linha?.valor;
        if (!v || !Array.isArray(v.recebimentos)) continue;
        const ficam = [];
        let tirado = 0;
        for (const r of v.recebimentos) {
          if (r && r.ref === ref) tirado += Number(r.valor) || 0;
          else ficam.push(r);
        }
        if (!(tirado > 0.005)) continue;
        v.recebimentos = ficam;
        v.abatido = Math.round(Math.max(0, (Number(v.abatido) || 0) - tirado) * 100) / 100;
        if (v.quitadoPor === ref) { v.pago = false; v.pagoEm = null; v.formaRecebida = null; v.quitadoPor = null; v.semDinheiro = undefined; }
        devolvido = Math.round((devolvido + tirado) * 100) / 100;
        alterados.push([linha.chave, v]);
      }
      if (!alterados.length) return NextResponse.json({ ok: false, erro: 'Essa baixa já foi desfeita.' }, { status: 400 });
      for (const [chave, v] of alterados) {
        const { error: e2 } = await sb.from('pdm_dados').upsert({ chave, valor: v, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
        if (e2) throw e2;
      }
      return NextResponse.json({ ok: true, devolvido, vendas: alterados.length });
    } catch (e) {
      return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao desfazer a baixa.' }, { status: 500 });
    }
  }

  const id = txt(body?.id, 40);
  if (!id) return NextResponse.json({ ok: false, erro: 'Venda não informada.' }, { status: 400 });
  try {
    const sb = bancoDaSessao();
    const chave = PREFIXO + id;

    // Receber um fiado: marca como pago e registra quando/como recebeu. Aí ele
    // passa a contar no caixa (na data do recebimento) e sai da lista de fiados.
    if (acao === 'receber') {
      const { data } = await sb.from('pdm_dados').select('valor').eq('chave', chave).maybeSingle();
      const v = data?.valor;
      if (!v) return NextResponse.json({ ok: false, erro: 'Venda não encontrada.' }, { status: 404 });
      const hoje = hojeBrasil();
      // Baixa sem entrada de dinheiro: sem caixaId, pra não contar no turno.
      const semDinheiro = !!body?.semDinheiro;
      const motivo = txt(body?.motivo, 40);
      const forma = semDinheiro ? (motivo || 'Sem dinheiro') : (txt(body?.formaRecebida, 20) || 'Dinheiro');
      const ref = txt(body?.ref, 40);
      // Quanto ainda faltava (fiado menos o já abatido) — é o que entra no caixa agora.
      const base = Number(v.fiado != null ? v.fiado : (v.pagamento === 'Fiado' ? v.total : 0)) || 0;
      const falta = Math.round((base - (Number(v.abatido) || 0)) * 100) / 100;
      if (falta > 0.005) {
        v.recebimentos = Array.isArray(v.recebimentos) ? v.recebimentos : [];
        v.recebimentos.push({ data: hoje, valor: falta, forma, caixaId: semDinheiro ? null : await caixaAbertoId(sb), ref: ref || undefined, semDinheiro: semDinheiro || undefined, motivo: motivo || undefined });
        v.abatido = Math.round(((Number(v.abatido) || 0) + falta) * 100) / 100;
      }
      v.pago = true;
      v.pagoEm = hoje;
      v.formaRecebida = forma;
      v.semDinheiro = semDinheiro || undefined;
      if (ref) v.quitadoPor = ref; // pra saber que foi ESSA baixa que quitou
      const { error } = await sb.from('pdm_dados').upsert({ chave, valor: v, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
      if (error) throw error;
      return NextResponse.json({ ok: true, venda: v, aplicado: falta > 0.005 ? falta : 0, ref: ref || null });
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
