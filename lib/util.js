// Entradas que NÃO são resultado da operação (não entram no lucro operacional):
// dinheiro de empréstimo/aporte que entra no caixa mas não é venda.
export const FONTES_NAO_OPERACIONAL = ['Empréstimo/Aporte'];
export const FONTES_RECEITA = ['Caixa', 'Caixa Ao Vivo', 'Promoções', 'Recebimento Atrasado', ...FONTES_NAO_OPERACIONAL];
export const CUSTO_VARIAVEL = [
  'Fornecedores de insumo', 'Zé Delivre + Supermercado', 'Compras Estratégicas (Supermercados)',
  'Reposição Emergencial', 'Supermercado', 'Cachê Musical', 'Extra', 'A classificar',
];
export const DESPESA_OPERACIONAL = [
  'Salários', 'Aluguel', 'Taxas (cartões)', 'Internet/Wifi', 'Assinaturas',
  'Manutenções', 'Limpeza', 'Impostos (DAS MEI)', 'Taxa de lixo', 'Sistemas',
];
// Saídas que NÃO são custo da operação (não entram no lucro operacional):
// investimento (equipamento, reforma) e pagamento de empréstimo/dívida.
export const DESPESA_NAO_OPERACIONAL = ['Investimento', 'Empréstimo/Dívida'];
export const CATEGORIAS_DESPESA = [...CUSTO_VARIAVEL, ...DESPESA_OPERACIONAL, ...DESPESA_NAO_OPERACIONAL];
export const CATEGORIAS_PRODUTO = ['Bebidas', 'Cozinha', 'Limpeza', 'Descartáveis/Apoio', 'Tabacaria', 'Sem cotação', 'Outros'];
export const DIAS = ['Domingo', 'Segunda-Feira', 'Terça-Feira', 'Quarta-Feira', 'Quinta-Feira', 'Sexta-Feira', 'Sábado'];
export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Converte texto para número, entendendo o padrão brasileiro E o ponto como
// decimal (o teclado do celular costuma digitar ponto). Regras:
//  - "1.234,50" -> 1234.5  (ponto = milhar, vírgula = decimal)
//  - "12,50"    -> 12.5    (vírgula = decimal)
//  - "12.50" / "12.5" -> 12.5  (ponto com 1-2 casas = decimal)
//  - "1.234" / "1.234.567" -> milhar (ponto com 3 casas ou vários pontos)
//  - número puro (12.5) -> 12.5  (sem mexer)
export const num = (v) => {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (v == null) return 0;
  let s = String(v).trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const temVirgula = s.includes(','), temPonto = s.includes('.');
  if (temVirgula && temPonto) s = s.replace(/\./g, '').replace(',', '.');
  else if (temVirgula) s = s.replace(',', '.');
  else if (temPonto) {
    const partes = s.split('.');
    const dec = partes[partes.length - 1];
    if (partes.length > 2 || dec.length === 3) s = partes.join(''); // milhar
    // senão (1 ou 2 casas): ponto é decimal — mantém como está
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};
// Quantidade (kg, L, unidades) é outra história do dinheiro: no teclado do
// celular e do iPad a tecla é PONTO, então quem digita 12.992 quer dizer 12 kg
// e 992 g — nunca doze mil. Aqui o último ponto (ou a vírgula) é sempre o
// decimal; pontos anteriores são separador de milhar.
export const numQtd = (v) => {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (v == null) return 0;
  const s = String(v).trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  let limpo;
  if (s.includes(',')) {
    // Com vírgula, ela manda: o resto é milhar.
    limpo = s.replace(/\./g, '').replace(',', '.');
  } else {
    const partes = s.split('.');
    limpo = partes.length > 1 ? partes.slice(0, -1).join('') + '.' + partes[partes.length - 1] : s;
  }
  const n = parseFloat(limpo);
  return isNaN(n) ? 0 : n;
};

// Quanto de uma venda do salão está no fiado. Vendas novas guardam v.fiado;
// as antigas (só uma forma) eram fiado no total todo quando pagamento='Fiado'.
export const fiadoDaVenda = (v) => {
  if (!v) return 0;
  if (v.fiado != null) return Number(v.fiado) || 0;
  return v.pagamento === 'Fiado' ? (Number(v.total) || 0) : 0;
};
// Quanto AINDA falta receber de uma venda no fiado: o fiado menos o que já foi
// abatido em pagamentos parciais. Se está marcada como paga, é zero. Use este
// em todo lugar que soma "o que o cliente ainda deve".
export const abertoDaVenda = (v) => {
  if (!v || v.pago) return 0;
  const falta = fiadoDaVenda(v) - (Number(v.abatido) || 0);
  return falta > 0 ? falta : 0;
};
// Data de HOJE no fuso do Brasil (America/Sao_Paulo). Usar toISOString() aqui
// dava bug: à noite (a partir das 21h no horário de Brasília) o UTC já virava o
// dia seguinte e o sistema jogava tudo pra amanhã. en-CA formata YYYY-MM-DD.
export const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
// "Dia operacional" do bar: a MADRUGADA (antes das HORA_VIRADA) conta como o dia
// ANTERIOR — a noite que começou ontem. Assim uma venda fechada 1h da manhã cai
// no dia de ontem, batendo com a cabeça de quem trabalha virando a noite.
export const HORA_VIRADA = 6;
export const diaOperacional = (d = new Date()) => {
  const dt = (d instanceof Date) ? d : new Date(d);
  const horaBR = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(dt), 10) || 0;
  const base = horaBR < HORA_VIRADA ? new Date(dt.getTime() - 24 * 3600 * 1000) : dt;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(base);
};
export const ymOf = (iso) => (iso || '').slice(0, 7);
export const weekday = (iso) => { try { return DIAS[new Date(iso + 'T12:00:00').getDay()]; } catch { return ''; } };
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// Normaliza nomes (fornecedor, produto): tira espaços das pontas e junta
// espaços repetidos. Assim "Copal" e "Copal " deixam de ser coisas diferentes.
export const limparNome = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
export const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
export const addDays = (iso, d) => { const dt = new Date(iso + 'T12:00:00'); dt.setDate(dt.getDate() + Number(d || 0)); return dt.toISOString().slice(0, 10); };
export const daysBetween = (a, b) => { if (!a || !b) return 0; const d1 = new Date(a + 'T12:00:00'), d2 = new Date(b + 'T12:00:00'); return Math.max(0, Math.round((d2 - d1) / 86400000)); };
export const mesLabel = (ym) => `${MESES[parseInt(ym.slice(5)) - 1]}/${ym.slice(0, 4)}`;

