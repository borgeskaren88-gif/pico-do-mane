import { bancoAdmin, bancoDo, nomeDeNegocioValido } from './banco';

// A LISTA DE QUEM USA O PicoOS.
//
// Uma linha só, fora de todos os negócios, com o código de cada um, o nome e se
// está ativo. É o que a tela de entrada consulta pra saber se "boteco" existe
// antes de perguntar senha, e é o que a Karen vai mexer quando vender ou
// suspender um sistema.
//
// Guarda o MÍNIMO: código, nome e ativo. Nada de senha (isso mora dentro do
// negócio). Quanto menos coisa aqui, menos coisa num lugar que é comum a todo
// mundo.
//
// Desde o cadastro sozinho ("a pessoa viu, quis, instalou e assinou"), entram
// mais duas coisas, e só elas:
//   - assinatura: as datas (teste até, pago até) e os números do Asaas. Fica
//     AQUI, e não dentro do negócio, porque quem confere se a porta abre é o
//     porteiro, antes de qualquer tela — e ele não abre o banco do bar pra isso;
//   - contato: nome e WhatsApp de quem se cadastrou. Sem isso a Karen não tem
//     como falar com um cliente que nunca viu.
const CHAVE = 'negocios';

const limpo = (s, max) => String(s == null ? '' : s).slice(0, max).trim();

export async function lerNegocios() {
  const { data } = await bancoAdmin().from('pdm_dados').select('valor').eq('chave', CHAVE).maybeSingle();
  const v = data?.valor;
  return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
}

export async function lerNegocio(codigo) {
  if (!nomeDeNegocioValido(codigo)) return null;
  const todos = await lerNegocios();
  const n = todos[codigo];
  return (n && typeof n === 'object') ? { codigo, ...n } : null;
}

// Pode entrar? Só se existir E estiver ativo. "Suspenso" é o que a Karen usa
// quando alguém para de pagar: os dados ficam intactos, a porta é que fecha.
export async function negocioAtivo(codigo) {
  const n = await lerNegocio(codigo);
  return !!(n && n.ativo !== false);
}

// Grava a lista relendo na hora, pra duas mexidas ao mesmo tempo não se
// apagarem — é o mesmo cuidado que o painel já tem.
async function gravar(mudar) {
  const atual = await lerNegocios();
  const novo = mudar({ ...atual });
  await bancoAdmin().from('pdm_dados').upsert(
    { chave: CHAVE, valor: novo, atualizado_em: new Date().toISOString() },
    { onConflict: 'chave' },
  );
  return novo;
}

export async function criarNegocio({ codigo, nome, assinatura = null, contato = null }) {
  if (!nomeDeNegocioValido(codigo)) {
    throw new Error('O código do negócio só aceita letras minúsculas, números e hífen (de 2 a 31).');
  }
  if (await lerNegocio(codigo)) throw new Error(`Já existe um negócio com o código "${codigo}".`);
  await gravar((todos) => ({
    ...todos,
    [codigo]: {
      nome: limpo(nome, 60) || codigo, ativo: true, criadoEm: new Date().toISOString(),
      ...(assinatura ? { assinatura } : {}),
      ...(contato ? { contato: contatoLimpo(contato) } : {}),
    },
  }));
  return lerNegocio(codigo);
}

export async function mudarNegocio(codigo, mudanca) {
  if (!(await lerNegocio(codigo))) throw new Error(`Não existe o negócio "${codigo}".`);
  const patch = {};
  if (mudanca && typeof mudanca.nome === 'string') patch.nome = limpo(mudanca.nome, 60);
  if (mudanca && typeof mudanca.ativo === 'boolean') patch.ativo = mudanca.ativo;
  await gravar((todos) => {
    const atual = todos[codigo] || {};
    const novo = { ...atual, ...patch };
    // A assinatura é uma FUNÇÃO da que está gravada agora (relida na hora):
    // dois avisos do Asaas chegando juntos não apagam o crédito um do outro.
    if (mudanca && typeof mudanca.assinatura === 'function') {
      const a = mudanca.assinatura(atual.assinatura || null);
      if (a === undefined) { /* não mexe */ } else if (a === null) delete novo.assinatura; else novo.assinatura = a;
    }
    return { ...todos, [codigo]: novo };
  });
  return lerNegocio(codigo);
}

// O banco de um negócio, só depois de conferir que ele existe e está ativo.
// Quem chama isto não consegue, nem errando, abrir o banco de um código
// inventado — e código suspenso não abre mais.
export async function bancoDoNegocioAtivo(codigo) {
  if (!(await negocioAtivo(codigo))) return null;
  return bancoDo(codigo);
}

function contatoLimpo(c) {
  return {
    nome: limpo(c && c.nome, 60),
    whatsapp: String((c && c.whatsapp) || '').replace(/\D/g, '').slice(0, 15),
    email: limpo(c && c.email, 90).toLowerCase(),
    cidade: limpo(c && c.cidade, 60),
  };
}

// De quem é esta assinatura do Asaas? É assim que o aviso de pagamento acha o
// bar certo, sem confiar em nada que venha escrito no próprio aviso.
export async function negocioDaAssinatura(idAssinatura) {
  const id = String(idAssinatura || '');
  if (!id) return null;
  const todos = await lerNegocios();
  const codigo = Object.keys(todos).find((c) => todos[c] && todos[c].assinatura && todos[c].assinatura.asaasAssinatura === id);
  return codigo ? { codigo, ...todos[codigo] } : null;
}

// AS REGRAS DA VENDA, que a Karen muda na sala de máquinas: o preço do mês e
// se o cadastro está aberto. Mora fora dos negócios, como a lista.
const CHAVE_CONFIG = 'picoosConfig';
export async function lerConfigVenda() {
  const { data } = await bancoAdmin().from('pdm_dados').select('valor').eq('chave', CHAVE_CONFIG).maybeSingle();
  const v = (data && data.valor && typeof data.valor === 'object') ? data.valor : {};
  const preco = Math.round(Number(v.preco) * 100) / 100;
  return { preco: preco >= 5 && preco <= 5000 ? preco : 99.9, cadastroAberto: v.cadastroAberto !== false };
}
export async function gravarConfigVenda(mudanca) {
  const atual = await lerConfigVenda();
  const novo = { ...atual };
  if (mudanca && mudanca.preco != null) {
    const p = Math.round(Number(String(mudanca.preco).replace(',', '.')) * 100) / 100;
    if (!(p >= 5 && p <= 5000)) throw new Error('Preço inválido (entre R$ 5 e R$ 5.000).');
    novo.preco = p;
  }
  if (mudanca && typeof mudanca.cadastroAberto === 'boolean') novo.cadastroAberto = mudanca.cadastroAberto;
  await bancoAdmin().from('pdm_dados').upsert({ chave: CHAVE_CONFIG, valor: novo, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
  return novo;
}
