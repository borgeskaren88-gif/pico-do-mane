// Paleta de cores dos hábitos (distintas, mas em tons terrosos que combinam
// com o app). Cada hábito recebe uma cor; o calendário pinta as bolinhas.
export const CORES_HABITO = ['#C56B4E', '#88937B', '#D3A45C', '#6E8CA0', '#9A7BA0', '#5E9C8F', '#C58BA0', '#8C7A5C'];

export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MESES_LONGO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Categorias sugeridas para finanças de casa.
export const CATEGORIAS_DESPESA = [
  'Supermercado', 'Restaurante', 'Gasolina', 'Casa', 'Carro', 'Saúde',
  'Lazer', 'Roupas', 'Investimento em casa', 'Aurora',
];
// "Inteligência" simples: adivinha a categoria pelo nome do item/compra.
// Retorna uma das CATEGORIAS_DESPESA, ou '' se não reconhecer.
const REGRAS_CATEGORIA = [
  ['Saúde', ['academia', 'farmacia', 'remedio', 'medico', 'dentista', 'consulta', 'exame', 'psico', 'terapia', 'plano de saude', 'vacina', 'fisio', 'nutri', 'hospital', 'oculista']],
  ['Investimento em casa', ['chaleira', 'geladeira', 'fogao', 'microondas', 'micro-ondas', 'liquidificador', 'sofa', 'movel', 'moveis', 'cama', 'colchao', 'eletro', 'panela', 'utensilio', 'decoracao', 'cortina', 'tapete', 'armario', 'mesa', 'cadeira', 'televisao', 'ventilador', 'ar condicionado', 'aspirador', 'reforma', 'ferramenta', 'luminaria']],
  ['Supermercado', ['mercado', 'supermercado', 'feira', 'hortifruti', 'atacado', 'padaria', 'acougue', 'sacolao']],
  ['Restaurante', ['restaurante', 'ifood', 'lanche', 'pizza', 'hamburguer', 'bar ', 'cafe', 'delivery', 'sushi', 'churrasc', 'doceria', 'sorvete', 'rappi']],
  ['Gasolina', ['gasolina', 'posto', 'combustivel', 'etanol', 'alcool', 'diesel', 'shell', 'ipiranga']],
  ['Carro', ['oficina', 'pneu', 'mecanic', 'ipva', 'revisao', 'estacionamento', 'lavagem', 'seguro auto', 'seguro do carro', 'pedagio', 'multa']],
  ['Lazer', ['cinema', 'netflix', 'spotify', 'show', 'viagem', 'passeio', 'jogo', 'game', 'streaming', 'disney', 'hbo', 'prime', 'parque', 'balada', 'ingresso', 'bar']],
  ['Roupas', ['roupa', 'calca', 'camiseta', 'camisa', 'tenis', 'sapato', 'vestido', 'blusa', 'renner', 'zara', 'riachuelo', 'shein', 'bolsa', 'oculos de sol', 'moda']],
  ['Aurora', ['aurora', 'racao', 'petshop', 'pet shop', 'veterinario', 'vet ', 'coleira']],
  ['Casa', ['aluguel', 'condominio', 'luz', 'conta de agua', 'internet', 'gas', 'energia', 'iptu', 'faxina', 'diarista', 'wifi']],
];
// Situação da parcela de uma compra de cartão num mês (YYYY-MM):
// recorrente = todo mês; parcelada = valor/parcelas por N meses.
export function parcelaDaCompra(compra, mes) {
  const [y1, m1] = String(compra.data || '').slice(0, 7).split('-').map(Number);
  const [y2, m2] = mes.split('-').map(Number);
  const diff = (y2 - y1) * 12 + (m2 - m1);
  if (compra.recorrente) return { diff, recorrente: true, parcelas: 0, valorParcela: Number(compra.valor) || 0, ativa: diff >= 0, indice: diff + 1 };
  const parcelas = Math.max(1, Number(compra.parcelas) || 1);
  return { diff, parcelas, valorParcela: (Number(compra.valor) || 0) / parcelas, ativa: diff >= 0 && diff < parcelas, indice: diff + 1 };
}

export function categoriaAuto(texto) {
  const t = ` ${String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')} `;
  for (const [cat, chaves] of REGRAS_CATEGORIA) {
    if (chaves.some((k) => t.includes(k))) return cat;
  }
  return '';
}

export const CATEGORIAS_RECEITA = [
  'Salário', 'Freela / Extra', 'Presente / Ajuda', 'Reembolso', 'Rendimentos', 'Outros',
];

// Valor em reais: 1234.5 -> "R$ 1.234,50"
export const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Converte texto digitado ("1.234,56" ou "1234.56") em número.
export const num = (v) => {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const s = String(v == null ? '' : v).trim().replace(/\s/g, '');
  // Se tem vírgula, tratamos como separador decimal brasileiro.
  const normal = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = parseFloat(normal);
  return isNaN(n) ? 0 : n;
};

// Data de HOJE no fuso do Brasil (America/Sao_Paulo), no formato YYYY-MM-DD.
// Usar toISOString() dava bug à noite (o UTC virava o dia seguinte).
export const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const ymOf = (iso) => (iso || '').slice(0, 7); // "2026-08-11" -> "2026-08"
export const ymHoje = () => ymOf(todayISO());
export const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
export const mesLabel = (ym) => `${MESES_LONGO[parseInt(ym.slice(5)) - 1]} de ${ym.slice(0, 4)}`;

// Vai/volta um mês no formato "YYYY-MM".
export const passoMes = (ym, delta) => {
  let ano = parseInt(ym.slice(0, 4), 10);
  let mes = parseInt(ym.slice(5), 10) - 1 + delta;
  ano += Math.floor(mes / 12);
  mes = ((mes % 12) + 12) % 12;
  return `${ano}-${String(mes + 1).padStart(2, '0')}`;
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
