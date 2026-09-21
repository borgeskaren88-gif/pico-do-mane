// Saldo de horas de quem bate ponto.
//
// O jeito antigo comparava duas coisas que não se encaixam: somava as horas
// trabalhadas em QUALQUER dia e punha contra as horas esperadas de TODOS os
// dias da escala do mês. Isso esconde o erro mais comum do bar:
//
//   A escala diz 16:00 → 00:00 (8h). A pessoa entra 15:53 e sai 22:00 (6h08),
//   toda vez. Pelo total do mês, se ela trabalhou num dia fora da escala, o
//   extra tapa o buraco dos outros e o saldo aparece POSITIVO — mesmo ela nunca
//   tendo fechado um turno inteiro.
//
// Aqui a conta é turno a turno: cada turno é comparado com o tamanho do turno
// da escala. E dia de escala em que ninguém bateu ponto conta como falta, com o
// sinal certo. Assim o número diz o que aconteceu, e dá pra apontar onde.

const parseHHMM = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));
  return m ? (+m[1] + (+m[2]) / 60) : null;
};

// Tamanho do turno da escala. 16:00 → 00:00 são 8h (vira a meia-noite).
export function horasJornada(j) {
  const e = parseHHMM(j && j.entrada);
  const s = parseHHMM(j && j.saida);
  if (e == null || s == null) return 0;
  let d = s - e;
  if (d <= 0) d += 24;
  return Math.round(d * 1000) / 1000;
}

// Horas de um turno batido.
export function horasDoTurno(r) {
  if (!r || !r.entrada || !r.saida) return 0;
  const ms = new Date(r.saida) - new Date(r.entrada);
  return Number.isFinite(ms) ? Math.max(0, Math.round((ms / 3600000) * 1000) / 1000) : 0;
}

const r3 = (x) => Math.round(x * 1000) / 1000;
// Dia da semana de uma data YYYY-MM-DD, sem cair na armadilha do fuso: às 12h
// nenhum fuso do Brasil muda o dia.
export const diaSemanaDe = (iso) => {
  try { return new Date(String(iso) + 'T12:00:00').getDay(); } catch { return -1; }
};

// Quantos dias tem um mês (YYYY-MM).
const diasNoMes = (mes) => {
  const [yy, mm] = String(mes).split('-').map(Number);
  return new Date(yy, mm, 0).getDate();
};

// Os dias de escala de um mês que já passaram.
//
// No mês corrente vai até ONTEM: o turno de hoje ainda pode acontecer, e cobrar
// por ele seria injusto. Em mês já fechado conta o mês inteiro. Mês no futuro
// não tem nada a cobrar.
export function diasDeEscala(jornada, mes, hojeISO) {
  const dias = (jornada && Array.isArray(jornada.dias)) ? jornada.dias : [];
  if (!dias.length) return [];
  const mesHoje = String(hojeISO).slice(0, 7);
  if (mes > mesHoje) return [];
  const ate = mes === mesHoje ? Number(String(hojeISO).slice(8, 10)) - 1 : diasNoMes(mes);
  const out = [];
  for (let d = 1; d <= ate; d++) {
    const iso = `${mes}-${String(d).padStart(2, '0')}`;
    if (dias.includes(diaSemanaDe(iso))) out.push(iso);
  }
  return out;
}

