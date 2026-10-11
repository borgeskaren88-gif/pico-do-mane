'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { C, Card, Btn, Empty } from './ui';
import { minhaChavePush } from '../lib/pushClient';

// "HOJE AQUI FICAMOS GRITANDO."
//
// A cozinha termina o prato e grita o número da mesa. Quem ouve, ouve; quem
// está de costas, não. Isto troca o grito por um toque — e o aviso chega no
// celular de todo mundo, menos no de quem apertou.
//
// Três decisões que vieram do bar dela, não de um manual:
//
// 1. QUALQUER LOGIN APERTA. "Às vezes estou na cozinha também, ou o
//    atendimento também." Quem termina o prato é quem está com a mão nele, não
//    quem tem o crachá certo. Então o botão aparece igual pros três.
//
// 2. O AVISO TAMBÉM APARECE NA TELA, não só como notificação. No iPhone o push
//    só funciona com o app instalado na tela inicial E com permissão dada — e
//    se faltar qualquer um dos dois, nada chega. Um sistema que troca o grito
//    por um silêncio é pior que o grito. Então quem está com o app aberto vê a
//    tarja, tenha push ou não.
//
// 3. "PEGUEI" TIRA O AVISO DE TODO MUNDO. Aviso que fica depois de resolvido é
//    aviso que se aprende a ignorar — e aí o próximo, o de verdade, também
//    passa batido.

const POLL_MS = 20000;
const VISTOS = 'pdm_prontosVistos';

// Um bipe curto, feito na hora — sem arquivo pra baixar. No iPhone o som só sai
// depois que a pessoa tocou em alguma coisa na página (é regra do navegador,
// não defeito); por isso a tarja é a parte que SEMPRE funciona, e o som é o
// extra.
function bipar() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.connect(vol); vol.connect(ctx.destination);
    osc.frequency.value = 880;
    vol.gain.setValueAtTime(0.0001, ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.start(); osc.stop(ctx.currentTime + 0.5);
    setTimeout(() => { try { ctx.close(); } catch { /* ignora */ } }, 900);
  } catch { /* som é extra, nunca essencial */ }
}

const lerVistos = () => { try { return JSON.parse(localStorage.getItem(VISTOS) || '[]'); } catch { return []; } };
const salvarVistos = (ids) => { try { localStorage.setItem(VISTOS, JSON.stringify(ids.slice(0, 40))); } catch { /* ignora */ } };

