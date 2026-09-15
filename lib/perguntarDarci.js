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

// Testa a IA DE VERDADE (faz uma chamada curtinha) e devolve o que aconteceu.
//
// Antes aqui só olhava se a chave existia — e isso mentia: com a chave posta
// mas com algum problema (sem crédito, modelo errado), a tela dizia "ligada" e
// o Darci respondia pelo jeito antigo sem ninguém saber por quê. Agora o erro
// aparece escrito, com o que fazer pra resolver.
export async function testarIA() {
  try {
    // Tempo limite do lado de cá também: se o servidor travar, a tela diz isso
    // em vez de ficar rodando pra sempre escrito "testando…".
    const r = await fetch('/api/darci/perguntar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'teste' }),
      signal: AbortSignal.timeout(40000),
    });
    let j = null;
    try { j = await r.json(); } catch { /* veio HTML de erro, não JSON */ }
    if (!j) return { estado: 'erro', erro: `O servidor respondeu ${r.status} sem explicação. Se for 504, a chamada demorou demais e foi cortada.` };
    if (j.semChave) return { estado: 'sem-chave' };
    return {
      estado: j.ok ? 'ok' : 'erro',
      motor: j.motor, modelo: j.modelo, passos: j.passos || [],
      erro: j.erro || '', cru: j.cru || '', sugestao: j.sugestao || '',
    };
  } catch (e) {
    const t = /Timeout|Abort/i.test(e?.name || '') ? 'O teste passou de 40 segundos sem resposta.' : 'Não consegui nem chegar no servidor. Vê se tem internet.';
    return { estado: 'erro', erro: t };
  }
}
