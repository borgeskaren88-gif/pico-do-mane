'use client';
import { responder, ATALHOS, norm } from './darci';

// Uma pergunta pro Darci, com dois caminhos.
//
// 1) A IA, quando a chave está ligada na Vercel: entende qualquer jeito de
//    falar ("o pessoal tá me devendo muito?") e responde com os números reais,
//    que vão junto na ficha montada no servidor.
// 2) O jeito antigo (palavra-chave, aqui no navegador): instantâneo, de graça
//    e sempre disponível. É o que responde quando não tem chave, quando a
//    internet cai, quando a IA demora ou devolve vazio.
//
// Nunca fica sem resposta: o caminho 2 é a rede embaixo do 1.

// Os atalhos da tela já estão escritos exatamente do jeito que o cérebro daqui
// entende. Botão tocado responde na hora e não gasta — a IA fica pro que ela
// escreve ou fala com as palavras dela.
const ATALHO = new Set(ATALHOS.map((a) => norm(a).replace(/[?!.]/g, '').trim()));
const ehAtalho = (t) => ATALHO.has(norm(t).replace(/[?!.]/g, '').trim());

export async function perguntarDarci(texto, n, sotaque, conversa = []) {
  const q = String(texto || '').trim();
  if (!q) return '';
  if (ehAtalho(q)) return responder(q, n, sotaque);
  try {
    const r = await fetch('/api/darci/perguntar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pergunta: q, sotaque, antes: conversa }),
    });
    const j = await r.json();
    if (j && j.ok && j.resposta) return j.resposta;
  } catch { /* sem conexão ou IA fora do ar */ }
  return responder(q, n, sotaque);
}

// A IA está ligada? Só pra tela poder dizer isso nos ajustes.
export async function iaLigada() {
  try {
    const r = await fetch('/api/darci/perguntar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pergunta: '' }),
    });
    const j = await r.json();
    return !(j && j.semChave);
  } catch { return false; }
}
