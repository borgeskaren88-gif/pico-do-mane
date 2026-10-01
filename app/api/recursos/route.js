import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

// O QUE ESTA INSTALAÇÃO CONSEGUE FAZER.
//
// Cada cópia do PicoOS é publicada com as chaves que o dono dela configurou.
// Sem chave de IA, o Darci não responde nada — e mostrar um sócio mudo é pior
// do que não mostrar sócio nenhum.
//
// Então a tela pergunta antes: tem chave aqui? Não tem → o Darci nem aparece.
//
// Responde só pra quem já está dentro, e devolve sim/não — nunca a chave, nem
// pedaço dela, nem qual é o serviço contratado.
export async function GET() {
  const p = papelDaSessao(cookies().get(nomeCookie())?.value);
  if (!p) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({
    ok: true,
    darci: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
    voz: !!(process.env.ELEVENLABS_API_KEY || process.env.AZURE_SPEECH_KEY || process.env.OPENAI_API_KEY),
  });
}
