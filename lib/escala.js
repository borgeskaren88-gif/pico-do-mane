import { num, addDays, diaOperacional } from './util';
import { horaBR } from './movimento';

// "NO SÁBADO UMA PESSOA SOZINHA NÃO DÁ CONTA."
//
// Ela já sabe disso — sente no salão. O que ela não tem é o número pra decidir
// o tamanho do reforço, e é aí que dinheiro se perde dos dois lados: contratar
// um turno inteiro quando o aperto são três horas, ou não contratar nada e
// perder mesa na porta.
//
// A tela de Movimento já diz A QUE HORAS O BAR ENCHE. Isso sozinho não
// responde a pergunta dela: encher é bom. A pergunta é quanto salão cada
// pessoa está segurando SOZINHA — e pra isso falta cruzar o movimento com
// quem estava de plantão, que o ponto sabe.
//
// A CONTA, NUMA LINHA:
//
//     mesas por pessoa = mesas abertas ao mesmo tempo ÷ gente do salão batendo ponto
//
// E o que importa não é o número absoluto — não existe "5 mesas por garçom" de
// manual que sirva pro bar dela. O que importa é a COMPARAÇÃO com as outras
// horas dela mesma: se no sábado às 21h cada um segura três vezes mais mesa
// que na quinta, está ali o buraco, e é isso que ela consegue conferir com a
// própria memória.
const arr = (v) => (Array.isArray(v) ? v : []);
const NOMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// Mesmo teto da tela de Movimento, pela mesma razão: comanda esquecida aberta
// a noite toda não pode pintar o dia inteiro de movimento.
const MAX_HORAS_NA_MESA = 8;

const diaSemanaNum = (iso) => { try { return new Date(iso + 'T12:00:00').getDay(); } catch { return 0; } };

// As horas que um intervalo cobre, pela hora do relógio de Florianópolis.
// Devolve [] quando falta ponta — intervalo pela metade não vira chute.
function horasCobertas(inicioISO, fimISO, maxHoras) {
  const a = horaBR(inicioISO);
  if (a == null) return [];
  const b = horaBR(fimISO);
  if (b == null) return [a];
  // Quantas horas de relógio andou, virando a meia-noite quando precisa. Uma
  // mesa que abriu 23h e fechou 1h cobre 23, 0 e 1 — e continua sendo a noite
  // do dia em que ela abriu, não três dias diferentes.
  let n = b - a;
  if (n < 0) n += 24;
  n = Math.min(n, maxHoras);
  const saida = [];
  for (let i = 0; i <= n; i++) saida.push((a + i) % 24);
  return saida;
}

// Quanto salão cada pessoa segurou, por dia da semana e hora.
//
// `pontos` são os turnos batidos: { data, entrada, saida, papel, nome }.
// Só conta quem é do SALÃO ('garcom'): a cozinha não atende mesa, e somar ela
// aqui faria o sábado parecer coberto quando o salão estava sozinho.
export function cargaPorHora({ vendas = [], pontos = [], hoje = diaOperacional(), dias = 90 } = {}) {
  const desde = addDays(hoje, -dias);
  const noPeriodo = (d) => d && d >= desde && d <= hoje;

  // mesas[data][hora] e gente[data][hora] (gente = nomes distintos de plantão)
  const mesas = new Map();
  const gente = new Map();
  const datasComVenda = new Set();
  let semAbertura = 0, comAbertura = 0;

  for (const v of arr(vendas)) {
    if (!v || !noPeriodo(v.data)) continue;
    datasComVenda.add(v.data);
    if (!v.abertaEm || horaBR(v.abertaEm) == null) { semAbertura += 1; continue; }
    comAbertura += 1;
    const linha = mesas.get(v.data) || new Array(24).fill(0);
    for (const h of horasCobertas(v.abertaEm, v.fechadaEm, MAX_HORAS_NA_MESA)) linha[h] += 1;
    mesas.set(v.data, linha);
  }

  for (const r of arr(pontos)) {
    if (!r || r.papel !== 'garcom' || !noPeriodo(r.data)) continue;
    // Turno sem saída é turno em aberto: não dá pra saber até que hora foi.
    const horas = horasCobertas(r.entrada, r.saida, 16);
    if (!horas.length) continue;
    const linha = gente.get(r.data) || Array.from({ length: 24 }, () => new Set());
    for (const h of horas) linha[h].add(String(r.nome || '').toLowerCase());
    gente.set(r.data, linha);
  }

  // Dias em que o salão bateu ponto. É o denominador honesto: dia sem ponto
  // nenhum não vira "dia com zero garçom", vira dia que não dá pra julgar.
  const datasComPonto = new Set([...gente.keys()].filter((d) => datasComVenda.has(d)));

  const grade = NOMES.map((nome, idx) => ({
    idx,
    nome,
    dias: 0,
    horas: Array.from({ length: 24 }, (_, hora) => ({ hora, mesas: 0, pessoas: 0 })),
  }));

  for (const data of datasComPonto) {
    const i = diaSemanaNum(data);
    grade[i].dias += 1;
    const m = mesas.get(data) || new Array(24).fill(0);
    const g = gente.get(data) || Array.from({ length: 24 }, () => new Set());
    for (let h = 0; h < 24; h++) {
      grade[i].horas[h].mesas += m[h];
      grade[i].horas[h].pessoas += g[h].size;
    }
  }

  const r2 = (x) => Math.round(x * 100) / 100;
  const pronta = grade.map((d) => ({
    idx: d.idx,
    nome: d.nome,
    dias: d.dias,
    horas: d.horas.map((h) => {
      const mediaMesas = d.dias ? h.mesas / d.dias : 0;
      const mediaPessoas = d.dias ? h.pessoas / d.dias : 0;
      return {
        hora: h.hora,
        mesas: r2(mediaMesas),
        pessoas: r2(mediaPessoas),
        // Sem gente de plantão não existe "mesas por pessoa": dividir por zero
        // daria infinito e a tela mostraria o pior aperto do bar numa hora em
        // que ninguém estava trabalhando.
        porPessoa: mediaPessoas > 0 ? r2(mediaMesas / mediaPessoas) : null,
      };
    }),
  }));

  return {
    dias: pronta,
    diasAnalisados: datasComPonto.size,
    // O que NÃO deu pra usar, dito em voz alta. Dia com venda e sem ponto é o
    // caso comum no começo: a equipe ainda não bate ponto, e sem isso esta
    // conta inteira não existe.
    diasSemPonto: [...datasComVenda].filter((d) => !gente.has(d)).length,
    comandasSemAbertura: semAbertura,
    comandasComAbertura: comAbertura,
  };
}

