// Voz do Darci: falar em voz alta e guardar as preferências (qual voz e qual
// tom). Fica aqui pra a tela cheia e o balão flutuante usarem a MESMA voz.
//
// Limitação do iPhone: o Safari só entrega um conjunto fixo de vozes. As vozes
// baixadas em Ajustes → Acessibilidade → Conteúdo Falado (ex.: Felipe) e as da
// Siri NÃO ficam disponíveis para apps/sites. Em pt-BR sobra só voz feminina —
// por isso o tom é regulável: abaixando, ela soa masculina.

export const CHAVE_VOZ = 'picoos-voz-darci';
export const CHAVE_TOM = 'picoos-tom-darci';
export const CHAVE_NOME = 'picoos-nome-darci';
export const CHAVE_SOTAQUE = 'picoos-sotaque-darci';
export const CHAVE_ESCUTA = 'picoos-escuta-darci'; // atender quando chamam o nome
// leve = português normal | manezinho = jeito da ilha | carregado = com chiado
export const SOTAQUE_PADRAO = 'manezinho';
export const TOM_PADRAO = 0.7;
// Como o Darci fala o nome da dona. Escrito "Karen" a voz brasileira lê
// "Kerên"; com acento ela puxa a força pra primeira sílaba e sai certo.
export const NOME_PADRAO = 'Káren';
// Nomes de vozes masculinas de pt-BR que APARECEM em alguns aparelhos.
export const MASC = /felipe|ricardo|daniel|jo[aã]o|eddy|reed|rocko|male|mascul/i;

export const temVoz = () => typeof window !== 'undefined' && !!window.speechSynthesis;
export const ehPt = (v) => /^pt/i.test((v && v.lang) || '');

