'use client';
import { useEffect, useRef } from 'react';

// Mantém o PicoOS na versão publicada sem ninguém precisar saber disso.
//
// O app aberto (principalmente o instalado no notebook, que fica dias sem
// fechar) continua rodando a versão que carregou. Aqui ele pergunta de vez em
// quando qual é a versão no ar e, se saiu uma nova, recarrega sozinho — mas só
// num momento seguro: nada sendo digitado e a tela em primeiro plano.
const INTERVALO = 5 * 60 * 1000; // olha a cada 5 minutos
const CARENCIA = 60 * 1000;      // nunca recarrega no primeiro minuto

export default function AtualizacaoAuto() {
  const versaoRef = useRef(null);
  const nascimento = useRef(Date.now());

  useEffect(() => {
    let vivo = true;

    const digitando = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = (el.tagName || '').toUpperCase();
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const olhar = async () => {
      if (!vivo || document.hidden) return;
      let v;
      try {
        const r = await fetch('/api/versao', { cache: 'no-store' });
        const j = await r.json();
        v = j && j.v;
      } catch { return; } // sem internet: fica quieto e tenta depois
      if (!v || !vivo) return;
      if (versaoRef.current == null) { versaoRef.current = v; return; }
      if (v === versaoRef.current) return;
      if (Date.now() - nascimento.current < CARENCIA || digitando()) return;
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
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
    };
  }, []);

  return null;
}