// `botao` diz se o BOTÃO de avisar aparece nesta tela. As TARJAS aparecem
// sempre, em qualquer tela e qualquer papel — elas são o aviso, e esconder o
// aviso é desfazer a razão disto existir.
//
// "O avisar que o pedido está pronto fica aparecendo em todas as telas, meio
// chato." Estava certa: o botão não tem o que fazer na tela de Relatórios nem
// na de Marketing. Ele mora onde a ação acontece — na cozinha, nas comandas do
// atendimento, e no Hoje da dona. O aviso, não: o aviso tem que alcançar ela
// onde quer que ela esteja, senão volta o grito.
export default function PedidoPronto({ botao = true }) {
  const [mesas, setMesas] = useState([]);
  const [prontos, setProntos] = useState([]);
  const [abrindo, setAbrindo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const chavePush = useRef('');
  const primeiraVolta = useRef(true);

  useEffect(() => { minhaChavePush().then((c) => { chavePush.current = c; }); }, []);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/pronto', { cache: 'no-store' });
      const j = await r.json();
      if (!j.ok) return;
      setMesas(j.mesas || []);
      const lista = j.prontos || [];
      setProntos(lista);

      // Bipa só no que é NOVO pra este aparelho. Na primeira volta não bipa: o
      // app acabou de abrir, e tocar um alarme de algo que já estava ali é
      // assustar à toa.
      const vistos = lerVistos();
      const novos = lista.filter((x) => !vistos.includes(x.id));
      if (novos.length && !primeiraVolta.current) bipar();
      if (novos.length) salvarVistos([...novos.map((x) => x.id), ...vistos]);
      primeiraVolta.current = false;
    } catch { /* sem rede: a próxima volta pega */ }
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, POLL_MS);
    // Voltar pro app conta como volta: se o celular estava no bolso, o
    // temporizador pode ter parado.
    const aoVoltar = () => { if (!document.hidden) carregar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', aoVoltar); };
  }, [carregar]);

  const avisar = async (mesa) => {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/pronto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesa, excluir: chavePush.current }),
      });
      const j = await r.json();
      if (!j.ok) { setMsg(j.erro || 'Não consegui avisar.'); return; }
      setProntos(j.prontos || []);
      // Marca como visto neste aparelho: quem avisou não precisa ver a própria
      // tarja piscando.
      salvarVistos([...(j.prontos || []).map((x) => x.id), ...lerVistos()]);
      setAbrindo(false);
      // HONESTIDADE SOBRE O QUE SAIU. Se nenhum celular recebeu, ela precisa
      // saber AGORA — senão confia no aviso, para de gritar, e o prato esfria.
      setMsg(j.repetido ? 'Essa mesa já tinha sido avisada agora há pouco.'
        : j.enviados > 0 ? `Avisado — chegou em ${j.enviados} ${j.enviados === 1 ? 'celular' : 'celulares'}.`
        : 'Avisado na tela de quem está com o app aberto. Nenhum celular tem as notificações ligadas ainda.');
    } catch { setMsg('Sem conexão.'); }
    finally { setBusy(false); }
  };

  const peguei = async (id) => {
    setProntos((ps) => ps.filter((x) => x.id !== id)); // some na hora, sem esperar a rede
    try {
      await fetch('/api/pronto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'peguei', id }),
      });
    } catch { /* se falhar, a próxima volta traz de novo — melhor voltar que sumir errado */ }
  };

  const quando = (ts) => {
    const min = Math.floor((Date.now() - ts) / 60000);
    return min < 1 ? 'agora' : min === 1 ? 'faz 1 min' : `faz ${min} min`;
  };

  return (
    <>
      {/* AS TARJAS DO QUE ESTÁ PRONTO — a parte que sempre funciona. */}
      {prontos.map((x) => (
        <Card key={x.id} style={{ marginBottom: 10, padding: '12px 14px', borderColor: C.green, background: `color-mix(in srgb, ${C.green} 10%, ${C.panel})` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>🍽️</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>Mesa {x.mesa} pronta</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{quando(x.ts)}</div>
            </div>
            <Btn small kind="ok" onClick={() => peguei(x.id)}>Peguei</Btn>
          </div>
        </Card>
      ))}

      {/* O BOTÃO, só onde a ação acontece. */}
      {!botao ? null : !abrindo ? (
        <button onClick={() => { setAbrindo(true); setMsg(''); }}
          style={{ width: '100%', border: 'none', background: C.accent, color: '#06101F', borderRadius: 12, padding: '12px 16px', fontSize: 15, fontWeight: 800, cursor: 'pointer', marginBottom: 14 }}>
          🍽️ Avisar que o pedido está pronto
        </button>
      ) : (
        <Card style={{ marginBottom: 14, padding: 14, borderColor: C.accent }}>
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 2 }}>Qual mesa saiu?</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Todo mundo recebe o aviso, menos tu que está apertando.</div>
          {mesas.length === 0 ? <Empty>Nenhuma mesa aberta agora.</Empty> : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {mesas.map((m) => (
                <button key={m} onClick={() => avisar(m)} disabled={busy}
                  style={{ border: 'none', background: C.accent, color: '#06101F', borderRadius: 999, minWidth: 52, padding: '12px 16px', fontSize: 17, fontWeight: 900, cursor: 'pointer' }}>
                  {m}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setAbrindo(false)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '4px 0 0' }}>Cancelar</button>
        </Card>
      )}

      {msg && <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12, lineHeight: 1.45 }}>{msg}</div>}
    </>
  );
}
