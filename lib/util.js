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
