import { cookies } from 'next/headers';
import { nomeCookie, sessaoEhValida } from '../lib/auth';
import LoginForm from '../components/LoginForm';
import Dashboard from '../components/Dashboard';

export default function Home() {
  const valorCookie = cookies().get(nomeCookie())?.value;
  const autenticado = sessaoEhValida(valorCookie);

  if (!autenticado) return <LoginForm />;
  return <Dashboard />;
}
