'use client';
import { useEffect } from 'react';

// Enquanto o PicoOS estiver aberto (no balcão, no celular do atendimento ou no
// notebook da dona), ele pergunta de tempos em tempos se tem reserva começando
// agora. Se tiver, o servidor manda o aviso pra quem está no salão.
//
// É por aqui e não por robô de servidor porque o plano da hospedagem só roda
// tarefa automática uma vez por dia — e reserva precisa de aviso na hora.
// Chamar demais não faz mal: o servidor guarda o que já avisou e nunca repete.
const INTERVALO = 4 * 60 * 1000;

export default function LembreteAgenda() {
  useEffect(() => {
    let vivo = true;
    const conferir = async () => {
      if (!vivo || document.hidden) return;
      try { await fetch('/api/push/agenda', { method: 'POST', cache: 'no-store' }); } catch { /* sem conexão: tenta depois */ }
    };
    conferir();
    const t = setInterval(conferir, INTERVALO);
    const aoVoltar = () => { if (!document.hidden) conferir(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', aoVoltar); };
  }, []);

  return null;
}
