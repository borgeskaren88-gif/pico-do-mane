import crypto from 'crypto';
import { hashSenha } from './senha';
import { subirGeracao } from './acessos';

// OS LOGINS DA EQUIPE DOS BARES NOVOS — até 5, cada um com nome e senha.
//
// "Quero que todos tenham opção de criar até 5 logins, com os nomes e senhas
// editáveis. Não precisa ir com título de gerente e tal."
//
// No Pico do Mané o acesso é por CARGO (Cozinha, Atendimento, Gerente, Extra),
// e lá fica assim. Nos bares que se cadastram sozinhos, a dona cria PESSOAS:
// "Bia", "João"... Cada login tem um nome, uma senha e um TIPO, que diz qual
// tela a pessoa vê — o tipo é só por dentro; na tela de entrar aparece o nome.
//
// Senha guardada só embaralhada, como todas as outras. E o tipo reaproveita o
// crachá do cargo correspondente: trocar a senha ou apagar um login derruba os
// aparelhos daquele tipo (quem for do mesmo tipo entra de novo com a própria
// senha) — é o jeito de garantir que a pessoa que saiu cai NA HORA.

export const CHAVE_LOGINS = 'loginsEquipe';
export const MAX_LOGINS = 5;
export const TIPOS = {
  garcom: 'Atendimento',
  cozinha: 'Cozinha',
  gerente: 'Gerência',
};

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const limparNome = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 30);

function igual(a, b) {
  try {
    const x = Buffer.from(String(a), 'hex');
    const y = Buffer.from(String(b), 'hex');
    return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
  } catch { return false; }
}

export async function lerLogins(sb) {
  const { data } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE_LOGINS).maybeSingle();
  const l = data && data.valor && Array.isArray(data.valor.lista) ? data.valor.lista : [];
  return l.filter((x) => x && x.id && x.nome && TIPOS[x.tipo] && x.hash);
}

async function gravar(sb, lista) {
  const { error } = await sb.from('pdm_dados').upsert(
    { chave: CHAVE_LOGINS, valor: { lista, atualizadoEm: new Date().toISOString() }, atualizado_em: new Date().toISOString() },
    { onConflict: 'chave' },
  );
  if (error) throw error;
}

// O que a tela pode ver: nunca o embaralhado da senha.
export const publico = (l) => ({ id: l.id, nome: l.nome, tipo: l.tipo, tipoNome: TIPOS[l.tipo], criadoEm: l.criadoEm || null });

function validar({ nome, tipo, senha }, lista, idAtual = null, { exigeSenha = true } = {}) {
  const n = limparNome(nome);
  if (n.length < 2) return 'Escreve o nome da pessoa (pelo menos 2 letras).';
  if (/^(dona|dono)$/i.test(norm(n))) return 'Esse nome é reservado pra dona. Usa o nome da pessoa.';
  if (lista.some((l) => l.id !== idAtual && norm(l.nome) === norm(n))) return `Já existe um login chamado "${n}". Usa outro nome (ex: "${n} cozinha").`;
  if (!TIPOS[tipo]) return 'Escolhe o que a pessoa faz: Atendimento, Cozinha ou Gerência.';
  if (exigeSenha || senha) {
    if (String(senha || '').trim().length < 4) return 'A senha precisa de pelo menos 4 letras ou números.';
  }
  return null;
}

export async function criarLogin(sb, { nome, tipo, senha }) {
  const lista = await lerLogins(sb);
  if (lista.length >= MAX_LOGINS) throw new Error(`O limite é de ${MAX_LOGINS} logins. Apaga um pra criar outro.`);
  const erro = validar({ nome, tipo, senha }, lista);
  if (erro) throw new Error(erro);
  const novo = { id: crypto.randomBytes(6).toString('hex'), nome: limparNome(nome), tipo, hash: hashSenha(String(senha).trim()), criadoEm: new Date().toISOString() };
  await gravar(sb, [...lista, novo]);
  return publico(novo);
}

// Editar: nome, tipo e/ou senha. Trocar a senha ou o tipo derruba os aparelhos
// do tipo antigo — senão quem já estava logado continuaria dentro.
export async function editarLogin(sb, id, { nome, tipo, senha }) {
  const lista = await lerLogins(sb);
  const atual = lista.find((l) => l.id === id);
  if (!atual) throw new Error('Login não encontrado.');
  const prox = { nome: nome != null ? nome : atual.nome, tipo: tipo || atual.tipo, senha: senha ? String(senha).trim() : '' };
  const erro = validar(prox, lista, id, { exigeSenha: false });
  if (erro) throw new Error(erro);
  const mudou = { ...atual, nome: limparNome(prox.nome), tipo: prox.tipo, ...(prox.senha ? { hash: hashSenha(prox.senha) } : {}), atualizadoEm: new Date().toISOString() };
  await gravar(sb, lista.map((l) => (l.id === id ? mudou : l)));
  if (prox.senha || prox.tipo !== atual.tipo) await subirGeracao(sb, atual.tipo);
  return publico(mudou);
}

export async function apagarLogin(sb, id) {
  const lista = await lerLogins(sb);
  const atual = lista.find((l) => l.id === id);
  if (!atual) throw new Error('Login não encontrado.');
  await gravar(sb, lista.filter((l) => l.id !== id));
  await subirGeracao(sb, atual.tipo);
}

// A tela de entrar: nome + senha. Nome sem acento e sem diferença de
// maiúscula ("bia" entra como "Bia").
export async function conferirLogin(sb, nome, senha) {
  if (!nome || !senha) return null;
  const lista = await lerLogins(sb);
  const l = lista.find((x) => norm(x.nome) === norm(nome));
  if (!l) return null;
  return igual(hashSenha(String(senha).trim()), l.hash) ? l : null;
}