// O saldo de uma pessoa no mês, com o detalhe de onde ele se formou.
//
// `turnos`: registros de ponto da pessoa no mês (com data, entrada, saida).
// `jornada`: { dias: [0..6], entrada: 'HH:MM', saida: 'HH:MM' } do setor dela.
export function saldoDaPessoa(turnos, jornada, mes, hojeISO) {
  const lista = (Array.isArray(turnos) ? turnos : []).filter((r) => r && r.data);
  const trabalhado = r3(lista.reduce((s, r) => s + horasDoTurno(r), 0));
  const hd = horasJornada(jornada);
  const temEscala = hd > 0 && jornada && Array.isArray(jornada.dias) && jornada.dias.length > 0;

  // Sem escala configurada não há com o que comparar — e dizer "saldo zero"
  // seria pior que dizer "não sei".
  if (!temEscala) {
    return {
      trabalhado, esperado: null, saldo: null, temEscala: false,
      porTurno: lista.map((r) => ({ id: r.id, data: r.data, horas: horasDoTurno(r), esperado: null, diff: null, extra: false })),
      faltas: [], extras: 0, turnosCurtos: 0,
    };
  }

  const naEscala = new Set(jornada.dias);
  const porTurno = lista.map((r) => {
    const horas = horasDoTurno(r);
    const extra = !naEscala.has(diaSemanaDe(r.data));
    // Turno em dia fora da escala é hora extra inteira: não havia nada
    // esperado dele.
    const esperado = extra ? 0 : hd;
    return { id: r.id, data: r.data, horas, esperado, diff: r3(horas - esperado), extra, aberto: !r.saida };
  });

  // Dia de escala que passou sem ninguém bater ponto: falta.
  const comTurno = new Set(lista.map((r) => r.data));
  const faltas = diasDeEscala(jornada, mes, hojeISO).filter((d) => !comTurno.has(d));

  const esperado = r3(porTurno.reduce((s, t) => s + t.esperado, 0) + faltas.length * hd);
  return {
    trabalhado, esperado, saldo: r3(trabalhado - esperado), temEscala: true,
    porTurno, faltas, horasDia: hd,
    extras: porTurno.filter((t) => t.extra).length,
    turnosCurtos: porTurno.filter((t) => !t.extra && t.diff < -0.02).length,
  };
}

// O BANCO DE HORAS: o saldo somado dos meses, não só o do mês aberto.
//
// Zerar todo dia 1º faria a conta perder o sentido, porque é assim que isso é
// usado de verdade: quem sai 2h mais cedo no domingo paga entrando mais cedo
// depois, ou cobrindo um turno que a dona precisar — e "depois" quase sempre
// cai no mês seguinte.
//
// Só entram meses em que a pessoa TEM registro. Mês em que ela não apareceu
// nenhuma vez (férias, afastamento, ainda não trabalhava aqui) não vira uma
// pilha de faltas retroativas — isso seria uma dívida inventada pelo sistema.
export function saldoAcumulado(turnos, jornada, hojeISO) {
  const lista = (Array.isArray(turnos) ? turnos : []).filter((r) => r && r.data);
  const meses = [...new Set(lista.map((r) => String(r.data).slice(0, 7)))].sort();
  const porMes = meses.map((mes) => ({
    mes,
    s: saldoDaPessoa(lista.filter((r) => String(r.data).slice(0, 7) === mes), jornada, mes, hojeISO),
  }));
  const comEscala = porMes.filter((x) => x.s.temEscala);
  return {
    meses: porMes,
    temEscala: comEscala.length > 0,
    trabalhado: r3(porMes.reduce((s, x) => s + x.s.trabalhado, 0)),
    esperado: comEscala.length ? r3(comEscala.reduce((s, x) => s + x.s.esperado, 0)) : null,
    saldo: comEscala.length ? r3(comEscala.reduce((s, x) => s + x.s.saldo, 0)) : null,
  };
}

// O recado em uma frase: o que o saldo esconde.
export function recadoDoSaldo(s) {
  if (!s || !s.temEscala) return '';
  const partes = [];
  if (s.turnosCurtos > 0) {
    const perdidas = r3(s.porTurno.filter((t) => !t.extra && t.diff < 0).reduce((sum, t) => sum + -t.diff, 0));
    partes.push(`${s.turnosCurtos} turno(s) saíram antes da hora, somando ${fmtHoras(perdidas)} a menos.`);
  }
  if (s.faltas.length) partes.push(`${s.faltas.length} dia(s) de escala sem ponto batido.`);
  if (s.extras > 0) partes.push(`${s.extras} turno(s) em dia fora da escala contaram como extra.`);
  return partes.join(' ');
}

export function fmtHoras(h) {
  const t = Math.round(Math.abs(h) * 60);
  const hh = Math.floor(t / 60), mm = t % 60;
  return `${hh}h${mm > 0 ? ` ${mm}min` : ''}`;
}
