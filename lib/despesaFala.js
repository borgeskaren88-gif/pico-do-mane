// Entende uma despesa dita/digitada em linguagem solta ("supermercado 45,90",
// "paguei 30 reais de gelo", "R$ 120 fornecedor de cerveja") e devolve
// { valor, descricao, categoria } pra dona só confirmar. Nada aqui salva —
// é só interpretação, e tudo é editável na tela antes de lançar.
import { CUSTO_VARIAVEL, DESPESA_OPERACIONAL, DESPESA_NAO_OPERACIONAL } from './util';

const CATS = [...CUSTO_VARIAVEL, ...DESPESA_OPERACIONAL, ...DESPESA_NAO_OPERACIONAL];

// Palavra falada -> categoria existente. A primeira que casar vence.
const REGRAS = [
  [/supermerc|atacad|mercado|zé delivre|ze delivre/i, 'Supermercado'],
  [/emerg|repos/i, 'Reposição Emergencial'],
  [/insumo|fornecedor|distribuidor|cerveja|chopp|bebida|refri|gelo|carv|narguile|tabac/i, 'Fornecedores de insumo'],
  [/sal[aá]rio|funcion|di[aá]ria|gar[cç]om|cozinh|pagamento de pessoal|equipe/i, 'Salários'],
  [/aluguel/i, 'Aluguel'],
  [/cart[aã]o|maquininha|taxa de cart/i, 'Taxas (cartões)'],
  [/internet|wi-?fi|net\b/i, 'Internet/Wifi'],
  [/assinatura/i, 'Assinaturas'],
  [/manuten|conserto|reparo|t[eé]cnico/i, 'Manutenções'],
  [/limpeza|faxina|produto de limpeza/i, 'Limpeza'],
  [/imposto|das\b|mei\b/i, 'Impostos (DAS MEI)'],
  [/lixo/i, 'Taxa de lixo'],
  [/sistema|software|app\b/i, 'Sistemas'],
  [/m[uú]sic|cach[eê]|som\b|dj\b/i, 'Cachê Musical'],
  [/investi|equipamento|reforma|obra|m[oó]vel|m[oó]veis/i, 'Investimento'],
  [/empr[eé]stimo|d[ií]vida|parcela do banco/i, 'Empréstimo/Dívida'],
];

export function categoriaPorTexto(texto) {
  const t = String(texto || '');
  for (const [re, cat] of REGRAS) if (re.test(t)) return cat;
  return 'A classificar';
}

// Extrai o primeiro valor em dinheiro do texto. Aceita "45", "45,90", "45.90",
// "1.234,56", "R$ 45", "45 reais". Devolve { valor, trecho } (trecho = o que
// casou, pra tirar da descrição).
function extrairValor(texto) {
  const m = String(texto || '').match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?|\d+(?:\.\d{1,2})?)/i);
  if (!m) return { valor: 0, trecho: '' };
  let s = m[1];
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56
  else if (s.includes(',')) s = s.replace(',', '.'); // 45,90
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // 1.234 (milhar)
  // senão: "45.90" já é decimal com ponto — deixa como está
  const valor = Math.round((parseFloat(s) || 0) * 100) / 100;
  return { valor, trecho: m[0] };
}

const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function parseDespesaFala(texto) {
  const t = String(texto || '').trim();
  const { valor, trecho } = extrairValor(t);
  let desc = t;
  if (trecho) desc = desc.replace(trecho, ' ');
  desc = desc
    .replace(/\b(reais|real|conto|contos|pila|pilas|r\$|paguei|gastei|comprei|de|no|na|do|da|foi|uns?|umas?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const categoria = categoriaPorTexto(t);
  return { valor, descricao: capitalizar(desc), categoria };
}
