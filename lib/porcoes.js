import { num, uid, todayISO } from './util';
import { qtdNaUnidadeDoItem, aplicarMovimentoItem, MAX_MOV, ehPorcionado, linhaDe, salvaDe, baixarDosFreezers } from './estoque';

// Os quatro primitivos moram em estoque.js, junto da baixa de venda que os usa.
// Reexportados aqui pra quem pensa em "porção" ter um lugar só pra olhar.
export { ehPorcionado, linhaDe, salvaDe, baixarDosFreezers };

// PORCIONAMENTO — do pacote fechado ao saco pronto pra fritar.
//
// O estoque sabia contar pacote fechado. Mas ninguém vende pacote fechado: o
// que atende a mesa é o SACO JÁ SEPARADO, e é ele que falta às onze da noite.
// Entre a caixa de 15 kg de carne e a porção que sai pro salão existe um
// trabalho — pesar e ensacar — que o sistema não enxergava. Por isso a cozinha
// só descobria a falta na hora de fritar, e a dona só descobria depois.
//
// São TRÊS lugares, e essa é a ideia toda:
//
//   ESTOQUE ........ o pacote fechado, ainda não separado
//   SALVA-VIDAS .... o freezer de trás, os sacos já separados de reserva
//   LINHA DE FRENTE  o freezer da boca do fogão, o que a noite come
//
// A venda come da LINHA DE FRENTE. Quando ela baixa do mínimo, alguém tem que
// ir no Salva-Vidas buscar. Quando o Salva-Vidas baixa do mínimo, alguém tem
// que SEPARAR. Quando não tem pacote pra separar, alguém tem que COMPRAR.
//
// Cada uma dessas três frases é uma pessoa diferente sendo avisada na hora
// certa — e é isso que o sistema passa a fazer sozinho.

// Quanto do item BRUTO sai por saco, já na unidade em que o bruto é contado.
// Ex.: saco de 400 g de batata, batata cadastrada em kg -> 0,4.
//
// A conversão é a MESMA que a ficha técnica usa. Uma segunda régua aqui seria
// uma segunda chance de divergir do custo — e o custo do saco tem que ser o
// mesmo, seja quem for que pergunte.
export function consumoPorSaco(item, bruto) {
  if (!ehPorcionado(item) || !bruto) return 0;
  const s = item.separar;
  const q = qtdNaUnidadeDoItem(num(s.gramas), s.unidade || 'g', bruto);
  return q > 0 ? q : 0;
}

const inteiro = (v) => Math.max(0, Math.round(num(v)));

// O retrato de um produto porcionado: onde ele está, quanto falta em cada
// lugar, e a frase que diz o que fazer.
export function estadoDaPorcao(item, bruto) {
  const s = (item && item.separar) || {};
  const linha = linhaDe(item);
  const salva = salvaDe(item);
  const minLinha = inteiro(s.minLinha);
  const minSalva = inteiro(s.minSalva);
  const total = linha + salva;
  const alvo = minLinha + minSalva;

  // Quantos sacos levar do fundo pra frente — limitado pelo que existe no fundo.
  const faltaLinha = Math.max(0, minLinha - linha);
  const podeAbastecer = Math.min(faltaLinha, salva);

  // Quantos sacos separar pra fechar os DOIS mínimos. O alvo é a soma: separar
  // só até o mínimo da linha deixaria a reserva vazia, e a reserva existe
  // justamente pra ninguém ter que correr no meio do serviço.
  const precisaSeparar = Math.max(0, alvo - total);

  // Quantos sacos o pacote fechado ainda dá. Sem item bruto cadastrado não dá
  // pra afirmar nada — e `null` diz isso, enquanto `0` diria "acabou".
  const porSaco = consumoPorSaco(item, bruto);
  const rendeDoBruto = bruto && porSaco > 0 ? Math.floor(num(bruto.saldo) / porSaco) : null;
  const precisaComprar = rendeDoBruto == null ? 0 : Math.max(0, precisaSeparar - rendeDoBruto);

  let nivel = 'ok';
  if (minLinha > 0 && linha <= 0) nivel = 'vazio';
  else if (linha < minLinha) nivel = 'critico';
  else if (salva < minSalva) nivel = 'atencao';

  return {
    id: item && item.id, nome: (item && item.nome) || '',
    linha, salva, total, minLinha, minSalva,
    faltaLinha, podeAbastecer, precisaSeparar,
    porSaco, rendeDoBruto, precisaComprar,
    brutoNome: (bruto && bruto.nome) || '', brutoSaldo: bruto ? num(bruto.saldo) : null,
    brutoUnidade: (bruto && bruto.unidade) || '',
    nivel,
    recado: recadoDaPorcao({ linha, minLinha, salva, minSalva, podeAbastecer, faltaLinha, precisaSeparar, rendeDoBruto, precisaComprar }),
  };
}

// A frase que a cozinha lê. Tem que ser uma ORDEM com número, não um estado:
// "tem 2" faz pensar, "leva 3 do salva-vidas" faz levantar.
export function recadoDaPorcao(e) {
  if (e.linha < e.minLinha) {
    const ondeEstou = e.linha <= 0 ? 'A linha de frente ZEROU' : `A linha de frente tem ${e.linha}`;
    if (e.podeAbastecer > 0 && e.podeAbastecer >= e.faltaLinha) {
      return `${ondeEstou}. Pega ${e.faltaLinha} no Salva-Vidas e leva pra frente.`;
    }
    if (e.podeAbastecer > 0) {
      return `${ondeEstou}. Leva os ${e.podeAbastecer} que tem no Salva-Vidas — e separa mais ${e.precisaSeparar}.`;
    }
    return `${ondeEstou} e o Salva-Vidas está vazio. Separa ${Math.max(e.faltaLinha, e.precisaSeparar)} agora.`;
  }
  if (e.salva < e.minSalva) {
    const quanto = Math.max(1, e.precisaSeparar);
    if (e.precisaComprar > 0 && e.rendeDoBruto != null) {
      return e.rendeDoBruto > 0
        ? `Separa ${e.rendeDoBruto} — é tudo que o pacote dá. Faltam ${e.precisaComprar} e precisa comprar mais.`
        : `Precisa separar ${quanto}, mas não tem pacote fechado. Avisa a Karen.`;
    }
    return `Separa ${quanto} pro Salva-Vidas.`;
  }
  return '';
}

