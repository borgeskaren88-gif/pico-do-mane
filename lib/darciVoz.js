// Voz do Darci: falar em voz alta e guardar as preferências (qual voz e qual
// tom). Fica aqui pra a tela cheia e o balão flutuante usarem a MESMA voz.
//
// Limitação do iPhone: o Safari só entrega um conjunto fixo de vozes. As vozes
// baixadas em Ajustes → Acessibilidade → Conteúdo Falado (ex.: Felipe) e as da
// Siri NÃO ficam disponíveis para apps/sites. Em pt-BR sobra só voz feminina —
// por isso o tom é regulável: abaixando, ela soa masculina.

export const CHAVE_VOZ = 'picoos-voz-darci';
export const CHAVE_VOZ_NOME = 'picoos-voz-nome-darci'; // só pra escrever na tela
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
// "Natural" e "Online" são as vozes que o Edge busca na internet (Daniel,
// Antônio, Francisca) — falam bem melhor que as instaladas no aparelho.
export const MELHOR = /enhanced|premium|melhorad|aprimorad|neural|natural|online|siri/i;
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

// ---- Os ajustes viajam entre os aparelhos ----------------------------------
// Antes tudo ficava só dentro do navegador: o que a dona regulava no notebook
// não chegava no celular. Agora cada ajuste também sobe pro servidor, e todo
// aparelho lê os mesmos na hora de abrir.
//
// Fica de fora o "atender quando eu chamar": esse é de cada aparelho, porque o
// microfone aberto gasta bateria e nem todo navegador deixa escutar.
function subirPrefs(parcial) {
  if (typeof window === 'undefined') return;
  try {
    fetch('/api/darci/prefs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefs: parcial }),
    }).catch(() => { /* sem conexão: fica valendo o do aparelho */ });
  } catch { /* ignora */ }
}

let _prefsBaixadas = false;
// Puxa os ajustes do servidor e grava no aparelho. Devolve true se mudou algo,
// pra tela se redesenhar com o que veio.
export async function baixarPrefs() {
  if (typeof window === 'undefined' || _prefsBaixadas) return false;
  _prefsBaixadas = true;
  try {
    const r = await fetch('/api/darci/prefs', { cache: 'no-store' });
    const j = await r.json();
    if (!j || !j.ok || !j.prefs) return false;
    const p = j.prefs;
    let mudou = false;
    const por = (chave, valor) => {
      if (valor == null || valor === '') return;
      try {
        if (localStorage.getItem(chave) === String(valor)) return;
        localStorage.setItem(chave, String(valor));
        mudou = true;
      } catch { /* ignora */ }
    };
    por(CHAVE_NOME, p.nome);
    por(CHAVE_TOM, p.tom);
    por(CHAVE_SOTAQUE, p.sotaque);
    por(CHAVE_VOZ, p.vozId);
    por(CHAVE_VOZ_NOME, p.vozNome);
    por(CHAVE_MOTOR, p.motor);
    return mudou;
  } catch { return false; }
}

export function lerNome() {
  try { const s = (localStorage.getItem(CHAVE_NOME) || '').trim(); if (s) return s; } catch { /* ignora */ }
  return NOME_PADRAO;
}
export function lerSotaque() {
  try { const s = localStorage.getItem(CHAVE_SOTAQUE); if (s === 'leve' || s === 'manezinho' || s === 'carregado') return s; } catch { /* ignora */ }
  return SOTAQUE_PADRAO;
}
export function salvarSotaque(v) { try { localStorage.setItem(CHAVE_SOTAQUE, v); } catch { /* ignora */ } subirPrefs({ sotaque: v }); }

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

export function salvarNome(v) { const n = String(v || '').trim() || NOME_PADRAO; try { localStorage.setItem(CHAVE_NOME, n); } catch { /* ignora */ } subirPrefs({ nome: n }); }

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
export function salvarTom(v) { try { localStorage.setItem(CHAVE_TOM, String(v)); } catch { /* ignora */ } subirPrefs({ tom: Number(v) }); }
export function salvarVoz(id, nomeDaVoz) {
  const n = String(nomeDaVoz || '').trim();
  try { localStorage.setItem(CHAVE_VOZ, id); if (n) localStorage.setItem(CHAVE_VOZ_NOME, n); } catch { /* ignora */ }
  subirPrefs(n ? { vozId: id, vozNome: n } : { vozId: id });
}
export function lerVozNome() { try { return localStorage.getItem(CHAVE_VOZ_NOME) || ''; } catch { return ''; } }
// A voz escolhida existe NESTE aparelho? Voz da Microsoft/Windows não existe no
// iPhone: o arquivo dela mora no computador. Serve pra avisar em vez de trocar
// calado e a dona achar que o ajuste não pegou.
export function vozEscolhidaFalta(lista) {
  let salva = '';
  try { salva = localStorage.getItem(CHAVE_VOZ) || ''; } catch { return false; }
  if (!salva || !Array.isArray(lista) || !lista.length) return false;
  return !lista.some((v) => v && v.voiceURI === salva);
}

// ---- Voz exclusiva (nuvem) --------------------------------------------------
// Quando o PicoOS tem chave de um serviço de voz configurada na Vercel, o Darci
// fala com a voz DELE — a mesma no celular, no iPad e no notebook, e lendo
// português direito. Sem chave (ou sem internet), cai sozinho na voz do
// aparelho, que é o que sempre foi.
export const CHAVE_MOTOR = 'picoos-motor-voz-darci'; // 'exclusiva' | 'aparelho'

