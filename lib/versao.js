// A versão que ESTE código é.
//
// Fica carimbada no pacote na hora do build, então é a versão que o navegador
// está de fato rodando — diferente da /api/versao, que diz qual está
// PUBLICADA. Os dois eram tratados como a mesma coisa, e por isso um aparelho
// preso numa versão antiga mostrava na tela o número da versão nova: ela olhava
// o rodapé, via a versão certa, e concluía que estava atualizada.
//
// Vazio quando o build não tem git (rodando local): aí quem lê aqui volta pro
// comportamento antigo em vez de inventar que está desatualizado.
export const VERSAO_BUILD = String(process.env.NEXT_PUBLIC_PDM_VERSAO || '').slice(0, 7);

// A versão publicada, lida da resposta da /api/versao, na MESMA medida do
// carimbo acima. Comparar medidas diferentes (o commit de um lado, o id do
// deploy do outro) daria "sempre diferente", e o app se recarregaria em
// círculo sem nunca chegar em lugar nenhum.
export function publicadaDaResposta(j) {
  if (!j) return '';
  if (VERSAO_BUILD) return String(j.git || '').slice(0, 7);
  return String(j.v || '').slice(0, 7);
}
