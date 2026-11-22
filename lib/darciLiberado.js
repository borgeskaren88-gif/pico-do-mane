// O DARCI É SÓ DO PICO DO MANÉ.
//
// "O Darci vai ter somente no meu bar."
//
// Cada pergunta e cada relatório do Darci é uma chamada de IA paga pela chave
// da Karen. Um bar que se cadastrou sozinho usaria a chave dela sem ela saber.
// Então o Darci (a tela, o balão, as perguntas, a voz e o relatório) só existe
// pro bar da casa.
//
// Quem é "o bar da casa": DARCI_NEGOCIOS (códigos separados por vírgula), se
// alguém configurar; senão o NEGOCIO_UNICO e o próprio "pico-do-mane".
// Instalação de um cliente só (crachá sem código de negócio) continua igual.
export function darciLiberado(negocio) {
  const n = String(negocio || '').trim().toLowerCase();
  if (!n) return true;
  const lista = String(process.env.DARCI_NEGOCIOS || '').trim()
    ? String(process.env.DARCI_NEGOCIOS).split(',')
    : [process.env.NEGOCIO_UNICO || '', 'pico-do-mane'];
  return lista.map((x) => String(x).trim().toLowerCase()).filter(Boolean).includes(n);
}
