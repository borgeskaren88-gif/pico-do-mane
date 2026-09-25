'use client';
import TelaQuebrou from '../components/TelaQuebrou';

// UM DEFEITO NUMA TELA NÃO PODE APAGAR O APP INTEIRO.
//
// Sem este arquivo, qualquer erro no desenho de qualquer tela subia até o topo e
// o Next trocava TUDO pela tela branca em inglês. Um número torto no painel de
// porções levava embora a comanda, o caixa e a agenda junto.
//
// Com ele, o erro para aqui: o cabeçalho e o fundo continuam de pé, ela lê o que
// quebrou e volta pro trabalho num toque.
export default function Error({ error, reset }) {
  return <TelaQuebrou error={error} reset={reset} />;
}
