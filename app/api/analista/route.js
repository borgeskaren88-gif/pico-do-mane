import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { bancoDaSessao } from '../../../lib/negocioAtual';
import { lerNegocio } from '../../../lib/negocio';
import { diaOperacional } from '../../../lib/util';
import { montarPacote } from '../../../lib/pacoteAnalista';
import { escreverXlsx } from '../../../lib/pacoteXlsx';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// O PACOTE PARA O ANALISTA: uma planilha só (Excel) com o que o PicoOS sabe.
//
// Só a dona baixa: é o dinheiro e os clientes do negócio inteiro. O arquivo
// sai na hora, do banco, com os mesmos critérios das telas (lib/pacoteAnalista).
//
// Duas escolhas de privacidade, que ela muda na tela antes de baixar:
//   - telefones dos clientes: FORA por padrão;
//   - nomes dos clientes: DENTRO por padrão (sem nome, o fiado vira "Cliente 1…").
// Salário de cada funcionário nunca vai.
export async function GET(request) {
  if (papelDaSessao(cookies().get(nomeCookie())?.value) !== 'dona') {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }
  const q = new URL(request.url).searchParams;
  const m = q.get('meses');
  const meses = m === '0' ? 0 : (m === '12' ? 12 : 4);
  try {
    const sb = bancoDaSessao();
    const [painel, vendas] = await Promise.all([
      sb.from('pdm_dados').select('valor').eq('chave', 'painel').maybeSingle(),
      sb.from('pdm_dados').select('valor').like('chave', 'venda:%'),
    ]);
    const dados = (painel && painel.data && painel.data.valor) || {};
    const hoje = diaOperacional();
    const pacote = montarPacote({
      dados, vendas: ((vendas && vendas.data) || []).map((r) => r.valor).filter(Boolean),
      hoje, meses, telefones: q.get('telefones') === '1', nomes: q.get('nomes') !== '0',
      nomeNegocio: lerNegocio(dados).nome,
    });
    const arquivo = await escreverXlsx(pacote, { titulo: 'Pacote PicoOS para o analista' });
    return new NextResponse(arquivo, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="picoos-pacote-analista-${hoje}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Não consegui montar o pacote.' }, { status: 500 });
  }
}
