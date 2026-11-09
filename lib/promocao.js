// PROMOÇÃO COM HORA MARCADA.
//
// "Hoje tive chopp a 9,99, fiz das 16h às 18h, aí 18h eu fui e desativei do
// cardápio." Ela trocava o preço na mão e desligava na mão. O problema é que
// 18h de um sábado é exatamente a hora em que ninguém lembra de desligar nada:
// o chopp fica 9,99 a noite inteira, a margem vai pro chão e ninguém vê.
//
// Então a promoção passa a ter horário. E, sobretudo:
//
// UM LUGAR DECIDE O PREÇO, E É O SERVIDOR.
//
// A tela do garçom NÃO calcula promoção. Ela mostra o preço que o servidor
// mandou. Se ela calculasse por conta própria, bastaria o relógio do iPad
// estar adiantado pra o garçom ver 9,99, o servidor cobrar 12,00 e o cliente
// discutir no caixa. Foi o mesmo erro das duas réguas de preço que cobrou cem
// vezes mais numa compra — aqui ele não se repete.

import { num, brl, DIAS, fmtDate } from './util';

const Z = 'America/Sao_Paulo';

// O RELÓGIO É O DE FLORIPA, NUNCA O DO SERVIDOR.
//
// A Vercel roda em UTC: quando é 16h no bar, lá são 19h. Promoção lida pelo
// relógio errado abre e fecha três horas fora — e no horário de verão viraria
// duas, depois três, sem ninguém entender por quê.
export function relogioBR(agora = new Date()) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-CA', {
    timeZone: Z, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(agora)) if (x.type !== 'literal') p[x.type] = x.value;
  const dia = `${p.year}-${p.month}-${p.day}`;
  return { dia, min: Number(p.hour) * 60 + Number(p.minute) };
}

// Dia da semana (0 = domingo) de uma data ISO. Lido em UTC de propósito: assim
// o resultado é o mesmo em qualquer máquina, e não muda se o servidor mudar.
export const diaDaSemana = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return isNaN(d) ? -1 : d.getUTCDay();
};

export const maisDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  if (isNaN(d)) return iso;
  d.setUTCDate(d.getUTCDate() + Number(n || 0));
  return d.toISOString().slice(0, 10);
};

