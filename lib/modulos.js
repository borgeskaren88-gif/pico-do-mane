// O QUE ESTE NEGÓCIO USA.
//
// Nem todo negócio usa tudo. O Darci (o sócio de IA) é o primeiro caso: ele
// custa dinheiro por pergunta, precisa de uma chave de IA no servidor, e num
// app de teste pode nem fazer sentido.
//
// Aqui é o lugar de ligar e desligar pedaços do PicoOS por negócio. Quando
// chegar o cliente que não tem mesa nem comanda, é aqui que isso entra também
// — e não num monte de `if` espalhado pelas telas.
//
// Tudo começa LIGADO. Quem já usa não pode perder nada porque um campo novo
// apareceu no banco.

export const PADRAO = { darci: true };

export function lerModulos(blob) {
  const m = (blob && typeof blob.modulos === 'object' && blob.modulos) || {};
  return { darci: m.darci !== false };
}

// O Darci só aparece quando as DUAS coisas são verdade: o servidor tem chave
// de IA (sem ela ele não responde nada) e o negócio não o desligou.
//
// A primeira condição sozinha já resolve o caso que importa: um app instalado
// pra outra pessoa, sem chave nenhuma, simplesmente não mostra o Darci — em
// vez de mostrar um sócio que não fala.
export const darciDisponivel = (modulos, recursos) => (modulos ? modulos.darci !== false : true)
  && (recursos ? recursos.darci !== false : true);
