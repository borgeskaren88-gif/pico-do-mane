import { num, addDays, diaOperacional } from './util';

// A que horas o bar enche, e que dia da semana paga as contas.
//
// Aqui mora uma armadilha que já deu número errado: a comanda guarda DOIS
// horários — a hora em que a mesa abriu e a hora em que a conta fechou — e eles
// respondem coisas diferentes:
//
//   - abertura   = a hora em que o pessoal CHEGA
//   - fechamento = a hora em que a conta SAI (todo mundo já está de pé)
//   - ocupação   = todas as horas em que a mesa ficou sentada
//
// Contar pela hora de fechamento faz uma mesa das 19h às 23h valer inteira às
// 23h. Some dez mesas assim e o gráfico jura que o pico é às 23h, quando às 23h
// o bar está esvaziando. Por isso 'abertura' NÃO cai mais pra hora de
// fechamento quando falta o dado: comanda velha, que fechou antes de o sistema
// guardar a hora de abrir, fica de fora e a tela diz quantas ficaram. Chute
// silencioso é pior que buraco declarado.
const arr = (v) => (Array.isArray(v) ? v : []);
const HORA_MS = 3600000;

// Teto pra uma mesa só. Comanda esquecida aberta a noite toda não pode pintar
// o dia inteiro de movimento.
const MAX_HORAS_NA_MESA = 8;

// Hora (0–23) no fuso de Florianópolis. Um ISO em UTC lido cru daria a hora
// errada — 22h daqui vira 1h da manhã lá.
export function horaBR(iso) {
  if (!iso) return null;
  try {
    const h = parseInt(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23',
    }).format(new Date(iso)), 10);
    return Number.isFinite(h) ? h : null;
  } catch { return null; }
}

export const totalDaVenda = (v) => num(v && v.total);

const novasHoras = () => Array.from({ length: 24 }, (_, h) => ({ hora: h, total: 0, mesas: 0, pessoas: 0 }));

// Recorta as vendas de um período que termina hoje.
export function vendasDoPeriodo(vendas, dias = 90, hoje = diaOperacional()) {
  const desde = addDays(hoje, -dias);
  return arr(vendas).filter((v) => v && v.data && v.data >= desde && v.data <= hoje);
}

// Quantas comandas do recorte já guardam a hora de abertura. É isso que decide
// se vale abrir a tela na visão boa ou na visão torta.
export function comAbertura(vendas) {
  return arr(vendas).filter((v) => v && v.abertaEm && horaBR(v.abertaEm) != null).length;
}

// 'cheio': a mesa conta em TODAS as horas em que ficou aberta. É o que mais se
// parece com "o salão estava cheio". O dinheiro dela é dividido por essas horas
// — não dá pra saber em que hora cada chope foi pedido, então rateio igual é a
// suposição mais honesta disponível.
function ocupacaoPorHora(vendas) {
  const horas = novasHoras();
  let usadas = 0, fora = 0;
  for (const v of arr(vendas)) {
    const h0 = horaBR(v && v.abertaEm);
    const ini = v && v.abertaEm ? new Date(v.abertaEm).getTime() : NaN;
    const fim = v && v.fechadaEm ? new Date(v.fechadaEm).getTime() : NaN;
    if (h0 == null || !Number.isFinite(ini) || !Number.isFinite(fim) || fim < ini) { fora += 1; continue; }
    const blocos = Math.min(MAX_HORAS_NA_MESA, Math.max(1, Math.ceil((fim - ini) / HORA_MS)));
    const fatia = totalDaVenda(v) / blocos;
    const pessoas = num(v.pessoas) || 0;
    for (let i = 0; i < blocos; i++) {
      const h = (h0 + i) % 24;
      horas[h].total += fatia;
      horas[h].mesas += 1;
      horas[h].pessoas += pessoas;
    }
    usadas += 1;
  }
  return { horas, usadas, fora };
}

// Faturamento e nº de mesas por hora do dia.
// `base`: 'abertura' (quando chegam) | 'cheio' (salão ocupado) | 'fechamento'.
export function porHora(vendas, base = 'abertura') {
  if (base === 'cheio') return { base, ...ocupacaoPorHora(vendas) };
  const horas = novasHoras();
  let usadas = 0, fora = 0;
  for (const v of arr(vendas)) {
    // Sem fallback no 'abertura': ou tem a hora certa, ou a comanda fica fora.
    const iso = base === 'abertura' ? (v && v.abertaEm) : (v && (v.fechadaEm || v.abertaEm));
    const h = horaBR(iso);
    if (h == null) { fora += 1; continue; }
    horas[h].total += totalDaVenda(v);
    horas[h].mesas += 1;
    horas[h].pessoas += num(v.pessoas) || 0;
    usadas += 1;
  }
  return { base, horas, usadas, fora };
}