// Gera as linhas de parcela: divide o total em N partes (ajustando os
// centavos na última) e espaça os vencimentos de 7 em 7 dias a partir de
// dataBase. Preserva datas/valores já digitados quando possível.
export function montarParcelas(n, total, dataBase, prev = []) {
  n = Math.max(1, Math.min(36, parseInt(n, 10) || 1));
  const base = dataBase || todayISO();
  const t = num(total);
  const valorBase = Math.floor((t / n) * 100) / 100;
  const linhas = [];
  for (let i = 0; i < n; i++) {
    const valorNum = i === n - 1 ? +(t - valorBase * (n - 1)).toFixed(2) : valorBase;
    linhas.push({
      vencimento: prev[i]?.vencimento || addDays(base, 7 * i),
      valor: t > 0 ? valorNum.toFixed(2).replace('.', ',') : (prev[i]?.valor || ''),
    });
  }
  return linhas;
}

// Agrupa as contas em aberto: itens que compartilham a mesma nota/boleto (mesmo
// fornecedor) viram um único grupo; itens sem nota ficam individuais. Cada grupo
// traz o total e o vencimento mais próximo. Usado tanto na aba Contas a Pagar
// quanto nos avisos da tela Hoje, pra os dois contarem "boletos" do mesmo jeito.
export function agruparContasAbertas(abertas) {
  const map = new Map();
  for (const d of abertas) {
    const notaTrim = (d.nota || '').trim();
    const chave = notaTrim ? `n:${notaTrim}|${(d.fornecedor || '').trim().toLowerCase()}` : `i:${d.id}`;
    let g = map.get(chave);
    if (!g) { g = { chave, nota: notaTrim, fornecedor: d.fornecedor, formaPagto: d.formaPagto, itens: [], total: 0, vencimento: '' }; map.set(chave, g); }
    g.itens.push(d);
    g.total += num(d.quantidade) * num(d.valorUnit);
    if (d.vencimento && (!g.vencimento || d.vencimento < g.vencimento)) g.vencimento = d.vencimento;
  }
  return [...map.values()].sort((a, b) => (a.vencimento || '9999').localeCompare(b.vencimento || '9999'));
}