// Todas as vozes do aparelho, português primeiro.
export function listarVozes() {
  if (!temVoz()) return [];
  let todas = [];
  try { todas = window.speechSynthesis.getVoices() || []; } catch { todas = []; }
  return [...todas].sort((a, b) => {
    const pa = ehPt(a) ? 0 : 1, pb = ehPt(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (a.name || '').localeCompare(b.name || '');
  });
}

// Vozes de melhor qualidade (o aparelho às vezes lista a mesma voz duas vezes).
export const MELHOR = /enhanced|premium|melhorad|aprimorad|neural|siri/i;
export const ehMelhor = (v) => MELHOR.test(`${(v && v.name) || ''} ${(v && v.voiceURI) || ''}`);

// Escolhe a melhor voz: a salva pela dona; senão uma masculina de pt-BR; senão
// a primeira de pt-BR.
export function vozPadrao(vozes) {
  let salva = '';
  try { salva = localStorage.getItem(CHAVE_VOZ) || ''; } catch { /* ignora */ }
  if (salva && vozes.some((v) => v.voiceURI === salva)) return salva;
  const pt = vozes.filter(ehPt);
  const br = pt.filter((v) => /pt[-_]BR/i.test(v.lang || ''));
  // Entre duas vozes do mesmo nome, a "melhorada/premium" soa bem melhor.
  const nota = (v) => (MELHOR.test(`${v.name || ''} ${v.voiceURI || ''}`) ? 0 : 1);
  const ordena = (lista) => [...lista].sort((a, b) => nota(a) - nota(b));
  const masc = ordena(br.filter((v) => MASC.test(v.name || '')));
  const escolha = masc[0] || ordena(pt.filter((v) => MASC.test(v.name || '')))[0] || ordena(br)[0] || ordena(pt)[0] || vozes[0];
  return escolha ? escolha.voiceURI : '';
}

export function lerNome() {
  try { const s = (localStorage.getItem(CHAVE_NOME) || '').trim(); if (s) return s; } catch { /* ignora */ }
  return NOME_PADRAO;
}
export function lerSotaque() {
  try { const s = localStorage.getItem(CHAVE_SOTAQUE); if (s === 'leve' || s === 'manezinho' || s === 'carregado') return s; } catch { /* ignora */ }
  return SOTAQUE_PADRAO;
}
export function salvarSotaque(v) { try { localStorage.setItem(CHAVE_SOTAQUE, v); } catch { /* ignora */ } }

// Modo "me chama pelo nome": fica escutando e só acorda quando ouve "Darci".
// Desligado por padrão — é a dona quem liga, sabendo que o microfone fica
// aberto (e que isso gasta bateria).
export function lerEscuta() {
  try { return localStorage.getItem(CHAVE_ESCUTA) === 'sim'; } catch { return false; }
}
export function salvarEscuta(v) { try { localStorage.setItem(CHAVE_ESCUTA, v ? 'sim' : 'nao'); } catch { /* ignora */ } }

// Ele foi chamado? Devolve o que veio DEPOIS do nome (a pergunta), ou '' se só
// chamaram. null quando o nome não aparece na frase.
export function chamadoPeloNome(texto) {
  const t = String(texto || '');
  const m = /\bdarc(?:i|y|e|ie)\b[\s,.!?:]*/i.exec(t);
  if (!m) return null;
  return t.slice(m.index + m[0].length).trim();
}

// O chiado da ilha: o "s" no fim da sílaba vira "sh" (as contas -> ash contash).
// Só mexe no texto que vai pra voz — na tela a resposta continua escrita certo.
function chiado(t) {
  return String(t)
    .replace(/([aeiou\u00e1\u00e9\u00ed\u00f3\u00fa\u00e2\u00ea\u00f4\u00e3\u00f5])s(?=[bcdfgjklmnpqtv])/gi, '$1sh')
    .replace(/([aeiou\u00e1\u00e9\u00ed\u00f3\u00fa\u00e2\u00ea\u00f4\u00e3\u00f5])s\b/gi, '$1sh')
    .replace(/([aeiou\u00e1\u00e9\u00ed\u00f3\u00fa\u00e2\u00ea\u00f4\u00e3\u00f5])z\b/gi, '$1sh')
    .replace(/shsh/gi, 'sh');
}

export function salvarNome(v) { try { localStorage.setItem(CHAVE_NOME, String(v || '').trim() || NOME_PADRAO); } catch { /* ignora */ } }

// Deixa o texto do jeito que a voz lê bem. É aqui que "R$ 1.035,08" vira
// "1035 reais e 8 centavos" (antes ela lia "reais um ponto zero três cinco").
function dinheiroFalado(inteiro, centavos) {
  const n = parseInt(String(inteiro).replace(/[.\s]/g, ''), 10) || 0;
  const c = centavos ? parseInt(String(centavos).padEnd(2, '0'), 10) : 0;
  const cent = `${c} ${c === 1 ? 'centavo' : 'centavos'}`;
  if (n === 0 && c) return cent; // "45 centavos", não "0 reais e 45 centavos"
  const reais = `${n} ${Math.abs(n) === 1 ? 'real' : 'reais'}`;
  if (!c) return reais;
  return `${reais} e ${cent}`;
}

export function textoParaFala(texto, nome, sotaque) {
  let t = String(texto == null ? '' : texto);
  t = t.replace(/R\$\s*(-?\d[\d.]*)(?:,(\d{1,2}))?/g, (_, i, c) => dinheiroFalado(i, c));
  // Separador de milhar atrapalha a leitura: 1.035 -> 1035.
  let antes;
  do { antes = t; t = t.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2'); } while (t !== antes);
  t = t.replace(/(\d)\s?%/g, '$1 por cento');
  t = t.replace(/PicoOS/gi, 'Pico Ó Ésse');
  t = t.replace(/\bK[aá]ren\b/gi, nome == null ? lerNome() : nome);
  if ((sotaque == null ? lerSotaque() : sotaque) === 'carregado') t = chiado(t);
  return t.replace(/\s+/g, ' ').trim();
}

export function lerTom() {
  try { const s = parseFloat(localStorage.getItem(CHAVE_TOM)); if (s >= 0.5 && s <= 1.2) return s; } catch { /* ignora */ }
  return TOM_PADRAO;
}
export function salvarTom(v) { try { localStorage.setItem(CHAVE_TOM, String(v)); } catch { /* ignora */ } }
export function salvarVoz(id) { try { localStorage.setItem(CHAVE_VOZ, id); } catch { /* ignora */ } }

// Fala um texto. No iPhone precisa vir de um toque da dona — e vem.
export function falarTexto(texto, { vozId, tom, nome, sotaque, aoIniciar, aoTerminar } = {}) {
  if (!temVoz()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(textoParaFala(texto, nome, sotaque));
    u.lang = 'pt-BR';
    u.rate = 0.97; // um tico mais devagar entende-se bem melhor
    let ehMasculina = false;
    try {
      const todas = window.speechSynthesis.getVoices() || [];
      const alvo = vozId || vozPadrao(todas.length ? listarVozes() : []);
      const v = todas.find((x) => x.voiceURI === alvo);
      if (v) { u.voice = v; ehMasculina = MASC.test(v.name || ''); }
    } catch { /* usa a padrão do aparelho */ }
    // Voz já masculina fala no tom natural dela; nas outras vale o tom regulado.
    u.pitch = ehMasculina ? 1.0 : (tom == null ? lerTom() : tom);
    u.onstart = () => { if (aoIniciar) aoIniciar(); };
    u.onend = () => { if (aoTerminar) aoTerminar(); };
    u.onerror = () => { if (aoTerminar) aoTerminar(); };
    window.speechSynthesis.speak(u);
  } catch { if (aoTerminar) aoTerminar(); }
}

export function pararFala() {
  try { window.speechSynthesis.cancel(); } catch { /* ignora */ }
}

// Reconhecimento de fala (ouvir). O Safari do iPhone/iPad NÃO tem — nesse caso
// a dona usa o microfone do teclado, que funciona igual.
export const ReconhecimentoFala = () => (typeof window === 'undefined' ? null : (window.SpeechRecognition || window.webkitSpeechRecognition || null));
export const podeOuvir = () => !!ReconhecimentoFala();
