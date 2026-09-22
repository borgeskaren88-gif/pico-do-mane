'use client';
import { useEffect, useRef } from 'react';
import { VERSAO_BUILD, publicadaDaResposta } from '../lib/versao';

// Mantém o PicoOS na versão publicada sem ninguém precisar saber disso.
//
// O app aberto (principalmente o instalado no notebook, que fica dias sem
// fechar) continua rodando a versão que carregou. Aqui ele pergunta de vez em
// quando qual é a versão no ar e, se saiu uma nova, recarrega sozinho — mas só
// num momento seguro: nada sendo digitado e a tela em primeiro plano.
//
// A comparação parte da versão do PACOTE (o carimbo do build), não da primeira
// resposta do servidor. Era essa a falha: quem carregava uma versão velha
// gravava a versão NOVA do servidor como se fosse a sua, as duas batiam pra
// sempre e o aparelho nunca mais se atualizava sozinho.
const INTERVALO = 5 * 60 * 1000; // olha a cada 5 minutos
const CARENCIA = 60 * 1000;      // nunca recarrega no primeiro minuto
const RETENTATIVA = 20 * 1000;   // achou versão nova mas não pôde trocar: volta logo

export default function AtualizacaoAuto() {
  const versaoRef = useRef(VERSAO_BUILD || null);
  const nascimento = useRef(Date.now());
  const recarregou = useRef(false);
  const agendado = useRef(null);

  useEffect(() => {
    let vivo = true;

    const digitando = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = (el.tagName || '').toUpperCase();
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    // Uma retentativa por vez. Sem isto, cada checagem bloqueada deixaria um
    // timer solto e eles iriam se acumulando enquanto ela preenche um formulário.
    const remarcar = (ms) => {
      if (agendado.current != null) return;
      agendado.current = setTimeout(() => { agendado.current = null; olhar(); }, ms);
    };

    const olhar = async () => {
      if (!vivo || recarregou.current || document.hidden) return;
      let v;
      try {
        const r = await fetch('/api/versao', { cache: 'no-store' });
        const j = await r.json();
        v = publicadaDaResposta(j);
      } catch { return; } // sem internet: fica quieto e tenta depois
      if (!v || !vivo) return;
      if (versaoRef.current == null) { versaoRef.current = v; return; }
      if (v === versaoRef.current) return;
      // Achou versão nova. Se não dá pra trocar agora, não desiste até a próxima
      // rodada de 5 minutos — ela pode passar meia hora dentro de um formulário.
      const espera = CARENCIA - (Date.now() - nascimento.current);
      if (espera > 0) { remarcar(espera + 500); return; }
      if (digitando()) { remarcar(RETENTATIVA); return; }
      recarregou.current = true;
      try { window.location.reload(); } catch { /* ignora */ }
    };

    olhar();
    const timer = setInterval(olhar, INTERVALO);
    // Voltar pro app é a hora mais segura de trocar de versão.
    const aoVoltar = () => { if (!document.hidden) olhar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    return () => {
      vivo = false;
      clearInterval(timer);
      if (agendado.current != null) { clearTimeout(agendado.current); agendado.current = null; }
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
    };
  }, []);

  return null;
}