export function lerMotorVoz() {
  try { return localStorage.getItem(CHAVE_MOTOR) === 'aparelho' ? 'aparelho' : 'exclusiva'; } catch { return 'exclusiva'; }
}
export function salvarMotorVoz(v) { const m = v === 'aparelho' ? 'aparelho' : 'exclusiva'; try { localStorage.setItem(CHAVE_MOTOR, m); } catch { /* ignora */ } subirPrefs({ motor: m }); }

let _disponivel = null; // null = ainda não perguntei
export async function vozExclusivaDisponivel() {
  if (_disponivel !== null) return _disponivel;
  try {
    const r = await fetch('/api/darci/voz', { cache: 'no-store' });
    const j = await r.json();
    _disponivel = !!(j && j.ok && j.disponivel);
  } catch { _disponivel = false; }
  return _disponivel;
}

// O tocador de áudio é um só, criado uma vez. No iPhone o navegador só deixa
// tocar som depois de um toque da pessoa — por isso a gente "destrava" ele no
// primeiro toque, tocando um silêncio. Sem isso o áudio da nuvem sai mudo.
let _audio = null;
let _destravado = false;
let _pararNuvem = null; // corta a fala da nuvem no meio, quando a dona manda parar
const SILENCIO = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAADAAABAADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA//////////////////////////////////8AAAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAJAAAAAAAAAAAAQEEAAAAAAAAAAAAAAAAAAAA//sQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

function tocador() {
  if (_audio) return _audio;
  if (typeof window === 'undefined') return null;
  try { _audio = new Audio(); _audio.preload = 'auto'; } catch { _audio = null; }
  return _audio;
}
export function destravarAudio() {
  if (_destravado) return;
  const a = tocador();
  if (!a) return;
  _destravado = true;
  try { a.src = SILENCIO; const p = a.play(); if (p && p.catch) p.catch(() => { /* sem problema */ }); } catch { /* ignora */ }
}

// Fala pela nuvem. Devolve true se conseguiu; false pra quem chamou usar a voz
// do aparelho no lugar.
async function falarNaNuvem(texto, aoIniciar, aoTerminar) {
  const a = tocador();
  if (!a) return false;
  let url = '';
  try {
    const r = await fetch('/api/darci/voz', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    });
    if (!r.ok) return false;
    const blob = await r.blob();
    if (!blob || blob.size < 200) return false;
    url = URL.createObjectURL(blob);
  } catch { return false; }
  return new Promise((resolve) => {
    let acabou = false;
    // `avisar` diz se quem pediu a fala deve ser avisado de que ela terminou.
    // Quando o áudio falha, não avisa: a voz do aparelho vai assumir e é ela
    // quem vai dar o aviso no fim.
    const encerrar = (ok, avisar) => {
      if (acabou) return;
      acabou = true;
      a.onplay = null; a.onended = null; a.onerror = null;
      _pararNuvem = null;
      try { URL.revokeObjectURL(url); } catch { /* ignora */ }
      if (avisar && aoTerminar) aoTerminar();
      resolve(ok);
    };
    _pararNuvem = () => { try { a.pause(); a.currentTime = 0; } catch { /* ignora */ } encerrar(true, true); };
    a.onplay = () => { if (aoIniciar) aoIniciar(); };
    a.onended = () => encerrar(true, true);
    a.onerror = () => encerrar(false, false);
    try {
      a.src = url;
      const p = a.play();
      if (p && p.catch) p.catch(() => encerrar(false, false));
    } catch { encerrar(false, false); }
  });
}

// Fala um texto. No iPhone precisa vir de um toque da dona — e vem.
export function falarTexto(texto, { vozId, tom, nome, sotaque, aoIniciar, aoTerminar } = {}) {
  const pronto = textoParaFala(texto, nome, sotaque);
  // Primeiro tenta a voz exclusiva; se não tiver, ou der qualquer problema,
  // usa a voz do aparelho sem a dona perceber a troca.
  if (typeof window !== 'undefined' && lerMotorVoz() === 'exclusiva') {
    pararFala();
    vozExclusivaDisponivel().then((ok) => {
      if (!ok) return falarNoAparelho(pronto, { vozId, tom, aoIniciar, aoTerminar });
      return falarNaNuvem(pronto, aoIniciar, aoTerminar).then((deu) => {
        if (!deu) falarNoAparelho(pronto, { vozId, tom, aoIniciar, aoTerminar });
      });
    }).catch(() => falarNoAparelho(pronto, { vozId, tom, aoIniciar, aoTerminar }));
    return;
  }
  falarNoAparelho(pronto, { vozId, tom, aoIniciar, aoTerminar });
}

// A voz de fábrica do aparelho — o jeito que sempre funcionou.
function falarNoAparelho(pronto, { vozId, tom, aoIniciar, aoTerminar } = {}) {
  if (!temVoz()) { if (aoTerminar) aoTerminar(); return; }
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(pronto);
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
  // Cala também a voz da nuvem, senão ela continua tocando sozinha.
  try { if (_pararNuvem) _pararNuvem(); } catch { /* ignora */ }
}

// Reconhecimento de fala (ouvir). O Safari do iPhone/iPad NÃO tem — nesse caso
// a dona usa o microfone do teclado, que funciona igual.
export const ReconhecimentoFala = () => (typeof window === 'undefined' ? null : (window.SpeechRecognition || window.webkitSpeechRecognition || null));
export const podeOuvir = () => !!ReconhecimentoFala();