// A ordem em que a cozinha deve olhar: primeiro o que para a venda hoje.
const PESO = { vazio: 0, critico: 1, atencao: 2, ok: 3 };

export function painelDasPorcoes(estoque = []) {
  const porId = new Map((estoque || []).map((it) => [it.id, it]));
  const lista = (estoque || [])
    .filter(ehPorcionado)
    .map((it) => estadoDaPorcao(it, porId.get(it.separar.brutoId) || null))
    .sort((a, b) => (PESO[a.nivel] - PESO[b.nivel]) || (a.nome || '').localeCompare(b.nome || ''));
  return {
    lista,
    // Contas prontas pro aviso, pra tela não ter que refazer nenhuma.
    aFazer: lista.filter((p) => p.nivel !== 'ok'),
    vazios: lista.filter((p) => p.nivel === 'vazio'),
    aSeparar: lista.filter((p) => p.precisaSeparar > 0),
    aComprar: lista.filter((p) => p.precisaComprar > 0),
  };
}

// ---------------------------------------------------------------------------
// OS TRÊS MOVIMENTOS
// ---------------------------------------------------------------------------
// Todos devolvem objetos NOVOS e todos deixam RASTRO no histórico do item. O
// rastro é metade do pedido: "pra eu poder cobrar" só funciona se estiver
// escrito quem separou, quanto e quando — senão a conversa vira memória contra
// memória, e nessa ninguém ganha.

const tresCasas = (v) => Math.max(0, Math.round(num(v) * 1000) / 1000);

// Anexa o movimento no item. `saldoDepois` é lido do item JÁ mexido, pra linha
// do histórico bater com o que a tela mostra no mesmo instante.
const registrar = (item, mov) => ({
  ...item,
  atualizadoEm: todayISO(),
  movimentos: [
    { id: uid(), ...mov, saldoDepois: num(item.saldo), data: todayISO(), ts: Date.now() },
    ...(item.movimentos || []),
  ].slice(0, MAX_MOV),
});

const assina = (quem) => (quem ? ` — ${quem}` : '');

// SEPAREI: saiu do pacote fechado, entrou no Salva-Vidas. Mexe em DOIS itens ao
// mesmo tempo, e se o pacote não dá conta não mexe em nenhum dos dois.
//
// A baixa do pacote vai pelo caminho normal de saída (aplicarMovimentoItem), e
// não por uma conta escrita aqui: assim os lotes de validade continuam sendo
// comidos do mais velho pro mais novo, como em qualquer outra saída. Uma
// segunda conta própria aqui seria uma segunda chance de discordar da primeira.
export function separarSacos(item, bruto, sacos, quem = '') {
  const n = inteiro(sacos);
  if (!ehPorcionado(item) || !bruto || n <= 0) return null;
  const porSaco = consumoPorSaco(item, bruto);
  if (!(porSaco > 0)) return null;
  const gasto = Math.round(n * porSaco * 1000) / 1000;
  const salva = salvaDe(item) + n;
  const comSacos = { ...item, salva, saldo: tresCasas(linhaDe(item) + salva) };
  return {
    item: registrar(comSacos, { tipo: 'porcao', qtd: n, motivo: `Separou ${n} — foi pro Salva-Vidas${assina(quem)}` }),
    bruto: aplicarMovimentoItem(bruto, 'saida', gasto, `Separado em ${n} × ${item.nome || 'porção'}${assina(quem)}`),
    gasto,
  };
}

// LEVEI PRA FRENTE: do Salva-Vidas pra Linha de Frente. O total não muda —
// mudou de freezer, não de quantidade.
export function abastecerLinha(item, sacos, quem = '') {
  if (!ehPorcionado(item)) return null;
  // Não dá pra levar o que não tem: leva o que existe e diz quantos foram.
  const n = Math.min(inteiro(sacos), salvaDe(item));
  if (n <= 0) return null;
  const linha = linhaDe(item) + n;
  const salva = salvaDe(item) - n;
  const movido = { ...item, linha, salva, saldo: tresCasas(linha + salva) };
  return {
    item: registrar(movido, { tipo: 'porcao', qtd: n, motivo: `Levou ${n} do Salva-Vidas pra Linha de Frente${assina(quem)}` }),
    movidos: n,
  };
}

// CONTEI: a contagem física manda. É o único jeito de consertar o que a
// correria comeu sem ninguém apontar.
export function contarPorcao(item, linha, salva, quem = '') {
  if (!ehPorcionado(item)) return null;
  const l = inteiro(linha);
  const s = inteiro(salva);
  const antes = `${linhaDe(item)}+${salvaDe(item)}`;
  const contado = { ...item, linha: l, salva: s, saldo: tresCasas(l + s) };
  return {
    item: registrar(contado, { tipo: 'contagem', qtd: l + s, motivo: `Contagem dos freezers: ${l} na frente, ${s} no fundo (estava ${antes})${assina(quem)}` }),
  };
}
