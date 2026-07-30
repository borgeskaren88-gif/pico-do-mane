'use client';
import React, { useState, useRef, useEffect } from 'react';
import { C } from './ui';

// Ícone de microfone em SVG (monocromático, sem emoji).
const MicIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

// Botão de ditado por voz que anexa a transcrição (pt-BR) ao valor de um campo.
// Usa a Web Speech API do navegador. Se não houver suporte (ex.: Safari no
// iPhone), não renderiza nada — o campo segue por digitação (e o teclado do
// celular tem o microfone nativo). Com 'label' vira uma pílula com texto (para
// caixas de texto); sem 'label' vira um botão quadrado só com o ícone (para
// campos de uma linha).
export default function MicBtn({ value, onChange, label }) {
  const [ouvindo, setOuvindo] = useState(false);
  const [suportado, setSuportado] = useState(false);
  const recRef = useRef(null);
  const baseRef = useRef('');

  useEffect(() => {
    setSuportado(typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => { try { recRef.current && recRef.current.stop(); } catch { /* ignora */ } };
  }, []);

  const toggle = () => {
    if (ouvindo) { try { recRef.current && recRef.current.stop(); } catch { /* ignora */ } return; }
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = 'pt-BR';
    rec.continuous = true;
    rec.interimResults = true;
    baseRef.current = value ? value.replace(/\s+$/, '') + ' ' : '';
    let finalTxt = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTxt += t + ' '; else interim += t;
      }
      onChange(baseRef.current + finalTxt + interim);
    };
    rec.onerror = () => setOuvindo(false);
    rec.onend = () => { setOuvindo(false); recRef.current = null; };
    recRef.current = rec;
    try { rec.start(); setOuvindo(true); } catch { setOuvindo(false); }
  };

  if (!suportado) return null;

  if (label) {
    return (
      <button type="button" onClick={toggle} aria-pressed={ouvindo}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 8,
          background: ouvindo ? C.red : 'transparent', color: ouvindo ? '#fff' : C.accent,
          border: `1px solid ${ouvindo ? C.red : C.line}`, borderRadius: 999,
          padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
        <MicIcon />{ouvindo ? 'Gravando… toque para parar' : label}
      </button>
    );
  }

  return (
    <button type="button" onClick={toggle} aria-pressed={ouvindo}
      title={ouvindo ? 'Gravando… toque para parar' : 'Ditar por voz'}
      aria-label={ouvindo ? 'Gravando, toque para parar' : 'Ditar por voz'}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 44, height: 44, flexShrink: 0,
        background: ouvindo ? C.red : 'transparent', color: ouvindo ? '#fff' : C.accent,
        border: `1px solid ${ouvindo ? C.red : C.line}`, borderRadius: 10, cursor: 'pointer',
      }}>
      <MicIcon size={18} />
    </button>
  );
}
