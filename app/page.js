import { cookies } from 'next/headers';
import { nomeCookie, papelDaSessao } from '../lib/auth';
import LoginForm from '../components/LoginForm';
import Dashboard from '../components/Dashboard';
import Cozinha from '../components/Cozinha';

export default function Home() {
  const valorCookie = cookies().get(nomeCookie())?.value;
  const papel = papelDaSessao(valorCookie);

  if (papel === 'dona') return <Dashboard />;
  if (papel === 'cozinha') return <Cozinha />;
  return <LoginForm />;
}
