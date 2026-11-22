// A ASSINATURA DE CADA BAR — a conta, sem banco e sem Asaas.
//
// "Algo que não dependa de mim: a pessoa viu, quis, instalou e assinou."
//
// Cada bar que se cadastra sozinho nasce com 14 dias de teste. Depois disso,
// quem libera o app é o pagamento: cada mês pago empurra a data "liberado até"
// um mês pra frente. Se o pagamento atrasa, o app continua funcionando por
// alguns dias (a carência), com um aviso; passou disso, a porta fecha — e os
// dados ficam todos guardados, esperando o pagamento.
//
// OS BARES QUE JÁ EXISTIAM (o Pico do Mané, os que a Karen criou na mão) não
// têm assinatura nenhuma registrada: eles são ISENTOS e nunca fecham por aqui.
// É de propósito: um erro nesta conta nunca pode trancar o bar da própria
// dona do sistema.

export const TESTE_DIAS = 14;
export const CARENCIA_DIAS = 5;
export const PRECO_PADRAO = 99.9;

const DIA = 24 * 60 * 60 * 1000;
const t = (iso) => { const n = Date.parse(iso || ''); return Number.isFinite(n) ? n : 0; };

// Um mês pra frente, no calendário (31/01 + 1 mês = 28 ou 29/02, não 03/03).
export function maisUmMes(ms) {
  const d = new Date(ms);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d.getTime();
}

export function assinaturaNova(agora = Date.now()) {
  return { plano: 'teste', testeAte: new Date(agora + TESTE_DIAS * DIA).toISOString(), pagoAte: null, pagamentos: [] };
}

// Em que pé está o bar. Devolve sempre a mesma forma:
//   estado: 'isento' | 'teste' | 'em_dia' | 'atrasado' | 'bloqueado' | 'suspenso'
//   liberadoAte: até quando o app abre sem aviso (ISO) — null pra isento
//   dias: quantos dias faltam (teste/em dia) ou quantos de carência sobram
//   podeUsar: o app abre?
export function situacao(negocio, agora = Date.now()) {
  if (!negocio) return { estado: 'bloqueado', liberadoAte: null, dias: 0, podeUsar: false };
  if (negocio.ativo === false) return { estado: 'suspenso', liberadoAte: null, dias: 0, podeUsar: false };
  const a = negocio.assinatura;
  if (!a || typeof a !== 'object' || a.plano === 'isento') return { estado: 'isento', liberadoAte: null, dias: 0, podeUsar: true };
  const ate = Math.max(t(a.testeAte), t(a.pagoAte));
  const liberadoAte = ate ? new Date(ate).toISOString() : null;
  const pagou = t(a.pagoAte) > 0;
  if (agora <= ate) {
    return { estado: pagou ? 'em_dia' : 'teste', liberadoAte, dias: Math.max(0, Math.ceil((ate - agora) / DIA)), podeUsar: true };
  }
  const fimCarencia = ate + CARENCIA_DIAS * DIA;
  if (agora <= fimCarencia) {
    return { estado: 'atrasado', liberadoAte, dias: Math.max(0, Math.ceil((fimCarencia - agora) / DIA)), podeUsar: true };
  }
  return { estado: 'bloqueado', liberadoAte, dias: 0, podeUsar: false };
}

// Chegou um pagamento confirmado. Cada pagamento (pelo id do Asaas) só conta
// UMA vez — o Asaas manda o mesmo aviso de novo quando a gente demora a
// responder, e pagar uma vez não pode liberar dois meses.
//
// O mês novo começa do que vier por último: o fim do teste, o fim do mês já
// pago, ou hoje (pra quem voltou depois de bloqueado). Assim quem paga no
// terceiro dia do teste não perde os outros onze.
export function creditarPagamento(assinatura, pagamentoId, agora = Date.now()) {
  const a = { ...(assinatura || assinaturaNova(agora)) };
  const feitos = Array.isArray(a.pagamentos) ? a.pagamentos : [];
  const id = String(pagamentoId || '');
  if (!id) return { assinatura: a, creditou: false };
  if (feitos.includes(id)) return { assinatura: a, creditou: false };
  const base = Math.max(t(a.testeAte), t(a.pagoAte), agora);
  a.pagoAte = new Date(maisUmMes(base)).toISOString();
  if (a.plano !== 'isento') a.plano = 'pago';
  a.pagamentos = [...feitos, id].slice(-36);
  a.ultimoPagamento = new Date(agora).toISOString();
  return { assinatura: a, creditou: true };
}

// O código que a pessoa digita pra entrar, tirado do nome do bar:
// "Boteco da Ana" -> "boteco-da-ana". Se já existir, ganha um número.
export function codigoDoNome(nome) {
  const base = String(nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 26).replace(/-+$/g, '');
  return base.length >= 2 ? base : `negocio-${base || 'novo'}`.slice(0, 26);
}

export function codigoLivre(nome, existentes) {
  const ocupados = new Set(existentes || []);
  const base = codigoDoNome(nome);
  if (!ocupados.has(base)) return base;
  for (let i = 2; i < 1000; i += 1) {
    const c = `${base}-${i}`;
    if (!ocupados.has(c)) return c;
  }
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}

// Só os dígitos de um CPF ou CNPJ, e só se o tamanho e o dígito verificador
// baterem. O Asaas recusa documento inválido; melhor avisar aqui, em
// português, do que mostrar a mensagem dele.
export function documentoValido(doc) {
  const d = String(doc || '').replace(/\D/g, '');
  if (d.length === 11) {
    if (/^(\d)\1{10}$/.test(d)) return null;
    const dv = (n) => { let s = 0; for (let i = 0; i < n; i += 1) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === Number(d[9]) && dv(10) === Number(d[10]) ? d : null;
  }
  if (d.length === 14) {
    if (/^(\d)\1{13}$/.test(d)) return null;
    const dv = (n) => {
      const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const s = pesos.reduce((acc, p, i) => acc + Number(d[i]) * p, 0);
      const r = s % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return dv(12) === Number(d[12]) && dv(13) === Number(d[13]) ? d : null;
  }
  return null;
}

export const NOME_ESTADO = {
  isento: 'Sem cobrança',
  teste: 'Teste grátis',
  em_dia: 'Em dia',
  atrasado: 'Pagamento atrasado',
  bloqueado: 'Bloqueado por falta de pagamento',
  suspenso: 'Suspenso',
};
