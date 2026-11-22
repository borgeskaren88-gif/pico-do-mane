import { notFound } from 'next/navigation';
import { consoleLigado } from '../../lib/auth';
import FlyerPagina from '../../components/FlyerPagina';

export const dynamic = 'force-dynamic';

// A PÁGINA DO FLYER — o link que se manda pra qualquer pessoa.
//
// Aberta pra internet (sem login): é material de divulgação. Mostra o flyer,
// deixa baixar a imagem e o PDF e compartilhar. E, por causa das tags abaixo,
// quando o link é colado no WhatsApp ou no Instagram, a prévia já aparece com o
// flyer, em vez de um quadradinho cinza.
//
// Só existe no app de muitos negócios (o mesmo que tem o /criar): numa
// instalação de um cliente só, este endereço não existe.
const SITE = 'https://pico-do-mane.vercel.app';
export const metadata = {
  metadataBase: new URL(SITE),
  title: 'PicoOS — 14 dias grátis',
  description: 'Teu bar no controle, direto do celular. Comanda, estoque, ficha técnica, caixa e ponto da equipe. Cria o teu bar e testa 14 dias grátis, sem cartão.',
  openGraph: {
    title: 'PicoOS — teu bar no controle, direto do celular',
    description: 'Testa 14 dias grátis, sem cartão. Aponta a câmera pro QR code ou toca no link.',
    url: '/flyer',
    siteName: 'PicoOS',
    type: 'website',
    images: [{ url: '/divulgar/picoos-flyer.png', width: 1588, height: 2246, alt: 'Flyer do PicoOS' }],
  },
  twitter: { card: 'summary_large_image', images: ['/divulgar/picoos-flyer.png'] },
};

export default function Flyer() {
  if (!consoleLigado()) notFound();
  return <FlyerPagina />;
}
