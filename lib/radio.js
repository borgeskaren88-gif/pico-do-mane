// O RÁDIO DO PICOOS — as regras, sem tela e sem banco.
//
// "Se eu quiser falar com a Sarah, aperto um botão e já falo, como se fosse um
// rádio." O PicoOS é um app de navegador, então o rádio funciona assim:
//
//   - quem fala SEGURA o botão, fala e solta;
//   - o recado sobe pro servidor (um áudio curto, no máximo MAX_SEGUNDOS);
//   - o servidor manda uma notificação pra quem deve ouvir;
//   - o celular com o PicoOS ABERTO toca o recado sozinho, no fone;
//   - o celular com a tela apagada mostra a notificação, e toca ao abrir.
//
// O áudio é WAV (som "cru", 16 mil amostras por segundo, uma voz só). Pesa
// mais que um formato comprimido, mas é o único que TODO aparelho toca: o
// formato que o Chrome grava o iPhone não toca, e o que o iPhone grava o
// Chrome do notebook às vezes não toca. Rádio que não toca não é rádio.

export const MAX_SEGUNDOS = 20;
export const TAXA = 16000;
// 20 s de WAV 16 kHz 16 bits = 640 KB; em base64, ~855 KB. Com folga.
export const MAX_BASE64 = 900 * 1024;
// Recado de rádio é do momento: some depois de um dia.
export const VALIDADE_MS = 24 * 60 * 60 * 1000;
export const PREFIXO = 'radio:';

// Os papéis que falam e ouvem. O Extra entra como Atendimento (é o mesmo
// crachá de trabalho), e quem anota as reservas ouve o "Todos".
export const PAPEIS_RADIO = ['dona', 'gerente', 'cozinha', 'garcom', 'reservas'];

// Pra quem dá pra mandar. "Todos" primeiro: é o mais usado num bar pequeno.
// O nome de cada um vem do cadastro (a dona é "Karen", a gerente é "Sarah"
// quando a jornada dela tem nome) — "Fala com a Sarah" é mais rápido de achar
// do que "Fala com a Gerente".
export function destinosDoRadio({ eu, nomes = {}, fechados = [] }) {
  const lista = [['todos', 'Todos']];
  for (const [papel, padrao] of [['dona', 'Dona'], ['gerente', 'Gerente'], ['cozinha', 'Cozinha'], ['garcom', 'Atendimento']]) {
    if (papel === eu) continue;
    if (fechados.includes(papel)) continue;
    lista.push([papel, String(nomes[papel] || padrao).trim() || padrao]);
  }
  return lista;
}

// Quem recebe um recado mandado pra `para`. Quem falou nunca recebe o próprio.
export function audienciaDo(para, de) {
  if (para === 'todos') return PAPEIS_RADIO.filter((p) => p !== de);
  return PAPEIS_RADIO.includes(para) && para !== de ? [para] : [];
}

// Um recado pode ser ouvido por quem falou e por quem estava na audiência.
export function podeOuvir(recado, papel) {
  if (!recado || !papel) return false;
  if (recado.de === papel) return true;
  return audienciaDo(recado.para, recado.de).includes(papel);
}

// Confere o áudio que chegou: base64 de um WAV de verdade, do tamanho certo.
// Devolve uma mensagem de erro em português, ou '' se está tudo bem.
export function conferirAudio(base64) {
  const b = String(base64 || '');
  if (!b) return 'Não chegou áudio nenhum.';
  if (b.length > MAX_BASE64) return `O recado ficou grande demais. Fala em até ${MAX_SEGUNDOS} segundos.`;
  if (!/^[A-Za-z0-9+/]+=*$/.test(b)) return 'O áudio chegou estragado. Tenta de novo.';
  // "UklGR" é como "RIFF" (o começo de todo arquivo WAV) fica em base64.
  if (!b.startsWith('UklGR')) return 'O áudio chegou num formato que eu não conheço.';
  return '';
}

// O id leva a hora na frente, com tamanho fixo: assim a ordem das chaves é a
// ordem do tempo, e apagar os velhos é comparar texto.
export const idDoRecado = (agora = Date.now()) => `${String(agora).padStart(13, '0')}-${Math.random().toString(36).slice(2, 8)}`;
export const horaDoId = (id) => Number(String(id || '').slice(0, 13)) || 0;
