import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, opcoesDoCracha, papelDaSessao } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

// RENOVAR O CRACHÁ ENQUANTO A TELA ESTÁ ABERTA.
//
// No computador o crachá vive dez minutos. Esta rota devolve os dez minutos
// cheios, e o app chama ela de poucos em poucos minutos enquanto está aberto.
// Enquanto alguém trabalha, nada disso aparece. Fechou no X? Ninguém chama, e o
// crachá morre sozinho no servidor — sem depender de alguém abrir o app depois.
//
// Ela NÃO LÊ O BANCO, de propósito: é chamada o tempo todo, por todo cliente, e
// uma leitura aqui viraria conta no fim do mês sem servir pra nada. O cookie já
// é a prova — se não valer, papelDaSessao devolve nada e a renovação é recusada.
//
// E ela não ressuscita crachá morto: cookie vencido nem chega aqui (o navegador
// deixa de mandar), e crachá adulterado não passa por papelDaSessao. O máximo
// que ela faz é dar mais dez minutos a quem já estava dentro.
export async function POST() {
  const valor = cookies().get(nomeCookie())?.value;
  const papel = papelDaSessao(valor);
  if (!papel) return NextResponse.json({ ok: false }, { status: 401 });

  // Renova só o prazo curto. No celular o crachá vale 90 dias, e reescrever ele
  // de três em três minutos seria trabalho à toa.
  cookies().set(nomeCookie(), valor, opcoesDoCracha(false));
  return NextResponse.json({ ok: true, papel });
}
