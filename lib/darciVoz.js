// Voz do Darci: falar em voz alta e guardar as preferências (qual voz e qual
// tom). Fica aqui pra a tela cheia e o balão flutuante usarem a MESMA voz.
//
// Limitação do iPhone: o Safari só entrega um conjunto fixo de vozes. As vozes
// baixadas em Ajustes → Acessibilidade → Conteúdo Falado (ex.: Felipe) e as da
// Siri NÃO ficam disponíveis para apps/sites. Em pt-BR sobra só voz feminina —
// por isso o tom é regulável: abaixando, ela soa masculina.

export const CHAVE_VOZ = 'picoos-voz-darci';
export const CHAVE_TOM = 'picoos-tom-darci';
export const TOM_PADRAO = 0.7;
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

// Escolhe a melhor voz: a salva pela dona; senão uma masculina de pt-BR; senão
// a primeira de pt-BR.
export function vozPadrao(vozes) {
  let salva = '';
  try { salva = localStorage.getItem(CHAVE_VOZ) || ''; } catch { /* ignora */ }
  if (salva && vozes.some((v) => v.voiceURI === salva)) return salva;
  const pt = vozes.filter(ehPt);
  const br = pt.filter((v) => /pt[-_]BR/i.test(v.lang || ''));
  const escolha = br.find((v) => MASC.test(v.name || '')) || pt.find((v) => MASC.test(v.name || '')) || br[0] || pt[0] || vozes[0];
  return escolha ? escolha.voiceURI : '';
}

export function lerTom() {
  try { const s = parseFloat(localStorage.getItem(CHAVE_TOM)); if (s >= 0.5 && s <= 1.2) return s; } catch { /* ignora */ }
  return TOM_PADRAO;
}
export function salvarTom(v) { try { localStorage.setItem(CHAVE_TOM, String(v)); } catch { /* ignora */ } }
export function salvarVoz(id) { try { localStorage.setItem(CHAVE_VOZ, id); } catch { /* ignora */ } }

// Fala um texto. No iPhone precisa vir de um toque da dona — e vem.
export function falarTexto(texto, { vozId, tom, aoIniciar, aoTerminar } = {}) {
  if (!temVoz()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(texto).replace(/R\$\s?/g, 'reais ').replace(/\s+/g, ' '));
    u.lang = 'pt-BR';
    u.rate = 1.0;
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
