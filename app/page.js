import { cookies } from 'next/headers';
import { nomeCookie, usuarioDaSessao } from '../lib/auth';
import LoginForm from '../components/LoginForm';
import Financas from '../components/Financas';

export const dynamic = 'force-dynamic';

export default function Home() {
  const valorCookie = cookies().get(nomeCookie())?.value;
  const usuario = usuarioDaSessao(valorCookie);

  if (usuario) return <Financas usuario={usuario} />;
  return <LoginForm />;
}
