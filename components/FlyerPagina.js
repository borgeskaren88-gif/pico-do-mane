'use client';
import React, { useState } from 'react';
import { C, LogoMark, pageBg } from './ui';

// O flyer, pra ver, baixar e compartilhar. No celular, "Compartilhar" abre a
// folha do próprio aparelho (WhatsApp, Instagram, Mensagens) JÁ COM A IMAGEM;
// onde isso não existe (computador), vira "copiar o link".

const IMAGEM = '/divulgar/picoos-flyer.png';
const PDF = '/divulgar/picoos-flyer.pdf';
const LINK_FLYER = 'https://pico-do-mane.vercel.app/flyer';
const LINK_SITE = 'https://pico-do-mane.vercel.app/conheca';

const botao = (primario) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', textDecoration: 'none',
  borderRadius: 12, padding: '13px 18px', fontSize: 15, fontWeight: 800, cursor: 'pointer', lineHeight: 1.2,
  background: primario ? C.accent : 'transparent', color: primario ? '#06101F' : C.text,
  border: primario ? 'none' : `1px solid ${C.line}`, flex: '1 1 200px',
});

export default function FlyerPagina() {
  const [aviso, setAviso] = useState('');
  const dizer = (t) => { setAviso(t); setTimeout(() => setAviso(''), 3500); };

  const copiar = async (texto, ok) => {
    try { await navigator.clipboard.writeText(texto); dizer(ok); } catch { dizer('Não consegui copiar. Segura o link e copia.'); }
  };

  const compartilhar = async () => {
    try {
      // Com a imagem junto, quando o aparelho deixa.
      const r = await fetch(IMAGEM);
      const blob = await r.blob();
      const arquivo = new File([blob], 'picoos-flyer.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: 'PicoOS — 14 dias grátis', text: `Teu bar no controle, direto do celular. Testa 14 dias grátis: ${LINK_SITE}` });
        return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try {
      if (navigator.share) { await navigator.share({ title: 'PicoOS — 14 dias grátis', url: LINK_FLYER }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    copiar(LINK_FLYER, 'Link copiado. É só colar onde quiseres mandar.');
  };

  return (
    <main style={{ minHeight: '100dvh', background: pageBg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif', padding: '26px 16px 60px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
          <LogoMark size={34} radius={10} />
          <div style={{ fontSize: 17, fontWeight: 900 }}>PicoOS <span style={{ color: C.muted, fontWeight: 700 }}>· flyer</span></div>
        </div>

        {/* A imagem inteira, do tamanho da tela. Tocar nela abre em tamanho cheio. */}
        <a href={IMAGEM} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
          <img data-flyer-imagem src={IMAGEM} alt="Flyer do PicoOS: teu bar no controle, direto do celular. 14 dias grátis. QR code e link pico-do-mane.vercel.app/conheca"
            width={1588} height={2246}
            style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 14, border: `1px solid ${C.line}`, boxShadow: '0 18px 50px rgba(0,0,0,.35)' }} />
        </a>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
          <button data-compartilhar onClick={compartilhar} style={botao(true)}>Compartilhar</button>
          <a data-baixar-imagem href={IMAGEM} download="picoos-flyer.png" style={botao(false)}>Baixar a imagem</a>
          <a data-baixar-pdf href={PDF} download="picoos-flyer.pdf" style={botao(false)}>Baixar o PDF (A4)</a>
          <button data-copiar-link onClick={() => copiar(LINK_FLYER, 'Link do flyer copiado.')} style={botao(false)}>Copiar o link</button>
        </div>
        {aviso && <div data-aviso style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: C.green, lineHeight: 1.5 }}>{aviso}</div>}

        <div style={{ marginTop: 26, borderTop: `1px solid ${C.hair}`, paddingTop: 18, fontSize: 14, color: C.muted, lineHeight: 1.65 }}>
          O QR code do flyer abre <b style={{ color: C.text }}>pico-do-mane.vercel.app/conheca</b>, onde a pessoa cria o bar e testa <b style={{ color: C.text }}>14 dias grátis</b>, sem cartão.
          <div style={{ marginTop: 14 }}>
            <a data-criar href="/criar" style={{ color: C.accent, fontWeight: 800 }}>Quero criar o meu bar →</a>
          </div>
        </div>
      </div>
    </main>
  );
}