// O APERTO: a faixa seguida de horas, num dia da semana, em que cada pessoa
// segurou mais mesa. É a resposta curta da pergunta dela.
//
// Faixa seguida, e não a hora campeã sozinha, porque ninguém contrata alguém
// pra uma hora: o que ela vai fazer com isto é chamar reforço das 20h às 23h.
export function ondeAperta(carga, { minMesas = 2 } = {}) {
  if (!carga || !carga.diasAnalisados) return null;

  // A média geral do bar, pra ter contra o que comparar. Só horas que têm
  // movimento de verdade — hora morta com meia mesa por pessoa puxaria a
  // referência pra baixo e faria qualquer hora cheia parecer um escândalo.
  const todas = [];
  for (const d of carga.dias) {
    for (const h of d.horas) {
      if (h.porPessoa != null && h.mesas >= minMesas) todas.push(h.porPessoa);
    }
  }
  if (todas.length < 3) return null;
  const media = todas.reduce((s, x) => s + x, 0) / todas.length;

  let melhor = null;
  for (const d of carga.dias) {
    if (!d.dias) continue;
    let atual = null;
    // Começa às 6h: a madrugada é o fim da noite anterior, e percorrer na
    // ordem do relógio partiria a faixa das 22h às 2h em duas.
    for (let i = 0; i <= 24; i++) {
      const h = i < 24 ? d.horas[(6 + i) % 24] : null;
      const aperta = h && h.porPessoa != null && h.mesas >= minMesas && h.porPessoa > media;
      if (aperta) {
        if (!atual) atual = { de: h.hora, ate: h.hora, soma: 0, n: 0, mesas: 0, pessoas: 0 };
        atual.ate = h.hora;
        atual.soma += h.porPessoa; atual.n += 1;
        atual.mesas = Math.max(atual.mesas, h.mesas);
        atual.pessoas += h.pessoas;
      } else if (atual) {
        const faixa = {
          dia: d.nome, diaIdx: d.idx, de: atual.de, ate: atual.ate,
          horas: atual.n,
          porPessoa: Math.round((atual.soma / atual.n) * 100) / 100,
          mesasNoPico: atual.mesas,
          pessoas: Math.round((atual.pessoas / atual.n) * 100) / 100,
          vezesAMedia: Math.round((atual.soma / atual.n / media) * 100) / 100,
        };
        // Pior é a que mais pesa NO CONJUNTO: uma hora solta a 4× incomoda
        // menos que quatro horas seguidas a 2,5×, que é um turno inteiro
        // apertado.
        if (!melhor || faixa.porPessoa * faixa.horas > melhor.porPessoa * melhor.horas) melhor = faixa;
        atual = null;
      }
    }
  }
  if (!melhor) return null;
  return { ...melhor, media: Math.round(media * 100) / 100 };
}

// O QUE CUSTA COBRIR ESSE APERTO.
//
// Sem isto a tela só dá razão pro medo dela. "Tá apertado" ela já sabia; o que
// decide é o preço de resolver, e o ponto conhece o valor da hora.
//
// Não prometo que o reforço "se paga": garçom não gera venda sozinho, ele
// evita perder. Prometo o custo, e digo quanto teria que entrar a mais pra
// empatar — que é uma conta que ela consegue olhar e julgar.
export function custoDoReforco({ faixa, valorHora, margemPct = 65, semanasPorMes = 4.33 }) {
  const vh = num(valorHora);
  const horas = faixa && faixa.horas;
  if (!(vh > 0) || !(horas > 0)) return null;
  const porDia = Math.round(vh * horas * 100) / 100;
  const porMes = Math.round(porDia * semanasPorMes * 100) / 100;
  const m = num(margemPct);
  return {
    porDia,
    porMes,
    // Quanto de venda a mais paga esse custo, com a margem dela. Margem de 65%
    // quer dizer que de cada real vendido sobram 65 centavos pra pagar a casa.
    vendaPraEmpatar: m > 0 ? Math.round((porMes / (m / 100)) * 100) / 100 : null,
  };
}
