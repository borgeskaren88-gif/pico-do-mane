'use client';
import React, { useState, useRef, useEffect } from 'react';
import { C, Area } from './ui';

// Ícone de microfone em SVG (monocromático, sem emoji).
const MicIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

// Área de texto com botão de ditado por voz. Usa a Web Speech API do navegador
// (transcrição em pt-BR). Se o navegador não suportar (ex.: Safari no iPhone),
// o botão simplesmente não aparece e o campo continua funcionando por digitação
// (o teclado do celular tem o microfone nativo nesses casos).
export default function AreaVoz({ value, onChange, placeholder, rows }) {
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

  return (
    <div>
      <Area value={value} onChange={onChange} placeholder={placeholder} rows={rows} />
      {suportado && (
        <button type="button" onClick={toggle} aria-pressed={ouvindo}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 8,
            background: ouvindo ? C.red : 'transparent',
            color: ouvindo ? '#fff' : C.accent,
            border: `1px solid ${ouvindo ? C.red : C.line}`,
            borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
          <MicIcon />
          {ouvindo ? 'Gravando… toque para parar' : 'Ditar por voz'}
        </button>
      )}
    </div>
  );
}