// O gráfico tem que sair na ordem da NOITE, não na ordem do relógio. Começando
// em 0h, a madrugada — que é o fim da noite anterior — apareceria lá em cima,
// antes do fim de tarde. Começa às 6h (a virada do dia operacional) e a
// madrugada cai no fim, que é onde ela acontece de verdade.
export function ordemDaNoite(horas, inicio = 6) {
  return Array.from({ length: 24 }, (_, i) => horas[(inicio + i) % 24]);
}

// Faturamento por dia da semana, com média por dia aberto — somar não serve:
// se o bar abriu 8 sábados e 4 terças, o sábado ganharia só por ter mais dias.
const NOMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const diaSemanaNum = (iso) => { try { return new Date(iso + 'T12:00:00').getDay(); } catch { return 0; } };

export function porDiaSemana(vendas) {
  const dias = NOMES.map((nome, idx) => ({ idx, nome, total: 0, mesas: 0, pessoas: 0, datas: new Set() }));
  for (const v of arr(vendas)) {
    const d = v.data || '';
    if (!d) continue;
    const i = diaSemanaNum(d);
    dias[i].total += totalDaVenda(v);
    dias[i].mesas += 1;
    dias[i].pessoas += num(v.pessoas) || 0;
    dias[i].datas.add(d);
  }
  return dias.map((x) => {
    const aberturas = x.datas.size;
    return {
      idx: x.idx, nome: x.nome, total: Math.round(x.total * 100) / 100, mesas: x.mesas, pessoas: x.pessoas,
      aberturas,
      media: aberturas ? Math.round((x.total / aberturas) * 100) / 100 : 0,
      ticket: x.mesas ? Math.round((x.total / x.mesas) * 100) / 100 : 0,
    };
  });
}

// Junta as horas em blocos, pra ler rápido: nem sempre interessa hora a hora.
// A madrugada é uma faixa à parte — num bar ela é o fim da noite, não o começo
// do dia, e misturar ela com a tarde escondia as duas.
export function faixasDoDia(horas) {
  const faixas = [
    { rotulo: 'até 18h', horas: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] },
    { rotulo: '18h–20h', horas: [18, 19] },
    { rotulo: '20h–22h', horas: [20, 21] },
    { rotulo: '22h–0h', horas: [22, 23] },
    { rotulo: 'madrugada', horas: [0, 1, 2, 3, 4, 5] },
  ];
  return faixas.map((f) => {
    let total = 0, mesas = 0;
    for (const h of f.horas) { total += horas[h].total; mesas += horas[h].mesas; }
    return { rotulo: f.rotulo, total: Math.round(total * 100) / 100, mesas };
  });
}

// A leitura em uma frase — o que a Karen faria com isso. Muda conforme a base,
// porque a mesma barra alta quer dizer coisas diferentes em cada visão.
export function leituraDoHorario(horas, base = 'abertura') {
  const naOrdem = ordemDaNoite(horas).filter((h) => h.total > 0 || h.mesas > 0);
  if (naOrdem.length < 2) return '';
  const pico = [...naOrdem].sort((a, b) => b.total - a.total)[0];
  const primeira = naOrdem[0], ultima = naOrdem[naOrdem.length - 1];
  const hh = (h) => `${String(h).padStart(2, '0')}h`;
  const janela = `O movimento vai das ${hh(primeira.hora)} às ${hh(ultima.hora)}`;
  if (base === 'fechamento') {
    return `${janela}, e a maior parte das contas fecha às ${hh(pico.hora)}. `
      + 'Isso é a hora de ir embora, não a hora de bar cheio — pra escalar gente, olha "bar cheio".';
  }
  if (base === 'cheio') {
    return `${janela}, e o salão fica mais cheio às ${hh(pico.hora)}. `
      + 'É em torno dessa hora que tu precisa de gente suficiente no salão e a cozinha no ponto.';
  }
  return `${janela}, e a maior parte do pessoal chega às ${hh(pico.hora)}. `
    + 'Ter o salão pronto um pouco antes disso é o que evita mesa esperando.';
}
