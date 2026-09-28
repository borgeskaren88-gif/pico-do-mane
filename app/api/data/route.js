import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, sessaoEhValida } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';
import { notificarNovasTarefasCozinha } from '../../../lib/push';

export const dynamic = 'force-dynamic';

const CHAVE = 'painel';

function autorizado() {
  const valor = cookies().get(nomeCookie())?.value;
  return sessaoEhValida(valor);
}

export async function GET() {
  if (!autorizado()) {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }
  try {
    const sb = supabaseServer();
    const { data, error } = await sb
      .from('pdm_dados')
      .select('valor')
      .eq('chave', CHAVE)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ ok: true, dados: data?.valor ?? null });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e?.message || 'Erro ao carregar dados.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  if (!autorizado()) {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }
  let dados;
  try {
    dados = await request.json();
  } catch {
    return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 });
  }
  try {
    const sb = supabaseServer();
    // Preserva a lista e as tarefas da cozinha se não vierem no corpo: elas são
    // gravadas pelo acesso da cozinha (/api/lista) e não podem ser apagadas por
    // um salvamento da dona que não as incluiu.
    const { data: atual } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE).maybeSingle();
    const anterior = atual?.valor || {};
    // Mescla os campos recebidos SOBRE o que já está salvo. Campos não enviados
    // são preservados (o cliente manda só o que mudou). Isso evita que um
    // salvamento parcial apague dados que ele não incluiu.
    const valor = { ...anterior, ...dados };
    // Rede de segurança: NÃO deixa um salvamento zerar uma lista financeira que
    // já tem dados. Esvaziar receitas/despesas/etc. por completo praticamente
    // nunca é intencional — é a assinatura de um aparelho com cópia vazia/velha
    // gravando por cima. Nesses casos, preserva o que já estava salvo.
    //
    // MAS APAGAR DE PROPÓSITO TEM QUE FUNCIONAR.
    //
    // Essa rede pegava junto um caso legítimo: apagar o ÚLTIMO item de uma
    // lista. A lista fica vazia, a rede achava que era aparelho com cópia velha,
    // e devolvia o item apagado pro lugar. Na prática: a última despesa não
    // saía, a última compra não saía — e nada dizia nada, o que é pior, porque
    // a tela mostrava a lista vazia e o banco continuava cheio.
    //
    // Quem apaga de propósito manda dizer isso em `intencional`. Aparelho com
    // cópia velha nunca manda, porque não sabe que está apagando nada — que é
    // exatamente a diferença entre os dois casos.
    const intencional = new Set(Array.isArray(dados.intencional) ? dados.intencional : []);
    delete valor.intencional;
    for (const campo of ['diario', 'receitas', 'despesas', 'compras', 'cotacoes', 'garrafas']) {
      if (intencional.has(campo)) continue;
      if (campo in dados && Array.isArray(dados[campo]) && dados[campo].length === 0
          && Array.isArray(anterior[campo]) && anterior[campo].length > 0) {
        valor[campo] = anterior[campo];
      }
    }
    if (!('listaCozinha' in valor) && Array.isArray(anterior.listaCozinha)) valor.listaCozinha = anterior.listaCozinha;
    if (!('tarefasCozinha' in valor) && Array.isArray(anterior.tarefasCozinha)) valor.tarefasCozinha = anterior.tarefasCozinha;
    if (!('cardapio' in valor) && Array.isArray(anterior.cardapio)) valor.cardapio = anterior.cardapio;
    if (!('clientes' in valor) && Array.isArray(anterior.clientes)) valor.clientes = anterior.clientes;
    if (!('ideias' in valor) && Array.isArray(anterior.ideias)) valor.ideias = anterior.ideias;
    if (!('mesasQtd' in valor) && anterior.mesasQtd != null) valor.mesasQtd = anterior.mesasQtd;
    // Estoque, fichas técnicas e baixas são donos de si mesmos (mexidos só via
    // /api/estoque e pela baixa ao fechar a comanda). O salvamento geral da dona
    // NUNCA os altera — sempre mantém o que já está no banco, pra não sobrescrever
    // uma baixa feita por uma venda ao mesmo tempo.
    if (Array.isArray(anterior.estoque)) valor.estoque = anterior.estoque; else delete valor.estoque;
    if (Array.isArray(anterior.fichas)) valor.fichas = anterior.fichas; else delete valor.fichas;
    if (Array.isArray(anterior.estoqueBaixas)) valor.estoqueBaixas = anterior.estoqueBaixas; else delete valor.estoqueBaixas;
    const { error } = await sb
      .from('pdm_dados')
      .upsert(
        { chave: CHAVE, valor, atualizado_em: new Date().toISOString() },
        { onConflict: 'chave' }
      );
    if (error) throw error;
    // Se a dona criou tarefa(s) nova(s) pra cozinha, avisa a cozinha no celular.
    if (Array.isArray(dados?.tarefasCozinha)) {
      await notificarNovasTarefasCozinha(sb, dados.tarefasCozinha, anterior.tarefasCozinha);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e?.message || 'Erro ao salvar dados.' },
      { status: 500 }
    );
  }
}
