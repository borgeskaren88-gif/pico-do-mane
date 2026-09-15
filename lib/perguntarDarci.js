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

// Isso soa como ORDEM ou como PERGUNTA? O teste é aqui, de graça, no navegador:
// só o que soa como ordem é que vale gastar uma chamada de IA pra organizar.
//
// Pergunta ganha da ordem de propósito: "quanto gastei com a Ambev?" tem
// "gastei" dentro, mas é pergunta — e lançar uma despesa porque ela perguntou
// um número seria o pior erro possível.
const INTERROGATIVA = /^\s*(quanto|qual|quais|quando|quem|onde|como|porque|por que|sera|ser[aá]|tem |teve |vale a pena|da pra|d[aá] pra|posso|devo|preciso saber)/i;
const VERBO_DE_ORDEM = new RegExp([
  'anota', 'anotar', 'lembra', 'lembre', 'lembrete', 'marca', 'marcar', 'agenda', 'agendar',
  'lanca', 'lançar', 'lancar', 'lança', 'registra', 'bota', 'p[oõ]e', 'coloca', 'desconta',
  'baixa', 'd[aá] baixa', 'tira do estoque',
  'paguei', 'pagamos', 'gastei', 'gastamos', 'comprei', 'compramos', 'recebi', 'recebemos',
  'chegou', 'quebrou', 'quebrei', 'venceu', 'vencido', 'estragou', 'derrubei', 'derramei',
  'perdi', 'joguei fora', 'tenho que', 'preciso'].join('|'), 'i');

export function pareceOrdem(texto) {
  const t = String(texto || '').trim();
  if (t.length < 5) return false;
  if (t.endsWith('?') || INTERROGATIVA.test(t)) return false;
  return VERBO_DE_ORDEM.test(t);
}

// Manda a frase pra IA organizar em ordem. Devolve o pedido pronto pra tela
// mostrar e a Karen confirmar — ou null, se não era ordem nenhuma.
export async function entenderOrdem(texto) {
  try {
    const r = await fetch('/api/darci/ordem', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }), signal: AbortSignal.timeout(25000),
    });
    const j = await r.json();
    return (j && j.ok && j.pedido) ? j.pedido : null;
  } catch { return null; }
}

// O caminho inteiro de uma frase dela: ordem primeiro, pergunta depois.
// Devolve { pedido } pra confirmar na tela, ou { texto } pra falar em voz alta.
export async function resolverDarci(texto, n, sotaque, conversa = [], podeAnotar = false) {
  if (podeAnotar && pareceOrdem(texto)) {
    const pedido = await entenderOrdem(texto);
    if (pedido) return { pedido };
  }
  return { texto: await perguntarDarci(texto, n, sotaque, conversa) };
}

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
    if (j.semChave) return { estado: 'sem-chave', onde: j.onde || null };
    return {
      estado: j.ok ? 'ok' : 'erro',
      motor: j.motor, modelo: j.modelo, passos: j.passos || [], onde: j.onde || null,
      erro: j.erro || '', cru: j.cru || '', sugestao: j.sugestao || '',
    };
  } catch (e) {
    const t = /Timeout|Abort/i.test(e?.name || '') ? 'O teste passou de 40 segundos sem resposta.' : 'Não consegui nem chegar no servidor. Vê se tem internet.';
    return { estado: 'erro', erro: t };
  }
}
