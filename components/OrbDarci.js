'use client';
import React, { useRef, useEffect } from 'react';

// Esfera de dados da Darci: um núcleo pulsante com anéis de partículas em órbita
// e arcos de HUD girando. Fica "respirando" parada e ganha energia (mais brilho,
// mais velocidade, ondas saindo) enquanto ela pensa ou fala.
// Desenhada em canvas pra ficar leve e fluida no celular.

const DEFAULTS = { accent: '#3B86F5', accent2: '#6FB0FA' };

// Converte #RGB / #RRGGBB em rgba(). Se vier outra coisa, usa o padrão.
const rgba = (cor, a, fallback) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(cor || '').trim());
  const hex = m ? m[1] : /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(fallback)[1];
  const c = hex.length === 3 ? hex.split('').map((x) => x + x).join('') : hex;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

export default function OrbDarci({ ativo = false, tamanho = 200 }) {
  const ref = useRef(null);
  const ativoRef = useRef(ativo);
  useEffect(() => { ativoRef.current = ativo; }, [ativo]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    cv.width = tamanho * dpr; cv.height = tamanho * dpr;
    cv.style.width = tamanho + 'px'; cv.style.height = tamanho + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Pega as cores do tema (mudam com claro/escuro).
    let acc = DEFAULTS.accent, acc2 = DEFAULTS.accent2;
    try {
      const css = getComputedStyle(document.documentElement);
      acc = css.getPropertyValue('--c-accent').trim() || acc;
      acc2 = css.getPropertyValue('--c-accent2').trim() || acc2;
    } catch { /* usa o padrão */ }

    const R = tamanho / 2;
    const TAU = Math.PI * 2;
    // Três anéis de partículas, cada um com raio, inclinação e velocidade próprios.
    const aneis = [
      { n: 28, raio: 0.80, tilt: 0.20, vel: 0.0090, cor: acc },
      { n: 22, raio: 0.60, tilt: -0.45, vel: -0.0130, cor: acc2 },
      { n: 18, raio: 0.94, tilt: 0.68, vel: 0.0062, cor: acc },
    ];

    let raf = 0, t = 0, energia = 0;
    const ondas = []; // ondas que saem do núcleo quando ela fala

    const quadro = () => {
      t += 1;
      // Energia sobe/desce suave (não pisca ao ligar/desligar).
      energia += ((ativoRef.current ? 1 : 0) - energia) * 0.055;
      const cx = R, cy = R;
      ctx.clearRect(0, 0, tamanho, tamanho);

      // Halo de fundo.
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, rgba(acc, 0.26 + energia * 0.30, DEFAULTS.accent));
      g.addColorStop(0.5, rgba(acc, 0.07 + energia * 0.10, DEFAULTS.accent));
      g.addColorStop(1, rgba(acc, 0, DEFAULTS.accent));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();

      // Ondas de fala: nascem no núcleo e se abrem.
      if (energia > 0.35 && t % 16 === 0) ondas.push({ r: R * 0.22, a: 0.5 });
      for (let i = ondas.length - 1; i >= 0; i--) {
        const o = ondas[i];
        o.r += 1.5 + energia * 1.2;
        o.a -= 0.011;
        if (o.a <= 0 || o.r > R) { ondas.splice(i, 1); continue; }
        ctx.strokeStyle = rgba(acc2, o.a, DEFAULTS.accent2);
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy, o.r, 0, TAU); ctx.stroke();
      }

      // Arcos de HUD girando (o ar "tecnológico").
      ctx.lineWidth = 1.4;
      for (let k = 0; k < 3; k++) {
        const rr = R * (0.70 + k * 0.11);
        const ini = t * (0.006 + k * 0.004) * (k % 2 ? -1 : 1);
        const arco = 0.7 + k * 0.25;
        ctx.strokeStyle = rgba(k % 2 ? acc2 : acc, 0.18 + energia * 0.35, DEFAULTS.accent);
        ctx.beginPath(); ctx.arc(cx, cy, rr, ini, ini + arco); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, rr, ini + Math.PI, ini + Math.PI + arco * 0.6); ctx.stroke();
      }

      // Anéis de partículas (achatados + inclinados = sensação de esfera 3D).
      for (const an of aneis) {
        const rr = R * an.raio;
        for (let i = 0; i < an.n; i++) {
          const ang = (i / an.n) * TAU + t * an.vel * (1 + energia * 1.6);
          const ex = Math.cos(ang) * rr;
          const ey = Math.sin(ang) * rr * 0.34;
          const x = cx + ex * Math.cos(an.tilt) - ey * Math.sin(an.tilt);
          const y = cy + ex * Math.sin(an.tilt) + ey * Math.cos(an.tilt);
          const prof = (Math.sin(ang) + 1) / 2; // 0 = atrás, 1 = na frente
          const raio = 1.0 + prof * 2.0 + energia * 1.3;
          ctx.fillStyle = rgba(an.cor, (0.18 + prof * 0.55) * (0.65 + energia * 0.45), DEFAULTS.accent);
          ctx.beginPath(); ctx.arc(x, y, raio, 0, TAU); ctx.fill();
        }
      }

      // Núcleo: pulsa devagar parada, bate mais forte falando.
      const pulso = 1 + Math.sin(t * 0.045) * 0.05 + energia * 0.10 * Math.sin(t * 0.30);
      const rn = R * 0.20 * pulso;
      const gn = ctx.createRadialGradient(cx, cy, 0, cx, cy, rn);
      gn.addColorStop(0, rgba('#ffffff', 0.85, '#ffffff'));
      gn.addColorStop(0.4, rgba(acc2, 0.75 + energia * 0.2, DEFAULTS.accent2));
      gn.addColorStop(1, rgba(acc, 0, DEFAULTS.accent));
      ctx.fillStyle = gn;
      ctx.beginPath(); ctx.arc(cx, cy, rn, 0, TAU); ctx.fill();

      raf = requestAnimationFrame(quadro);
    };

    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
  }, [tamanho]);

  return <canvas ref={ref} aria-hidden="true" style={{ display: 'block', margin: '0 auto' }} />;
}
