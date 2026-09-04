'use client';
import React, { useRef, useEffect, useState } from 'react';

// A "voz" do Darci desenhada: uma linha de luz que ondula, como aquelas ondas
// de áudio. Parada ela quase não se mexe; quando ele ouve ou fala, a onda sobe,
// acelera e brilha mais. É canvas puro — sem biblioteca, leve no celular.
//
// Sem a prop `largura` ela ocupa toda a largura de onde estiver (e se ajusta
// sozinha quando a tela muda de tamanho).
export default function OndaDarci({ ativo = false, largura, altura = 34, neon = true, cor = 'var(--c-accent)' }) {
  const caixaRef = useRef(null);
  const ref = useRef(null);
  const ativoRef = useRef(ativo);
  ativoRef.current = ativo;
  const [medida, setMedida] = useState(largura || 0);

  // Largura fluida: mede a caixa e refaz o desenho quando ela muda.
  useEffect(() => {
    if (largura) { setMedida(largura); return; }
    const el = caixaRef.current;
    if (!el) return;
    const medir = () => setMedida(Math.max(60, Math.round(el.clientWidth)));
    medir();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir);
      return () => window.removeEventListener('resize', medir);
    }
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [largura]);

  useEffect(() => {
    const w = medida;
    const cv = ref.current;
    if (!cv || !w) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(altura * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    let t = 0;
    let energia = 0; // 0 parado, 1 no auge — sobe e desce suave
    let quadro = 0;
    // A cor pode vir como var(--c-accent); o canvas não entende — resolve aqui,
    // e de vez em quando de novo, pra acompanhar a troca de tema.
    let corReal = cor;
    const resolverCor = () => {
      if (!/^var\(/.test(cor)) { corReal = cor; return; }
      try {
        const nome = cor.slice(4, -1).trim();
        const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
        corReal = v || '#3B86F5';
      } catch { corReal = '#3B86F5'; }
    };
    resolverCor();

    // Desenha o caminho da onda uma vez; as camadas por cima é que dão o neon.
    const caminho = (fase, amp) => {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const p = x / w;
        // As pontas afinam, que nem na referência: a luz nasce e morre no ar.
        const env = Math.sin(Math.PI * p) ** 1.25;
        // E o fim da onda sobe um tiquinho, dando aquele rabinho pra cima.
        const sobe = altura * 0.10 * p ** 3;
        const y = altura / 2 + Math.sin(p * Math.PI * 3.4 + fase) * amp * env - sobe;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    };

    const passa = (fase, amp, cor, espessura, alpha, brilho) => {
      caminho(fase, amp);
      ctx.strokeStyle = cor;
      ctx.lineWidth = espessura;
      ctx.lineCap = 'round';
      ctx.globalAlpha = alpha;
      ctx.shadowColor = 'rgba(120,200,255,.85)';
      ctx.shadowBlur = brilho;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    const desenha = () => {
      const alvo = ativoRef.current ? 1 : 0;
      energia += (alvo - energia) * 0.07;
      t += 0.026 + energia * 0.055;

      ctx.clearRect(0, 0, w, altura);

      // Modo simples: um traço só, na cor do app — pra viver dentro das barras
      // claras do PicoOS sem parecer um pedaço de outro programa.
      if (!neon) {
        if (quadro++ % 30 === 0) resolverCor();
        const ampS = altura * (0.16 + 0.24 * energia);
        passa(t, ampS, corReal, Math.max(1.6, altura * 0.10), 1, 0);
        raf = requestAnimationFrame(desenha);
        return;
      }

      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(50,110,255,0)');
      g.addColorStop(0.16, 'rgba(70,150,255,1)');
      g.addColorStop(0.52, 'rgba(130,220,255,1)');
      g.addColorStop(0.86, 'rgba(175,110,255,1)');
      g.addColorStop(1, 'rgba(175,110,255,0)');

      const amp = altura * (0.09 + 0.26 * energia);
      const esc = altura / 34; // as espessuras acompanham o tamanho da onda
      // Neon: um borrão largo por baixo, uma camada média e um miolo fino claro.
      passa(t, amp, g, 11 * esc, 0.12, 16 * esc);
      passa(t, amp, g, 4.5 * esc, 0.34, 10 * esc);
      passa(t, amp, g, 1.7 * esc, 1, 7 * esc + energia * 6);
      // Duas sombras soltas atrás, pra onda ter profundidade.
      passa(t * 1.22 + 1.7, amp * 0.5, 'rgba(150,200,255,.5)', 1.2 * esc, 0.5, 6 * esc);
      passa(t * 0.78 - 1.1, amp * 0.32, 'rgba(195,150,255,.5)', 1 * esc, 0.45, 6 * esc);

      raf = requestAnimationFrame(desenha);
    };
    desenha();
    return () => cancelAnimationFrame(raf);
  }, [medida, altura, neon, cor]);

  return (
    <div ref={caixaRef} style={{ width: largura || '100%', height: altura, lineHeight: 0 }}>
      <canvas ref={ref} style={{ width: medida || '100%', height: altura, display: 'block' }} aria-hidden="true" />
    </div>
  );
}
