import { cookies } from 'next/headers';
import { nomeCookie, papelDaSessao } from '../lib/auth';
import LoginForm from '../components/LoginForm';
import Dashboard from '../components/Dashboard';
import Cozinha from '../components/Cozinha';
import Garcom from '../components/Garcom';
import Reservas from '../components/Reservas';
import SaiSozinho from '../components/SaiSozinho';

export default function Home() {
  const valorCookie = cookies().get(nomeCookie())?.value;
  const papel = papelDaSessao(valorCookie);

  // No computador ninguém fica logado: fechou e voltou, cai na tela de entrar e
  // cada um entra com o login dele. O notebook do balcão passa de mão em mão.
  // No celular e no tablet continua logado, que são aparelhos de uma pessoa só.
  if (papel === 'dona') return <SaiSozinho><Dashboard /></SaiSozinho>;
  if (papel === 'cozinha') return <SaiSozinho><Cozinha /></SaiSozinho>;
  if (papel === 'garcom') return <SaiSozinho><Garcom /></SaiSozinho>;
  if (papel === 'reservas') return <SaiSozinho><Reservas /></SaiSozinho>;
  return <LoginForm />;
}
