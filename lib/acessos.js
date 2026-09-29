// CORTAR O ACESSO DE QUEM SAIU.
//
// "Preciso deixar o login da cozinha existente, porém demiti a pessoa que
// estava na cozinha. Como faço pra bloquear o acesso dela?"
//
// A resposta honesta, antes disto, era: não dava.
//
// O crachá de cada acesso (o cookie) era um número fixo, calculado uma vez a
// partir do SESSION_SECRET, sem validade. Trocar a senha da cozinha não mexia
// nele: quem já estava logado continuava logado PRA SEMPRE. O celular da pessoa
// demitida entrava no dia seguinte, e no mês seguinte, do mesmo jeito.
//
// O único jeito era trocar o SESSION_SECRET na Vercel — que derruba TODO mundo
// junto (ela, o garçom, a Mari) e ainda quebra o link do calendário e o do
// widget, que saem do mesmo segredo.
//
// Aqui entra a GERAÇÃO: um número por acesso, guardado no banco, que vai
// dentro do crachá. Quando ela toca em "desconectar todos os aparelhos", o
// número sobe — e todo crachá antigo daquele acesso para de valer na hora.
// Só daquele acesso: os outros nem percebem, e os links do calendário e do
// widget continuam iguais, porque não dependem disso.

export const CHAVE_GERACOES = 'acessosGeracoes';

// Os acessos que podem ser cortados. A dona não entra: cortar o acesso dela
// mesma pelo app seria uma tranca cuja chave fica do lado de dentro.
export const ACESSOS = [
  { papel: 'cozinha', nome: 'Cozinha' },
  { papel: 'garcom', nome: 'Atendimento (garçom)' },
  { papel: 'reservas', nome: 'Reservas' },
];

const limpar = (v) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? n : 1;
};

// A geração de cada acesso. Sem linha no banco, todo mundo está na 1 — que é
// exatamente o que os crachás já emitidos carregam, então ninguém é deslogado
// só porque esta mudança subiu.
export async function lerGeracoes(sb) {
  const out = { cozinha: 1, garcom: 1, reservas: 1 };
  try {
    const { data } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE_GERACOES).maybeSingle();
    const v = data?.valor || {};
    for (const k of Object.keys(out)) out[k] = limpar(v[k]);
  } catch { /* banco fora: fica no padrão */ }
  return out;
}

// Sobe a geração de um acesso: todo crachá antigo dele morre agora.
export async function subirGeracao(sb, papel) {
  if (!ACESSOS.some((a) => a.papel === papel)) throw new Error('Esse acesso não pode ser cortado por aqui.');
  const atuais = await lerGeracoes(sb);
  const novas = { ...atuais, [papel]: limpar(atuais[papel]) + 1 };
  const { error } = await sb.from('pdm_dados').upsert(
    { chave: CHAVE_GERACOES, valor: { ...novas, atualizadoEm: new Date().toISOString() }, atualizado_em: new Date().toISOString() },
    { onConflict: 'chave' },
  );
  if (error) throw error;
  return novas[papel];
}
