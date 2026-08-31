import { cookies } from 'next/headers';
import { nomeCookie, usuarioDaSessao } from '../lib/auth';
import LoginForm from '../components/LoginForm';
import Painel from '../components/Painel';

export const dynamic = 'force-dynamic';

export default function Home() {
  const valorCookie = cookies().get(nomeCookie())?.value;
  const usuario = usuarioDaSessao(valorCookie);

  if (usuario) return <Painel usuario={usuario} />;
  return <LoginForm />;
}
