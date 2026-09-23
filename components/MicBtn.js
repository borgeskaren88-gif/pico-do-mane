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
// Usa a Web Speech API do navegador.
//
// ELE FALHAVA CALADO. `onerror` só desligava o estado: microfone bloqueado,
// sem internet, sem microfone no aparelho — tudo dava exatamente a mesma coisa
// na tela, que é nada. Ela tocava, o botão piscava, e ela concluía que "não
// funciona". E quando o navegador não tem ditado (Safari no iPhone) o botão
// simplesmente não existia, sem uma linha explicando por quê nem o que fazer
// no lugar.
//
// Erro sem mensagem não é erro, é mistério — e mistério em sistema de trabalho
// vira "esse app é ruim" e a pessoa para de tentar.

// O que cada código do navegador quer dizer, em português e com o conserto
// junto. Sem o conserto, saber o nome do problema não ajuda ninguém.
const RECADOS = {
  'not-allowed': 'O navegador bloqueou o microfone. Clica no cadeado do lado do endereço, acha "Microfone" e põe em Permitir.',
  'service-not-allowed': 'O navegador bloqueou o microfone. Clica no cadeado do lado do endereço, acha "Microfone" e põe em Permitir.',
  'audio-capture': 'Não achei microfone nesse aparelho.',
  network: 'O ditado precisa de internet, e ela falhou agora. Tenta de novo.',
  'no-speech': 'Não ouvi nada. Toca de novo e fala mais perto.',
  'language-not-supported': 'Esse navegador não tem português no ditado.',
  aborted: '',
};

export default function MicBtn({ value, onChange, label }) {
  const [ouvindo, setOuvindo] = useState(false);
  const [suportado, setSuportado] = useState(null); // null = ainda não sei
  const [recado, setRecado] = useState('');
  const recRef = useRef(null);
  const baseRef = useRef('');
  const ouviuRef = useRef(false);
  const erroRef = useRef(false);

  useEffect(() => {
    setSuportado(typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => { try { recRef.current && recRef.current.stop(); } catch { /* ignora */ } };
  }, []);

  const toggle = () => {
    if (ouvindo) { try { recRef.current && recRef.current.stop(); } catch { /* ignora */ } return; }
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) return;

    setRecado('');
    ouviuRef.current = false;
    erroRef.current = false;

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
      if (finalTxt || interim) ouviuRef.current = true;
      onChange(baseRef.current + finalTxt + interim);
    };

    rec.onerror = (e) => {
      erroRef.current = true;
      const codigo = (e && e.error) || '';
      // Código desconhecido ainda aparece: é melhor ela poder me mandar o nome
      // dele do que a tela ficar muda de novo.
      const msg = codigo in RECADOS ? RECADOS[codigo] : `Não consegui gravar (${codigo || 'erro desconhecido'}).`;
      if (msg) setRecado(msg);
      setOuvindo(false);
    };

    rec.onend = () => {
      setOuvindo(false);
      recRef.current = null;
      // Terminou sem erro e sem ter ouvido nada: também é uma resposta, e sem
      // ela o silêncio volta a parecer defeito.
      if (!erroRef.current && !ouviuRef.current) setRecado(RECADOS['no-speech']);
    };

    recRef.current = rec;
    try {
      rec.start();
      setOuvindo(true);
    } catch (e) {
      setOuvindo(false);
      setRecado('O microfone já estava gravando. Espera um instante e tenta de novo.');
    }
  };

  // Enquanto não se sabe (primeiro render, antes do efeito), não pisca nada.
  if (suportado === null) return null;

  // Sem ditado no navegador — Safari do iPhone e do iPad é o caso dela. Antes
  // aqui não vinha NADA, e um campo sem botão nenhum não explica que existe
  // outro caminho a um toque de distância.
  if (!suportado) {
    return (
      <div style={{ fontSize: 11, color: C.faint, lineHeight: 1.4, marginTop: label ? 8 : 0 }}>
        Ditado não funciona neste navegador. No iPhone e no iPad, usa o
        {' '}<b style={{ color: C.muted }}>microfone do próprio teclado</b> — fica do lado da barra de espaço.
      </div>
    );
  }

  const Aviso = recado ? (
    <div style={{ fontSize: 11.5, color: C.amber, lineHeight: 1.45, marginTop: 6, fontWeight: 600 }}>{recado}</div>
  ) : null;

  if (label) {
    return (
      <div>
        <button type="button" onClick={toggle} aria-pressed={ouvindo}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 8,
            background: ouvindo ? C.red : 'transparent', color: ouvindo ? '#fff' : C.accent,
            border: `1px solid ${ouvindo ? C.red : C.line}`, borderRadius: 999,
            padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
          <MicIcon />{ouvindo ? 'Gravando… toque para parar' : label}
        </button>
        {Aviso}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
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
      {Aviso}
    </div>
  );
}
