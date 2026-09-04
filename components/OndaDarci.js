'use client';
import React, { useRef, useEffect } from 'react';

// A "voz" do Darci desenhada: uma linha de luz que ondula, como aquelas ondas
// de áudio. Parada ela quase não se mexe; quando ele ouve ou fala, a onda sobe,
// acelera e brilha mais. É canvas puro — sem biblioteca, leve no celular.
export default function OndaDarci({ ativo = false, largura = 108, altura = 34 }) {
  const ref = useRef(null);
  const ativoRef = useRef(ativo);
  ativoRef.current = ativo;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    cv.width = Math.round(largura * dpr);
    cv.height = Math.round(altura * dpr);
    ctx.scale(dpr, dpr);

    let raf = 0;
    let t = 0;
    let energia = 0; // 0 parado, 1 no auge — sobe e desce suave

    const linha = (fase, amp, cor, brilho, espessura) => {
      ctx.beginPath();
      for (let x = 0; x <= largura; x += 2) {
        const p = x / largura;
        // As pontas afinam, que nem na referência: a luz nasce e morre no ar.
        const env = Math.sin(Math.PI * p) ** 1.3;
        const y = altura / 2 + Math.sin(p * Math.PI * 3.1 + fase) * amp * env;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = cor;
      ctx.lineWidth = espessura;
      ctx.lineCap = 'round';
      ctx.shadowColor = brilho;
      ctx.shadowBlur = 5 + energia * 9;
      ctx.stroke();
    };

    const desenha = () => {
      const alvo = ativoRef.current ? 1 : 0;
      energia += (alvo - energia) * 0.07;
      t += 0.028 + energia * 0.055;

      ctx.clearRect(0, 0, largura, altura);
      const g = ctx.createLinearGradient(0, 0, largura, 0);
      g.addColorStop(0, 'rgba(60,120,255,0)');
      g.addColorStop(0.18, 'rgba(70,150,255,.95)');
      g.addColorStop(0.55, 'rgba(120,215,255,1)');
      g.addColorStop(0.85, 'rgba(170,110,255,.95)');
      g.addColorStop(1, 'rgba(170,110,255,0)');

      const base = altura * 0.10 + altura * 0.28 * energia;
      linha(t, base, g, 'rgba(120,200,255,.9)', 2);
      linha(t * 1.25 + 1.7, base * 0.55, 'rgba(150,200,255,.45)', 'rgba(120,200,255,.5)', 1.2);
      linha(t * 0.8 - 1.1, base * 0.35, 'rgba(190,150,255,.40)', 'rgba(170,110,255,.5)', 1);
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(desenha);
    };
    desenha();
    return () => cancelAnimationFrame(raf);
  }, [largura, altura]);

  return <canvas ref={ref} style={{ width: largura, height: altura, display: 'block' }} aria-hidden="true" />;
}
