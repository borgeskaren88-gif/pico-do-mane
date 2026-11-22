import Apresentacao from '../../components/Apresentacao';
import { lerConfigVenda } from '../../lib/negocios';

export const dynamic = 'force-dynamic';

// A PÁGINA QUE O DONO DO OUTRO BAR VÊ ANTES DE DIZER SIM.
//
// Hoje a raiz do PicoOS é a tela de senha: quem chega sem conta vê um campo de
// login e vai embora. Pra vender, o primeiro que ele vê tem que ser o que o
// sistema faz.
//
// Fica em rota separada de propósito, e não na raiz. Mudar a raiz agora poria
// uma página de venda na frente do balcão dela TODO dia — o notebook do balcão
// não fica logado, então a equipe cairia aqui a cada turno. Quando o domínio
// estiver no ar a gente decide onde cada um mora; trocar isso antes é mexer na
// operação de um bar que está funcionando pra resolver um problema que ainda
// não existe.
export const metadata = {
  title: 'PicoOS — gestão pro teu negócio, em português de gente',
  description: 'O sistema que avisa quando o número está errado, em vez de mostrar errado calado. Estoque, ficha técnica, CMV, preço e comanda.',
};

export default async function Conheca() {
  // O preço vem da sala de máquinas: mudou lá, muda aqui.
  const cfg = await lerConfigVenda().catch(() => ({ preco: 99.9 }));
  return <Apresentacao preco={cfg.preco} />;
}
