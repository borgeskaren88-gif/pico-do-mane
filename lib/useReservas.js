'use client';
import { useState, useEffect, useCallback } from 'react';

// As mesas reservadas, pra quem precisa delas na tela. Três lugares diferentes
// pediam a mesma lista (o cartão do topo e os dois Darcis), cada um com sua
// cópia do mesmo fetch — agora é um só.
//
// O Darci usa isso pra cruzar reserva com estoque: "sexta tem mesa de 12 e o
// gelo acaba quinta". Sem conexão devolve lista vazia, e a tela segue igual.
export default function useReservas() {
  const [reservas, setReservas] = useState([]);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/reservas', { cache: 'no-store' });
      const j = await r.json();
      setReservas(j.ok && Array.isArray(j.reservas) ? j.reservas : []);
    } catch { /* sem conexão: segue sem as reservas */ }
  }, []);

  useEffect(() => {
    carregar();
    // Volta a olhar quando ela volta pro app — reserva nova entra sozinha.
    const aoVoltar = () => { if (!document.hidden) carregar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [carregar]);

  return reservas;
}
