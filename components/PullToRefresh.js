'use client';
import React, { useEffect, useRef, useState } from 'react';
import { C } from './ui';

// Puxar-para-atualizar no celular: quando a tela está no topo e o dedo arrasta
// pra baixo além do limiar, recarrega o app (mesmo efeito do botão Atualizar).
const LIMIAR = 70;
const MAX = 110;

export default function PullToRefresh() {
  const [dist, setDist] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const startY = useRef(null);
  const distRef = useRef(0);
  const carregandoRef = useRef(false);

  useEffect(() => {
    const onStart = (e) => {
      if (carregandoRef.current) return;
      if (window.scrollY > 4 || e.touches.length !== 1) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e) => {
      if (startY.current == null || carregandoRef.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 4) { distRef.current = 0; setDist(0); setArrastando(false); return; }
      const d = Math.min(MAX, dy * 0.5);
      distRef.current = d;
      setDist(d);
      setArrastando(true);
    };
    const onEnd = () => {
      if (startY.current == null) return;
      startY.current = null;
      setArrastando(false);
      if (distRef.current >= LIMIAR) {
        carregandoRef.current = true;
        setCarregando(true);
        setDist(LIMIAR);
        setTimeout(() => window.location.reload(), 180);
      } else {
        distRef.current = 0;
        setDist(0);
      }
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const visivel = dist > 4 || carregando;
  const pronto = dist >= LIMIAR;
  return (
    <div aria-hidden="true" style={{
      position: 'fixed', top: 'env(safe-area-inset-top)', left: 0, right: 0, display: 'flex', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 60,
      transform: `translateY(${(carregando ? LIMIAR : dist) - 44}px)`,
      opacity: visivel ? 1 : 0,
      transition: arrastando ? 'none' : 'transform .22s ease, opacity .22s ease',
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 999, background: C.panel, border: `1px solid ${C.line}`, boxShadow: C.cardShadow, display: 'flex', alignItems: 'center', justifyContent: 'center', color: pronto || carregando ? C.accent : C.muted }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ animation: carregando ? 'pdm-spin .7s linear infinite' : 'none', transform: carregando ? 'none' : `rotate(${dist * 2.6}deg)` }}>
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </div>
    </div>
  );
}
