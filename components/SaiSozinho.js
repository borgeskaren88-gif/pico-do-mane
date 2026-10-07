'use client';
import React, { useEffect, useRef, useState } from 'react';
import { C, Card, Btn, pageBg } from './ui';

// SAIR SOZINHO NO COMPUTADOR.
//
// "No meu iPad e no celular eu não vejo, porém aqui no notebook do bar não sou
// somente eu que acesso, o atendimento também acessa."
// "Melhor: ninguém fica logado, ele sai sozinho e cada um entra com seu login."
//
// O notebook do balcão é o único aparelho do bar que não é de uma pessoa só. O
// celular é dela, o iPad é dela — ali ficar logado é comodidade. O notebook
// passa de mão em mão, e ali ficar logado é a tela das finanças aberta em cima
// do balcão a noite inteira.
//
// Antes existia uma TRAVA: ao reabrir, pedia a senha e devolvia a MESMA sessão.
// Duas coisas erradas nisso. A primeira é que destravar não é entrar — quem
// chegava continuava dentro do papel de quem saiu, e o atendimento acabava
// mexendo numa tela de dona. A segunda era pior e estava escondida: a trava
// conferia a senha contra a variável de ambiente (ou o "1234" de fábrica), não
// contra a senha que a dona trocou dentro do app. Ou seja, ela trocou a senha
// da equipe, acreditou que tinha fechado a porta, e qualquer um continuava
// destravando com 1234. Porta que parece fechada é pior que porta aberta.
//
// Agora não tem trava: tem SAÍDA. Fechou e voltou? Caiu na tela de entrar, e
// cada um entra com o login dele. Não existe mais "a sessão de quem estava
// antes" pra herdar — e some junto o buraco, porque entrar sempre foi o
// caminho que confere a senha de verdade.
//
// No celular e no tablet nada disso vale: lá continua logado, como sempre.

const CHAVE_ABA = 'pdm_sessaoAtiva';     // esta ABA já estava em uso (morre ao fechar)
const CHAVE_VIVA = 'pdm_abaViva';        // batida de coração, compartilhada entre abas
const CHAVE_TOQUE = 'pdm_ultimoToque';   // último sinal de vida, compartilhado

const BATIDA_MS = 4000;        // de quanto em quanto tempo cada aba diz "estou aqui"
const IRMA_VIVA_MS = 12000;    // batida mais nova que isso = tem outra aba aberta
const OCIOSO_MS = 30 * 60 * 1000;  // meia hora parado no computador e sai
const AVISO_MS = 60 * 1000;        // avisa um minuto antes — sumiço sem aviso é defeito aos olhos de quem usa

function ehCelular() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

const leNum = (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const poe = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* ignora */ } };

export default function SaiSozinho({ children }) {
  const [estado, setEstado] = useState('checando'); // checando | dentro | saindo
  const [faltam, setFaltam] = useState(0);          // segundos até sair, quando avisando
  const avisando = faltam > 0;
  const jaSaiu = useRef(false);

  const sair = async () => {
    if (jaSaiu.current) return;
    jaSaiu.current = true;
    setEstado('saindo');
    try { sessionStorage.removeItem(CHAVE_ABA); } catch { /* ignora */ }
    try { await fetch('/api/logout', { method: 'POST' }); } catch { /* sem rede: o reload resolve */ }
    window.location.reload();
  };

  // 1) Chegando: esta aba estava em uso, tem irmã viva, ou é sessão herdada?
  useEffect(() => {
    if (ehCelular()) { setEstado('dentro'); return; }

    let daAba = false;
    try { daAba = sessionStorage.getItem(CHAVE_ABA) === '1'; } catch { daAba = true; }

    // Aba nova com outra aba viva do lado é a MESMA pessoa abrindo uma segunda
    // janela — não é alguém chegando depois. Sem esta checagem, abrir uma aba
    // nova derrubaria a sessão da aba de trás, no meio do serviço.
    const temIrma = Date.now() - leNum(CHAVE_VIVA) < IRMA_VIVA_MS;

    if (daAba || temIrma) {
      try { sessionStorage.setItem(CHAVE_ABA, '1'); } catch { /* ignora */ }
      poe(CHAVE_TOQUE, Date.now());
      setEstado('dentro');
      return;
    }
    // Sessão de quem estava antes. Sai e devolve a tela de entrar.
    sair();
  }, []);

  // 2) Enquanto está dentro: bate o coração e anota o último toque.
  useEffect(() => {
    if (estado !== 'dentro' || ehCelular()) return;
    const bater = () => { if (!document.hidden) poe(CHAVE_VIVA, Date.now()); };
    const tocar = () => { poe(CHAVE_TOQUE, Date.now()); setFaltam(0); };
    bater(); tocar();
    const t = setInterval(bater, BATIDA_MS);
    const eventos = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'visibilitychange'];
    for (const ev of eventos) window.addEventListener(ev, tocar, { passive: true });
    return () => { clearInterval(t); for (const ev of eventos) window.removeEventListener(ev, tocar); };
  }, [estado]);

  // 3) Parado tempo demais: avisa, e depois sai.
  useEffect(() => {
    if (estado !== 'dentro' || ehCelular()) return;
    const t = setInterval(() => {
      const parado = Date.now() - leNum(CHAVE_TOQUE);
      if (parado >= OCIOSO_MS) { sair(); return; }
      const resta = OCIOSO_MS - parado;
      setFaltam(resta <= AVISO_MS ? Math.ceil(resta / 1000) : 0);
    }, 2000);
    return () => clearInterval(t);
  }, [estado]);

  if (estado === 'checando' || estado === 'saindo') return null;

  return (
    <>
      {children}
      {/* O AVISO ANTES DE SAIR.
          Sair sozinho sem avisar é a coisa que faz alguém dizer "esse app me
          derrubou". Um minuto e um botão mudam de "me derrubou" pra "me
          avisou e eu deixei". */}
      {avisando && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2000, padding: 'calc(12px + env(safe-area-inset-bottom)) 16px', display: 'flex', justifyContent: 'center' }}>
          <Card style={{ maxWidth: 420, width: '100%', borderColor: C.amber, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Saindo em {faltam}s</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Ninguém mexeu faz um tempo. É o computador do bar.</div>
            </div>
            <Btn small onClick={() => { poe(CHAVE_TOQUE, Date.now()); setFaltam(0); }}>Continuar</Btn>
          </Card>
        </div>
      )}
    </>
  );
}
