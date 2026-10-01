// META DO MÊS.
//
// "Quero que no meu Dashboard apareça algo assim, com uma meta."
//
// Um número grande de meta, sozinho, não ajuda ninguém: no dia 3 ela não sabe
// se está bem ou mal, e no dia 28 já não dá tempo de reagir. O que decide é a
// conta do meio:
//
//   - onde ela DEVIA estar hoje (a meta repartida pelos dias de operação);
//   - quanto precisa POR DIA nos dias que ainda restam;
//   - e onde o mês vai fechar se o ritmo de agora continuar.
//
// Tudo é contado em DIAS DE OPERAÇÃO, não em dias de calendário. Um bar que
// abre de quarta a domingo tem 22 dias de venda em outubro, não 31 — repartir
// a meta por 31 daria um alvo diário que não existe, e ela ia se achar
// atrasada todo domingo de manhã.
import { num, ymOf, todayISO } from './util';

// Todos os dias de um mês, em ISO. `ym` é "2026-10".
export function diasDoMes(ym) {
  const s = String(ym || '');
  const ano = parseInt(s.slice(0, 4), 10);
  const mes = parseInt(s.slice(5, 7), 10);
  if (!(ano > 1970) || !(mes >= 1 && mes <= 12)) return [];
  // Dia 0 do mês seguinte = último dia deste.
  const ultimo = new Date(ano, mes, 0).getDate();
  const out = [];
  for (let d = 1; d <= ultimo; d++) out.push(`${s.slice(0, 7)}-${String(d).padStart(2, '0')}`);
  return out;
}

// O dia da semana de uma data ISO (0 = domingo). Meio-dia pra não escorregar
// um dia por causa de fuso.
export const diaSemanaDe = (iso) => new Date(`${iso}T12:00:00`).getDay();

// Os dias do mês em que o bar ABRE. Sem configuração, são todos — e aí a conta
// é a do calendário, que é melhor do que conta nenhuma.
export function diasDeOperacao(ym, diasSemana) {
  const todos = diasDoMes(ym);
  if (!Array.isArray(diasSemana) || !diasSemana.length || diasSemana.length >= 7) return todos;
  const abre = new Set(diasSemana.map(Number));
  return todos.filter((d) => abre.has(diaSemanaDe(d)));
}

// A meta deste mês: a que ela pôs pra ESTE mês, senão a que vale todo mês.
// Zero quer dizer "não definiu" — e aí a tela convida, em vez de inventar.
export function metaDoMes(metas, ym) {
  if (!metas || typeof metas !== 'object') return 0;
  const propria = metas[ym];
  if (propria !== undefined && propria !== null && String(propria).trim() !== '') return num(propria);
  return num(metas.padrao);
}

// Quais dias da semana ela realmente abre, lidos do próprio movimento. Serve
// de sugestão na hora de configurar: ela confirma ou corrige, mas não precisa
// lembrar de cabeça.
export function diasSemanaDoMovimento(receitas = [], hoje = todayISO(), dias = 90) {
  const desde = new Date(`${hoje}T12:00:00`);
  desde.setDate(desde.getDate() - dias);
  const limite = desde.toISOString().slice(0, 10);
  const porDia = new Map();
  for (const r of receitas) {
    if (!r || !r.data || r.data < limite || r.data > hoje) continue;
    if (!(num(r.valor) > 0)) continue;
    porDia.set(r.data, true);
  }
  const conta = [0, 0, 0, 0, 0, 0, 0];
  for (const d of porDia.keys()) conta[diaSemanaDe(d)]++;
  const maior = Math.max(...conta);
  if (!maior) return null;
  // Um dia entra se teve movimento em pelo menos um terço das vezes que o dia
  // mais forte teve. Abrir uma quarta-feira excepcional não vira "abro quartas".
  return conta.map((n, i) => (n >= Math.max(1, maior / 3) ? i : -1)).filter((i) => i >= 0);
}

const r2 = (v) => Math.round(v * 100) / 100;

// A conta inteira do mês.
//
// `temReceitaHoje` importa mais do que parece: o caixa do dia é lançado no fim
// da noite. De manhã, contar o dia de hoje como "já decorrido" faria a média
// despencar e a tela gritaria atraso sem motivo; depois do caixa lançado, NÃO
// contar faria a projeção subir falsamente. Então quem conta é o fato.
export function calcularMeta({ metas, realizado = 0, ym = ymOf(todayISO()), hoje = todayISO(), temReceitaHoje = false }) {
  const meta = metaDoMes(metas, ym);
  const dias = diasDeOperacao(ym, metas && metas.diasSemana);
  const total = dias.length;
  const feito = Math.max(0, num(realizado));

  const hojeAbre = dias.includes(hoje);
  const terminados = dias.filter((d) => d < hoje).length;
  const decorridos = terminados + (hojeAbre && temReceitaHoje ? 1 : 0);
  // Hoje ainda conta como dia pra vender, se o bar abre hoje.
  const restantes = dias.filter((d) => d >= hoje).length - (hojeAbre && temReceitaHoje ? 1 : 0);

  const falta = r2(Math.max(0, meta - feito));
  const pct = meta > 0 ? feito / meta : 0;
  const porDia = restantes > 0 ? r2(falta / restantes) : 0;
  const media = decorridos > 0 ? r2(feito / decorridos) : 0;
  const projecao = decorridos > 0 ? r2(media * total) : 0;
  const ondeDeviaEstar = total > 0 ? r2((meta * decorridos) / total) : 0;
  // Ritmo: 1,00 é exatamente em cima da linha. 0,80 é 20% atrás.
  const ritmo = ondeDeviaEstar > 0 ? feito / ondeDeviaEstar : (feito > 0 ? 1 : 0);

  const semMeta = !(meta > 0);
  const bateu = !semMeta && feito >= meta - 0.005;
  const acabou = restantes <= 0;
  const estado = semMeta ? 'sem-meta'
    : bateu ? 'bateu'
      : acabou ? 'fechou-abaixo'
        : decorridos === 0 ? 'comecando'
          : ritmo >= 1.05 ? 'adiantada'
            : ritmo >= 0.95 ? 'no-ritmo'
              : ritmo >= 0.8 ? 'atras'
                : 'muito-atras';

  return {
    meta, realizado: r2(feito), falta, pct, ritmo,
    diasTotais: total, diasDecorridos: decorridos, diasRestantes: Math.max(0, restantes),
    porDia, media, projecao,
    pctProjecao: meta > 0 ? projecao / meta : 0,
    ondeDeviaEstar, estado, bateu, semMeta,
    // Quanto passou da meta, quando passou — é o número que dá gosto de ver.
    sobrou: bateu ? r2(feito - meta) : 0,
  };
}
