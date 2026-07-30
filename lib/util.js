export const FONTES_RECEITA = ['Caixa', 'Caixa Ao Vivo', 'Promoções', 'Recebimento Atrasado'];
export const CUSTO_VARIAVEL = [
  'Fornecedores de insumo', 'Zé Delivre + Supermercado', 'Compras Estratégicas (Supermercados)',
  'Reposição Emergencial', 'Supermercado', 'Cachê Musical', 'Extra', 'A classificar',
];
export const DESPESA_OPERACIONAL = [
  'Salários', 'Aluguel', 'Taxas (cartões)', 'Internet/Wifi', 'Assinaturas',
  'Manutenções', 'Limpeza', 'Impostos (DAS MEI)', 'Taxa de lixo', 'Sistemas',
];
export const CATEGORIAS_DESPESA = [...CUSTO_VARIAVEL, ...DESPESA_OPERACIONAL];
export const CATEGORIAS_PRODUTO = ['Bebidas', 'Cozinha', 'Limpeza', 'Descartáveis/Apoio', 'Tabacaria', 'Sem cotação', 'Outros'];
export const DIAS = ['Domingo', 'Segunda-Feira', 'Terça-Feira', 'Quarta-Feira', 'Quinta-Feira', 'Sexta-Feira', 'Sábado'];
export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const num = (v) => { const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
export const todayISO = () => new Date().toISOString().slice(0, 10);
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
