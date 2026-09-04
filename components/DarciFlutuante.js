'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { C, inputStyle } from './ui';
import OrbDarci from './OrbDarci';
import { analisarBar, responder, ATALHOS } from '../lib/darci';
import { falarTexto, pararFala, podeOuvir, ReconhecimentoFala, lerSotaque } from '../lib/darciVoz';

// Bola da Darci: fica num canto, em qualquer tela do PicoOS.
// Ao tocar ela NÃO abre a tela dela — ela já começa a ouvir e responde ali
// mesmo, num balãozinho em cima da bola. A aba "Darci" continua existindo pra
// quando a dona quiser a tela inteira (voz, tom, conversa longa).
//
// No iPhone o Safari não tem reconhecimento de fala; nesse caso o balão abre
// com o campo pronto e os atalhos — a resposta vem em voz alta do mesmo jeito.
export default function DarciFlutuante({ onAbrir, ...dados }) {
  const [aberto, setAberto] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [falando, setFalando] = useState(false);
  const [pergunta, setPergunta] = useState('');
  const [ouviu, setOuviu] = useState('');      // o que ela falou
  const [resposta, setResposta] = useState(''); // o que a Darci respondeu
  const [ouvirOk, setOuvirOk] = useState(false); // este aparelho entende voz?
  const sotaqueRef = useRef('manezinho');

  useEffect(() => { setOuvirOk(podeOuvir()); sotaqueRef.current = lerSotaque(); }, []);

  const dadosRef = useRef(dados);
  dadosRef.current = dados;
  const recRef = useRef(null);
  const campoRef = useRef(null);
  const caixaRef = useRef(null);
  const timerRef = useRef(null);

  const pararTudo = useCallback(() => {
    try { recRef.current && recRef.current.abort(); } catch { /* ignora */ }
    recRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    pararFala();
    setOuvindo(false); setPensando(false); setFalando(false);
  }, []);

  const responderAgora = useCallback((texto) => {
    const q = String(texto || '').trim();
    if (!q) return;
    setOuviu(q);
    setPergunta('');
    setResposta('');
    setPensando(true);
    timerRef.current = setTimeout(() => {
      const resp = responder(q, analisarBar(dadosRef.current), sotaqueRef.current);
      setPensando(false);
      setResposta(resp);
      falarTexto(resp, { sotaque: sotaqueRef.current, aoIniciar: () => setFalando(true), aoTerminar: () => setFalando(false) });
    }, 380);
  }, []);

  // Começa a ouvir. Só funciona onde o navegador tem reconhecimento de fala.
  const ouvir = useCallback(() => {
    const Rec = ReconhecimentoFala();
    if (!Rec) { try { campoRef.current?.focus(); } catch { /* ignora */ } return; }
    pararFala();
    setFalando(false);
    try { recRef.current && recRef.current.abort(); } catch { /* ignora */ }
    const rec = new Rec();
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = true;
    let fala = '';
    rec.onresult = (e) => {
      let parcial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fala += t + ' '; else parcial += t;
      }
      setOuviu((fala + parcial).trim());
    };
    rec.onerror = () => { setOuvindo(false); recRef.current = null; };
    rec.onend = () => {
      setOuvindo(false);
      recRef.current = null;
      const dito = fala.trim();
      if (dito) responderAgora(dito);
    };
    recRef.current = rec;
    try { rec.start(); setOuvindo(true); setOuviu(''); setResposta(''); }
    catch { setOuvindo(false); }
  }, [responderAgora]);

  // Toque na bola: abre o balão e já sai ouvindo (o toque é o gesto que o
  // navegador exige pra liberar microfone e voz). Se ele já estiver falando,
  // só mostra o balão de novo — não corta a resposta no meio.
  const abrir = () => {
    setAberto(true);
    try { onAbrir && onAbrir(); } catch { /* ignora */ }
    if (falando || pensando) return;
    setOuviu(''); setResposta('');
    if (ouvirOk) ouvir();
    else setTimeout(() => { try { campoRef.current?.focus(); } catch { /* ignora */ } }, 60);
  };

  // Fechar o balão NÃO cala o Darci: ela pode guardar o balão e sair mexendo
  // no PicoOS enquanto ouve a resposta. Só para o microfone, que não faz
  // sentido continuar ligado com o balão fechado.
  const esconder = useCallback(() => {
    try { recRef.current && recRef.current.abort(); } catch { /* ignora */ }
    recRef.current = null;
    setOuvindo(false);
    setAberto(false);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const esc = (e) => { if (e.key === 'Escape') esconder(); };
    // Toque fora guarda o balão e SEGUE para o que ela tocou (não tem camada
    // por cima bloqueando o app).
    const fora = (e) => { if (caixaRef.current && !caixaRef.current.contains(e.target)) esconder(); };
    document.addEventListener('keydown', esc);
    document.addEventListener('pointerdown', fora);
    return () => { document.removeEventListener('keydown', esc); document.removeEventListener('pointerdown', fora); };
  }, [aberto, esconder]);

  // Ao sair da tela o microfone para, mas a fala continua — ela pode trocar de
  // aba ouvindo. E este relógio mantém o botão "parar de falar" certo mesmo
  // quando a resposta começou na tela cheia do Darci.
  useEffect(() => {
    const t = setInterval(() => { try { setFalando(!!(window.speechSynthesis && window.speechSynthesis.speaking)); } catch { /* ignora */ } }, 500);
    return () => {
      clearInterval(t);
      try { recRef.current && recRef.current.abort(); } catch { /* ignora */ }
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const ativa = ouvindo || pensando || falando;
  const estado = ouvindo ? 'te ouvindo…' : pensando ? 'pensando…' : falando ? 'falando' : 'toca na bola e pergunta';

  return (
    <>
      <style>{`
        @keyframes darci-halo { 0%,100% { box-shadow: 0 8px 26px rgba(0,0,0,.30), 0 0 0 0 color-mix(in srgb, ${C.accent} 40%, transparent) }
                                 50%     { box-shadow: 0 8px 26px rgba(0,0,0,.30), 0 0 0 9px color-mix(in srgb, ${C.accent} 0%, transparent) } }
        @keyframes darci-sobe { from { transform: translateY(10px); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes darci-blink { 0%,100%{opacity:.25} 50%{opacity:1} }
        /* A bola mora em cima, na faixa do cabeçalho. O recuo à direita deixa
           livres os botões que já ficam lá (o + , o atualizar, o Ocultar). */
        .darci-canto { position: fixed; z-index: 60;
          top: calc(8px + env(safe-area-inset-top));
          right: calc(14px + env(safe-area-inset-right));
          display: flex; flex-direction: column-reverse; align-items: flex-end; }
        .darci-bola { margin-right: 94px; }
        .darci-fab { animation: darci-halo 3.2s ease-out infinite; }
        .darci-balao { animation: darci-sobe .2s ease both; }
        .darci-pt { display:inline-block; width:5px; height:5px; border-radius:999px; background:${C.accent}; margin-right:4px; animation: darci-blink 1s infinite; }
        .darci-pt:nth-child(2){ animation-delay:.15s } .darci-pt:nth-child(3){ animation-delay:.3s }
      `}</style>

      <div className="darci-canto" ref={caixaRef}>
        {aberto && (
          <div className="darci-balao" role="dialog" aria-label="Darci" style={{
            width: 'min(320px, calc(100vw - 28px))', marginTop: 10,
            background: C.ink, border: `1px solid ${C.line}`, borderRadius: 18,
            boxShadow: '0 18px 44px rgba(0,0,0,.45)', padding: '12px 13px 13px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.10em', color: C.text }}>DARCI</span>
              <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>{estado}</span>
              <button onClick={esconder} aria-label="Fechar" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.muted, fontSize: 20, lineHeight: 1, padding: '0 2px', cursor: 'pointer' }}>×</button>
            </div>

            {ouviu && (
              <div style={{ fontSize: 12.5, color: C.muted, fontStyle: 'italic', marginBottom: 8 }}>“{ouviu}”</div>
            )}

            {pensando && (
              <div style={{ padding: '6px 0 10px' }}>
                <span className="darci-pt" /><span className="darci-pt" /><span className="darci-pt" />
              </div>
            )}

            {resposta && (
              <div style={{
                fontSize: 13.5, lineHeight: 1.5, color: C.text, background: C.panel,
                border: `1px solid ${C.cardBorder}`, borderRadius: 14, padding: '10px 12px',
                maxHeight: '38vh', overflowY: 'auto', marginBottom: 10,
              }}>{resposta}</div>
            )}

            {/* Campo escrito: é o caminho do iPhone (sem reconhecimento de fala)
                e a saída pra quando o microfone não entender. */}
            <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
              <input
                ref={campoRef}
                value={pergunta}
                onChange={(e) => setPergunta(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') responderAgora(pergunta); }}
                placeholder="Pergunta pra Darci…"
                style={{ ...inputStyle, flex: 1, minWidth: 0, padding: '9px 11px', fontSize: 13 }}
              />
              {ouvirOk ? (
                <button onClick={() => (ouvindo ? pararTudo() : ouvir())}
                  aria-label={ouvindo ? 'Parar de ouvir' : 'Falar com a Darci'}
                  style={{
                    width: 40, height: 40, flexShrink: 0, borderRadius: 12, cursor: 'pointer',
                    display: 'grid', placeItems: 'center',
                    background: ouvindo ? C.red : 'transparent', color: ouvindo ? '#fff' : C.accent,
                    border: `1px solid ${ouvindo ? C.red : C.line}`,
                  }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
                </button>
              ) : (
                <button onClick={() => responderAgora(pergunta)}
                  style={{ flexShrink: 0, borderRadius: 12, cursor: 'pointer', padding: '10px 13px', fontSize: 13, fontWeight: 800, background: C.accent, color: '#06101F', border: 'none' }}>Ir</button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 9, overflowX: 'auto', paddingBottom: 2 }}>
              {ATALHOS.slice(0, 4).map((a) => (
                <button key={a} onClick={() => responderAgora(a)} style={{
                  border: `1px solid ${C.line}`, background: 'transparent', color: C.muted, borderRadius: 999,
                  padding: '6px 11px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}>{a}</button>
              ))}
            </div>

            {falando && (
              <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => { pararFala(); setFalando(false); }}
                  style={{ background: 'none', border: 'none', color: C.red, fontSize: 12, fontWeight: 700, padding: 0, cursor: 'pointer' }}>parar de falar</button>
                <span style={{ fontSize: 11, color: C.faint }}>Pode fechar e mexer no PicoOS — eu continuo falando.</span>
              </div>
            )}
          </div>
        )}

        <button
          className="darci-fab darci-bola"
          onClick={() => { if (!aberto) return abrir(); if (falando || pensando) return esconder(); return ouvirOk ? ouvir() : esconder(); }}
          aria-label="Falar com a Darci"
          title="Falar com a Darci"
          style={{
            width: 54, height: 54, borderRadius: 999, padding: 0, overflow: 'hidden',
            border: `1px solid ${ativa ? C.accent : C.line}`, background: C.panel, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}
        >
          <OrbDarci ativo={ativa} tamanho={52} />
        </button>
      </div>
    </>
  );
}
