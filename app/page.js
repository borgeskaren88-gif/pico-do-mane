import { cookies } from 'next/headers';
import { nomeCookie, papelDaSessao } from '../lib/auth';
import LoginForm from '../components/LoginForm';
import Dashboard from '../components/Dashboard';
import Cozinha from '../components/Cozinha';
import Garcom from '../components/Garcom';
import TravaDesktop from '../components/TravaDesktop';

export default function Home() {
  const valorCookie = cookies().get(nomeCookie())?.value;
  const papel = papelDaSessao(valorCookie);

  // No computador, a trava pede a senha ao reabrir o app (no celular não trava).
  if (papel === 'dona') return <TravaDesktop><Dashboard /></TravaDesktop>;
  if (papel === 'cozinha') return <TravaDesktop><Cozinha /></TravaDesktop>;
  if (papel === 'garcom') return <TravaDesktop><Garcom /></TravaDesktop>;
  return <LoginForm />;
}
