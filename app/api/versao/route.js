import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// Qual versão do PicoOS está publicada agora. O app compara com a versão que
// ele carregou e se atualiza sozinho quando sai uma nova — assim a dona nunca
// fica presa numa versão antiga sem saber.
//
// `git` é o commit e só o commit. É com ele que o app compara o próprio
// carimbo de build, e os dois TÊM que sair da mesma fonte: se um lado usasse o
// commit e o outro o id do deploy, eles nunca bateriam e o app se recarregaria
// pra sempre. `v` mantém o campo antigo (com o id do deploy como reserva) pra
// não quebrar quem já está rodando lá fora.
export async function GET() {
  const git = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7);
  const v = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || 'dev';
  return NextResponse.json({ ok: true, v, git }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });
}
