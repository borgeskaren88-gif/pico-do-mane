import { notFound } from 'next/navigation';
import { consoleLigado } from '../../lib/auth';
import Console from '../../components/Console';

export const dynamic = 'force-dynamic';

// Sem ADMIN_PASSWORD no servidor, este endereço simplesmente NÃO EXISTE —
// página de erro do Next, igual a qualquer endereço inventado. Numa instalação
// de cliente, procurar por ele não devolve nem a informação de que ele poderia
// existir em outro lugar.
export default function Admin() {
  if (!consoleLigado()) notFound();
  return <Console />;
}
