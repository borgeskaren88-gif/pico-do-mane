import { bancoAdmin, bancoDo, nomeDeNegocioValido } from './banco';

// A LISTA DE QUEM USA O PicoOS.
//
// Uma linha só, fora de todos os negócios, com o código de cada um, o nome e se
// está ativo. É o que a tela de entrada consulta pra saber se "boteco" existe
// antes de perguntar senha, e é o que a Karen vai mexer quando vender ou
// suspender um sistema.
//
// Guarda o MÍNIMO: código, nome e ativo. Nada de senha (isso mora dentro do
// negócio), nada de telefone, nada de contrato. Quanto menos coisa aqui, menos
// coisa num lugar que é comum a todo mundo.
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

export async function criarNegocio({ codigo, nome }) {
  if (!nomeDeNegocioValido(codigo)) {
    throw new Error('O código do negócio só aceita letras minúsculas, números e hífen (de 2 a 31).');
  }
  if (await lerNegocio(codigo)) throw new Error(`Já existe um negócio com o código "${codigo}".`);
  await gravar((todos) => ({
    ...todos,
    [codigo]: { nome: limpo(nome, 60) || codigo, ativo: true, criadoEm: new Date().toISOString() },
  }));
  return lerNegocio(codigo);
}

export async function mudarNegocio(codigo, mudanca) {
  if (!(await lerNegocio(codigo))) throw new Error(`Não existe o negócio "${codigo}".`);
  const patch = {};
  if (mudanca && typeof mudanca.nome === 'string') patch.nome = limpo(mudanca.nome, 60);
  if (mudanca && typeof mudanca.ativo === 'boolean') patch.ativo = mudanca.ativo;
  await gravar((todos) => ({ ...todos, [codigo]: { ...todos[codigo], ...patch } }));
  return lerNegocio(codigo);
}

// O banco de um negócio, só depois de conferir que ele existe e está ativo.
// Quem chama isto não consegue, nem errando, abrir o banco de um código
// inventado — e código suspenso não abre mais.
export async function bancoDoNegocioAtivo(codigo) {
  if (!(await negocioAtivo(codigo))) return null;
  return bancoDo(codigo);
}
