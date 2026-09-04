import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// Qual versão do PicoOS está publicada agora. O app compara com a versão que
// ele carregou e se atualiza sozinho quando sai uma nova — assim a dona nunca
// fica presa numa versão antiga sem saber.
export async function GET() {
  const v = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || 'dev';
  return NextResponse.json({ ok: true, v }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });
}
