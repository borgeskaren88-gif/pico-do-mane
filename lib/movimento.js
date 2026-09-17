import { num, addDays, diaOperacional, weekday, fiadoDaVenda } from './util';

// A que horas o bar enche, e que dia da semana paga as contas.
//
// A venda guarda DOIS horários: quando a mesa abriu e quando a conta fechou.
// Eles respondem perguntas diferentes:
//   - abertura = a que horas o pessoal CHEGA (é o que serve pra escalar gente,
//     decidir hora de abrir, programar música)
//   - fechamento = a que horas o bar esvazia
//
// Comandas fechadas antes desta mudança não têm a hora de abertura. Nesses
// casos vale a de fechamento, e a tela avisa — número torto com aviso é melhor
// que número torto sem aviso.
const arr = (v) => (Array.isArray(v) ? v : []);

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

// Recorta as vendas de um período que termina hoje.
export function vendasDoPeriodo(vendas, dias = 90, hoje = diaOperacional()) {
  const desde = addDays(hoje, -dias);
  return arr(vendas).filter((v) => v && v.data && v.data >= desde && v.data <= hoje);
}

// Faturamento e nº de mesas por hora do dia.
// `base`: 'abertura' (quando chegam) ou 'fechamento' (quando vão embora).
export function porHora(vendas, base = 'abertura') {
  const horas = Array.from({ length: 24 }, (_, h) => ({ hora: h, total: 0, mesas: 0, pessoas: 0 }));
  let semAbertura = 0;
  for (const v of arr(vendas)) {
    const querAbertura = base === 'abertura';
    if (querAbertura && !v.abertaEm) semAbertura += 1;
    const iso = querAbertura ? (v.abertaEm || v.fechadaEm) : (v.fechadaEm || v.abertaEm);
    const h = horaBR(iso);
    if (h == null) continue;
    horas[h].total += totalDaVenda(v);
    horas[h].mesas += 1;
    horas[h].pessoas += num(v.pessoas) || 0;
  }
  return { horas, semAbertura };
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
export function faixasDoDia(horas) {
  const faixas = [
    { rotulo: 'até 18h', de: 0, ate: 17 },
    { rotulo: '18h–20h', de: 18, ate: 19 },
    { rotulo: '20h–22h', de: 20, ate: 21 },
    { rotulo: '22h–0h', de: 22, ate: 23 },
  ];
  return faixas.map((f) => {
    let total = 0, mesas = 0;
    for (let h = f.de; h <= f.ate; h++) { total += horas[h].total; mesas += horas[h].mesas; }
    return { ...f, total: Math.round(total * 100) / 100, mesas };
  });
}

// A leitura em uma frase — o que a Karen faria com isso.
export function leituraDoHorario(horas) {
  const comAlgo = horas.filter((h) => h.total > 0);
  if (comAlgo.length < 2) return '';
  const pico = [...comAlgo].sort((a, b) => b.total - a.total)[0];
  const primeira = comAlgo[0], ultima = comAlgo[comAlgo.length - 1];
  const hh = (h) => `${String(h).padStart(2, '0')}h`;
  return `O movimento vai das ${hh(primeira.hora)} às ${hh(ultima.hora)}, e o pico é às ${hh(pico.hora)}. `
    + `É em torno do pico que vale ter gente suficiente no salão.`;
}
