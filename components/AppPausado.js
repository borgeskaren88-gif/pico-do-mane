'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { C, Card, Btn, LogoMark, pageBg } from './ui';
import Assinatura from './Assinatura';
import { sairDeVez } from '../lib/pushClient';

// A TELA DO APP PAUSADO — teste ou mensalidade vencida, ou bar suspenso.
//
// A dona vê o porquê e o botão de pagar, ali mesmo. A equipe não tem o que
// fazer além de avisar a dona, então vê só isso, sem preço nem data.
// Nos dois casos: NADA FOI APAGADO.
export default function AppPausado({ papel, estado }) {
  const router = useRouter();
  const sair = async () => { await sairDeVez(); router.refresh(); };
  const suspenso = estado === 'suspenso';
  return (
    <div data-app-pausado={estado} style={{ minHeight: '100vh', background: pageBg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif', padding: '32px 16px 60px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <LogoMark size={34} radius={10} />
          <div style={{ fontSize: 17, fontWeight: 900 }}>PicoOS</div>
        </div>
        {papel === 'dona' && !suspenso ? (
          <Assinatura />
        ) : (
          <Card>
            <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 8 }}>O app está pausado</div>
            <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
              {suspenso
                ? 'O acesso deste bar foi pausado. Nada foi apagado.'
                : 'O teste ou a mensalidade do PicoOS venceu. Avisa o dono ou a dona do bar: assim que pagar, tudo volta como estava.'}
            </div>
          </Card>
        )}
        <div style={{ marginTop: 18 }}><Btn kind="ghost" onClick={sair}>Sair</Btn></div>
      </div>
    </div>
  );
}
