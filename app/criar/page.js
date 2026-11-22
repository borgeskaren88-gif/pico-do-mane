import { notFound } from 'next/navigation';
import { consoleLigado } from '../../lib/auth';
import CriarBar from '../../components/CriarBar';

export const dynamic = 'force-dynamic';

// O cadastro sozinho só existe no app de muitos negócios (o que tem sala de
// máquinas). Numa instalação de um cliente só, este endereço não existe.
export const metadata = {
  title: 'Criar meu negócio · PicoOS',
  description: '14 dias grátis. Comanda, estoque, ficha técnica, caixa e ponto — gestão pro teu negócio, em português de gente.',
};

export default function Criar() {
  if (!consoleLigado()) notFound();
  return <CriarBar />;
}
