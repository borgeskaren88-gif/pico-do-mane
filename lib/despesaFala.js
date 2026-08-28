// Entende uma despesa dita/digitada em linguagem solta e devolve
// { valor, descricao, categoria } pra dona só confirmar. Aceita valor em
// dígitos ("45", "45,90", "45 e 90") E por extenso, como o iPhone costuma
// transcrever a fala ("quarenta e cinco", "trinta reais", "cento e vinte reais
// e noventa centavos"). Nada aqui salva — é só interpretação, tudo editável.
import { CUSTO_VARIAVEL, DESPESA_OPERACIONAL, DESPESA_NAO_OPERACIONAL } from './util';

const CATS = [...CUSTO_VARIAVEL, ...DESPESA_OPERACIONAL, ...DESPESA_NAO_OPERACIONAL];

// tira acento e deixa minúsculo, pra casar "três"/"tres", "cinquenta" etc.
const semAcento = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Palavra falada -> categoria existente. A primeira que casar vence.
const REGRAS = [
  [/supermerc|atacad|mercado|ze delivre/, 'Supermercado'],
  [/emerg|repos/, 'Reposição Emergencial'],
  [/insumo|fornecedor|distribuidor|cerveja|chopp|bebida|refri|gelo|carv|narguile|tabac/, 'Fornecedores de insumo'],
  [/salario|funcion|diaria|garcom|cozinh|equipe|pagamento de pessoal/, 'Salários'],
  [/aluguel/, 'Aluguel'],
  [/cartao|maquininha/, 'Taxas (cartões)'],
  [/internet|wifi|wi-fi/, 'Internet/Wifi'],
  [/assinatura/, 'Assinaturas'],
  [/manuten|conserto|reparo|tecnico/, 'Manutenções'],
  [/limpeza|faxina/, 'Limpeza'],
  [/imposto|das |mei/, 'Impostos (DAS MEI)'],
  [/lixo/, 'Taxa de lixo'],
  [/sistema|software/, 'Sistemas'],
  [/music|cache|som |dj /, 'Cachê Musical'],
  [/investi|equipamento|reforma|obra|movel|moveis/, 'Investimento'],
  [/emprestimo|divida|parcela do banco/, 'Empréstimo/Dívida'],
];

export function categoriaPorTexto(texto) {
  const t = semAcento(texto) + ' ';
  for (const [re, cat] of REGRAS) if (re.test(t)) return cat;
  return 'A classificar';
}

// ---- número por extenso (pt-BR) ----
const UNI = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, meia: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19 };
const DEZ = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
const CEM = { cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900 };
const EH_NUM = (w) => w === 'mil' || UNI[w] != null || DEZ[w] != null || CEM[w] != null;

function palavrasParaNumero(tokens) {
  let total = 0, atual = 0, achou = false;
  for (const w of tokens) {
    if (w === 'e') continue;
    if (w === 'mil') { atual = (atual === 0 ? 1 : atual) * 1000; total += atual; atual = 0; achou = true; continue; }
    if (UNI[w] != null) { atual += UNI[w]; achou = true; continue; }
    if (DEZ[w] != null) { atual += DEZ[w]; achou = true; continue; }
    if (CEM[w] != null) { atual += CEM[w]; achou = true; continue; }
  }
  total += atual;
  return achou ? total : null;
}

// Valor em dígitos: "45", "45,90", "45.90", "45 e 90", "R$ 45", "1.234,50".
function valorDeDigitos(t) {
  const s = ' ' + semAcento(t).replace(/r\$/g, ' ') + ' ';
  // reais e centavos: 45,90 / 45.90 / 45 e 90
  let m = s.match(/(\d+)\s*(?:,|\.|\be\b)\s*(\d{1,2})(?!\d)/);
  if (m) return parseFloat(m[1] + '.' + m[2].padEnd(2, '0'));
  // milhar: 1.234
  m = s.match(/(\d{1,3}(?:\.\d{3})+)(?!\d)/);
  if (m) return parseFloat(m[1].replace(/\./g, ''));
  m = s.match(/(\d+)/);
  if (m) return parseFloat(m[1]);
  return null;
}

// Valor por extenso: separa reais e centavos por "reais"/"centavos".
function valorPorExtenso(t) {
  const tokens = semAcento(t).split(/[^a-z]+/).filter(Boolean);
  if (!tokens.some(EH_NUM)) return null;
  const iCent = tokens.indexOf('centavos');
  const iReais = tokens.findIndex((w) => w === 'reais' || w === 'real');
  let reaisTk, centTk = [];
  if (iCent >= 0) {
    const ini = iReais >= 0 ? iReais + 1 : 0;
    centTk = tokens.slice(ini, iCent);
    reaisTk = iReais >= 0 ? tokens.slice(0, iReais) : tokens.slice(0, ini);
  } else {
    reaisTk = iReais >= 0 ? tokens.slice(0, iReais) : tokens;
  }
  const reais = palavrasParaNumero(reaisTk);
  const cent = centTk.length ? palavrasParaNumero(centTk) : null;
  if (reais == null && cent == null) return null;
  return Math.round(((reais || 0) + (cent ? cent / 100 : 0)) * 100) / 100;
}

const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const NUMWORDS = 'zero|um|uma|dois|duas|tres|quatro|cinco|seis|meia|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|duzent[oa]s|trezent[oa]s|quatrocent[oa]s|quinhent[oa]s|seiscent[oa]s|setecent[oa]s|oitocent[oa]s|novecent[oa]s|mil';

// Descrição = o texto sem os números (dígitos ou por extenso) e sem palavras de
// ligação, pra sobrar só "o quê" (supermercado, gelo, fornecedor…).
function limparDescricao(t) {
  return semAcento(t)
    .replace(/\d+([.,]\d+)?/g, ' ')
    .replace(new RegExp('\\b(' + NUMWORDS + '|reais|real|centavos|conto|contos|pila|pilas|paguei|gastei|comprei|de|no|na|do|da|foi|uns|uma|umas|e)\\b', 'g'), ' ')
    .replace(/r\$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseDespesaFala(texto) {
  const t = String(texto || '').trim();
  let valor = valorDeDigitos(t);
  if (valor == null) valor = valorPorExtenso(t);
  valor = valor == null ? 0 : Math.round(valor * 100) / 100;
  return { valor, descricao: capitalizar(limparDescricao(t)), categoria: categoriaPorTexto(t) };
}
