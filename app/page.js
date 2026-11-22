import { cookies } from 'next/headers';
import { nomeCookie, papelDaSessao, negocioDaSessao } from '../lib/auth';
import { lerNegocio } from '../lib/negocios';
import { situacao } from '../lib/assinatura';
import AppPausado from '../components/AppPausado';
import LoginForm from '../components/LoginForm';
import Dashboard from '../components/Dashboard';
import Cozinha from '../components/Cozinha';
import Garcom from '../components/Garcom';
import Reservas from '../components/Reservas';
import Gerente from '../components/Gerente';
import SaiSozinho from '../components/SaiSozinho';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const valorCookie = cookies().get(nomeCookie())?.value;
  const papel = papelDaSessao(valorCookie);

  // O BAR COM O TESTE OU A MENSALIDADE VENCIDA (ou suspenso pela Karen): em vez
  // do app, uma tela dizendo o porquê. A dona vê o botão de pagar; a equipe vê
  // "fala com a dona". Nada é apagado — pagou, volta tudo como estava.
  // Se a lista não puder ser lida, abre o app normal: soluço de banco não
  // tranca bar pago.
  const negocio = papel ? negocioDaSessao(valorCookie) : null;
  if (negocio) {
    let s = null;
    try { const n = await lerNegocio(negocio); if (n) s = situacao(n); } catch { s = null; }
    if (s && !s.podeUsar) return <AppPausado papel={papel} estado={s.estado} />;
  }

  // No computador ninguém fica logado: fechou e voltou, cai na tela de entrar e
  // cada um entra com o login dele. O notebook do balcão passa de mão em mão.
  // No celular e no tablet continua logado, que são aparelhos de uma pessoa só.
  if (papel === 'dona') return <SaiSozinho><Dashboard /></SaiSozinho>;
  if (papel === 'cozinha') return <SaiSozinho><Cozinha /></SaiSozinho>;
  if (papel === 'garcom') return <SaiSozinho><Garcom /></SaiSozinho>;
  if (papel === 'reservas') return <SaiSozinho><Reservas /></SaiSozinho>;
  if (papel === 'gerente') return <SaiSozinho><Gerente /></SaiSozinho>;
  return <LoginForm />;
}
