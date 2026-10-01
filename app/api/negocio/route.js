import { NextResponse } from 'next/server';
import { bancoDo, nomeDeNegocioValido } from '../../../lib/banco';
import { lerNegocio, papeisParaLogin, PADRAO } from '../../../lib/negocio';
import { lerNegocios } from '../../../lib/negocios';

export const dynamic = 'force-dynamic';

// OS NOMES DA TELA DE ENTRADA — E SÓ ELES.
//
// A tela de login acontece ANTES de existir sessão, então ela não pode ler o
// painel (que exige senha). Mas precisa saber como se chamam os acessos: num
// bar é "Cozinha" e "Atendimento"; num salão pode ser "Recepção".
//
// Por isso este endereço é aberto. E, porque é aberto, ele devolve EXATAMENTE
// duas coisas: o nome do negócio e os nomes dos acessos — as mesmas que
// qualquer pessoa lê na porta do estabelecimento. Nenhum número, nenhuma
// venda, nenhum telefone, nenhum dado de ninguém.
//
// Se um dia alguém for acrescentar campo aqui: não acrescente. Qualquer coisa
// a mais vaza pra internet inteira, sem senha.
//
// E NO APP DE MUITOS NEGÓCIOS ELE DEVOLVE AINDA MENOS.
//
// Ali a tela só precisa saber que existe um campo de código a preencher. O
// nome de cada negócio NÃO vem, nem quando o código é digitado certo: se
// viesse, qualquer um na internet chutaria códigos até montar a lista de
// clientes da Karen. O nome aparece depois de entrar, que é quando já se
// provou ter o direito de vê-lo.
export async function GET() {
  try {
    const muitos = Object.keys(await lerNegocios()).length > 0;
    if (muitos) {
      return NextResponse.json({ ok: true, multi: true, nome: '', papeis: papeisParaLogin(PADRAO) });
    }
    // Instalação de um cliente só: o negócio é o da configuração do site. Isto
    // acontece ANTES de existir login, então não há crachá de onde tirar o nome.
    const unico = String(process.env.NEGOCIO_UNICO || '').trim().toLowerCase();
    if (!nomeDeNegocioValido(unico)) return NextResponse.json({ ok: false, nome: '', papeis: [] });
    const sb = bancoDo(unico);
    const { data } = await sb.from('pdm_dados').select('valor').eq('chave', 'painel').maybeSingle();
    const n = lerNegocio(data?.valor || {});
    return NextResponse.json({ ok: true, nome: n.nome, papeis: papeisParaLogin(n) });
  } catch {
    // Falhou? A tela de entrada usa os nomes genéricos e continua funcionando.
    // Ninguém fica sem conseguir entrar por causa de um rótulo.
    return NextResponse.json({ ok: false, nome: '', papeis: [] });
  }
}