// '16:00' -> 960 minutos. null quando não dá pra ler.
export function minutosDe(hhmm) {
  const m = /^\s*(\d{1,2})\s*:\s*(\d{2})\s*$/.exec(String(hhmm == null ? '' : hhmm));
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

export const horaDe = (min) => {
  const m = ((Math.round(Number(min) || 0) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export const promoVazia = () => ({ preco: '', de: '', ate: '', dias: [0, 1, 2, 3, 4, 5, 6], fim: '', ligada: true });

// OS DIAS, E O LADO SEGURO DA DÚVIDA.
//
// Lista de dias marcados vale como está — inclusive vazia, que quer dizer
// "nenhum dia", logo a promoção não pega. Promoção que pega sem ninguém ter
// marcado dia nenhum é dinheiro saindo sozinho; promoção que não pega é um
// toque na tela. Erra-se pro lado que não custa.
//
// Sem lista nenhuma (item antigo, campo nunca preenchido) são os sete dias:
// aí é promoção com hora marcada e sem dia escolhido, que é o pedido original.
const diasDe = (dias) => {
  if (!Array.isArray(dias)) return [0, 1, 2, 3, 4, 5, 6];
  const limpos = [];
  for (const d of dias) {
    const n = Math.floor(Number(d));
    if (n >= 0 && n <= 6 && !limpos.includes(n)) limpos.push(n);
  }
  return limpos;
};

// A promoção está montada direito? Devolve os números dela, ou null.
export function promoValida(promo) {
  if (!promo || promo.ligada === false) return null;
  const preco = num(promo.preco);
  const de = minutosDe(promo.de);
  const ate = minutosDe(promo.ate);
  if (!(preco > 0) || de == null || ate == null || de === ate) return null;
  return { preco, de, ate, dias: diasDe(promo.dias), fim: String(promo.fim || '').slice(0, 10) };
}

// A PROMOÇÃO ESTÁ VALENDO NESTE INSTANTE?
export function promoValeAgora(promo, agora = new Date()) {
  const p = promoValida(promo);
  if (!p) return false;
  const { dia, min } = relogioBR(agora);

  // QUANDO A PROMOÇÃO ATRAVESSA A MEIA-NOITE.
  //
  // "22:00 às 01:00" numa sexta vale até 1h da manhã do sábado — quem está no
  // bar à meia-noite e meia ainda está na sexta à noite. Então, de madrugada,
  // o dia que manda é o de ontem. Sem isso, marcar "sexta" desligaria a
  // promoção na virada, no meio do movimento.
  const vira = p.ate <= p.de;
  const dentro = vira ? (min >= p.de || min < p.ate) : (min >= p.de && min < p.ate);
  if (!dentro) return false;

  const diaQueVale = (vira && min < p.ate) ? maisDias(dia, -1) : dia;
  if (p.fim && diaQueVale > p.fim) return false;
  return p.dias.includes(diaDaSemana(diaQueVale));
}

// O PREÇO DESTE ITEM AGORA. É esta função que o servidor usa pra cobrar.
export function precoAgora(item, agora = new Date()) {
  const base = num(item && item.preco);
  if (!promoValeAgora(item && item.promo, agora)) return base;
  return num(item.promo.preco);
}

// O que a tela diz sobre a promoção deste item.
export function estadoDaPromo(item, agora = new Date()) {
  const promo = item && item.promo;
  const nada = { estado: 'nenhuma', texto: '', preco: 0 };
  if (!promo) return nada;
  if (promo.ligada === false) {
    const p = num(promo.preco);
    return { estado: 'desligada', preco: p, texto: p > 0 ? `Promoção de ${brl(p)} está desligada.` : 'Promoção desligada.' };
  }
  const p = promoValida(promo);
  if (!p) {
    const tem = String(promo.preco || '').trim() || String(promo.de || '').trim() || String(promo.ate || '').trim();
    return tem ? { estado: 'erro', preco: 0, texto: 'Promoção incompleta: falta preço ou horário.' } : nada;
  }
  if (promoValeAgora(promo, agora)) {
    return { estado: 'valendo', preco: p.preco, texto: `Valendo agora: ${brl(p.preco)} até ${horaDe(p.ate)}.` };
  }
  const { dia, min } = relogioBR(agora);
  if (p.fim && dia > p.fim) return { estado: 'acabou', preco: p.preco, texto: `Essa promoção acabou em ${fmtDate(p.fim)}.` };
  if (!p.dias.length) return { estado: 'erro', preco: p.preco, texto: 'Nenhum dia da semana marcado, então ela nunca pega.' };

  const valeNoDia = (d) => p.dias.includes(diaDaSemana(d)) && (!p.fim || d <= p.fim);
  if (min < p.de && valeNoDia(dia)) {
    return { estado: 'hoje', preco: p.preco, texto: `Começa hoje às ${horaDe(p.de)}, a ${brl(p.preco)}.` };
  }
  for (let i = 1; i <= 8; i += 1) {
    const d = maisDias(dia, i);
    if (valeNoDia(d)) {
      const quando = i === 1 ? 'amanhã' : `na ${DIAS[diaDaSemana(d)].toLowerCase()}`;
      return { estado: 'proxima', preco: p.preco, texto: `Volta ${quando} às ${horaDe(p.de)}, a ${brl(p.preco)}.` };
    }
  }
  return { estado: 'acabou', preco: p.preco, texto: 'Não volta mais: não sobrou dia nenhum pra frente.' };
}

// O erro que a tela do cardápio mostra ANTES de salvar.
export function erroDaPromo(promo, base) {
  if (!promo) return '';
  const temAlgo = String(promo.preco || '').trim() || String(promo.de || '').trim() || String(promo.ate || '').trim();
  if (!temAlgo) return '';
  if (!(num(promo.preco) > 0)) return 'Põe o preço da promoção.';
  if (minutosDe(promo.de) == null) return 'A hora de começar está estranha. Escreve assim: 16:00.';
  if (minutosDe(promo.ate) == null) return 'A hora de terminar está estranha. Escreve assim: 18:00.';
  if (minutosDe(promo.de) === minutosDe(promo.ate)) return 'A hora de começar e a de terminar estão iguais.';
  if (Array.isArray(promo.dias) && !promo.dias.length) return 'Marca pelo menos um dia da semana.';
  if (num(base) > 0 && num(promo.preco) >= num(base)) return `${brl(num(promo.preco))} não é mais barato que o preço normal (${brl(num(base))}).`;
  return '';
}

// Deixa a promoção pronta pra guardar. Sem preço ou sem horário não guarda
// nada: campo pela metade no banco é promoção que ninguém sabe se liga.
export function limparPromo(promo) {
  if (!promo) return null;
  const preco = num(promo.preco);
  const de = minutosDe(promo.de);
  const ate = minutosDe(promo.ate);
  if (!(preco > 0) || de == null || ate == null || de === ate) return null;
  return {
    preco: String(promo.preco).trim(),
    de: horaDe(de),
    ate: horaDe(ate),
    dias: diasDe(promo.dias),
    fim: /^\d{4}-\d{2}-\d{2}$/.test(String(promo.fim || '')) ? String(promo.fim) : '',
    ligada: promo.ligada !== false,
  };
}

// "todo dia" / "sex e sáb" — pra caber numa linha da lista.
export function diasEmTexto(dias) {
  const d = diasDe(dias);
  if (!d.length) return 'nenhum dia';
  if (d.length === 7) return 'todo dia';
  const curto = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  return [...d].sort((a, b) => a - b).map((x) => curto[x]).join(', ');
}
