import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabase';
import { lerNegocio, papeisParaLogin } from '../../../lib/negocio';

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
export async function GET() {
  try {
    const sb = supabaseServer();
    const { data } = await sb.from('pdm_dados').select('valor').eq('chave', 'painel').maybeSingle();
    const n = lerNegocio(data?.valor || {});
    return NextResponse.json({ ok: true, nome: n.nome, papeis: papeisParaLogin(n) });
  } catch {
    // Falhou? A tela de entrada usa os nomes genéricos e continua funcionando.
    // Ninguém fica sem conseguir entrar por causa de um rótulo.
    return NextResponse.json({ ok: false, nome: '', papeis: [] });
  }
}
