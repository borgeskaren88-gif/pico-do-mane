import { cookies } from 'next/headers';
import { nomeCookie, papelDaSessao } from '../lib/auth';
import LoginForm from '../components/LoginForm';
import Dashboard from '../components/Dashboard';
import Cozinha from '../components/Cozinha';
import Garcom from '../components/Garcom';
import Reservas from '../components/Reservas';
import Gerente from '../components/Gerente';
import SaiSozinho from '../components/SaiSozinho';
import Radio from '../components/Radio';

export default function Home() {
  const valorCookie = cookies().get(nomeCookie())?.value;
  const papel = papelDaSessao(valorCookie);

  // No computador ninguém fica logado: fechou e voltou, cai na tela de entrar e
  // cada um entra com o login dele. O notebook do balcão passa de mão em mão.
  // No celular e no tablet continua logado, que são aparelhos de uma pessoa só.
  //
  // O <Radio /> (o botão redondo do canto) vai em todas as telas da equipe:
  // quem está na cozinha fala com quem está no salão, e a dona com todo mundo.
  if (papel === 'dona') return <SaiSozinho><Dashboard /><Radio /></SaiSozinho>;
  if (papel === 'cozinha') return <SaiSozinho><Cozinha /><Radio /></SaiSozinho>;
  if (papel === 'garcom') return <SaiSozinho><Garcom /><Radio /></SaiSozinho>;
  if (papel === 'reservas') return <SaiSozinho><Reservas /><Radio /></SaiSozinho>;
  if (papel === 'gerente') return <SaiSozinho><Gerente /><Radio /></SaiSozinho>;
  return <LoginForm />;
}
