'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { C, inputStyle } from './ui';
import OndaDarci from './OndaDarci';
import { analisarBar, responder, ATALHOS } from '../lib/darci';
import { falarTexto, pararFala, podeOuvir, ReconhecimentoFala, lerSotaque } from '../lib/darciVoz';

// A onda do Darci: encaixa numa barra que já existe (a lateral no computador,
// a barra de cima no celular), em linha com os outros botões. Ao tocar ela NÃO
// abre a tela dele — ele já começa a ouvir e responde ali mesmo, num balão
// grudado no botão. A aba "Darci" continua existindo pra quando a dona quiser a
// tela inteira (voz, tom, jeito de falar, conversa longa).
//
// No iPhone o Safari não tem reconhecimento de fala; nesse caso o balão abre
// com o campo pronto e os atalhos — a resposta vem em voz alta do mesmo jeito.
export default function DarciFlutuante({ onAbrir, cheio = false, ...dados }) {
  const [aberto, setAberto] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [falando, setFalando] = useState(false);
  const [pergunta, setPergunta] = useState('');
  const [ouviu, setOuviu] = useState('');      // o que ela falou
  const [resposta, setResposta] = useState(''); // o que a Darci respondeu
  const [ouvirOk, setOuvirOk] = useState(false); // este aparelho entende voz?
  const [pos, setPos] = useState(null); // onde o balão abre, medido no botão
  const sotaqueRef = useRef('manezinho');

  useEffect(() => { setOuvirOk(podeOuvir()); sotaqueRef.current = lerSotaque(); }, []);

  const dadosRef = useRef(dados);
  dadosRef.current = dados;
  const recRef = useRef(null);
  const campoRef = useRef(null);
  const caixaRef = useRef(null);
  const botaoRef = useRef(null);
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
    posicionar();
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

  // O balão abre grudado no botão, medido de verdade — assim ele nunca fica
  // solto no meio da tela nem por cima de outra coisa, esteja o botão no
  // cabeçalho do celular ou na lateral do computador.
  const posicionar = useCallback(() => {
    const b = botaoRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const larg = Math.min(320, window.innerWidth - 24);
    const esquerda = Math.min(Math.max(12, r.right - larg), window.innerWidth - larg - 12);
    const paraBaixo = r.top < window.innerHeight / 2;
    setPos({
      largura: larg,
      left: Math.round(esquerda),
      top: paraBaixo ? Math.round(r.bottom + 8) : null,
      bottom: paraBaixo ? null : Math.round(window.innerHeight - r.top + 8),
    });
  }, []);

  useEffect(() => {
    if (!aberto) return;
    posicionar();
    window.addEventListener('resize', posicionar);
    window.addEventListener('scroll', posicionar, true);
    const esc = (e) => { if (e.key === 'Escape') esconder(); };
    // Toque fora guarda o balão e SEGUE para o que ela tocou (não tem camada
    // por cima bloqueando o app).
    const fora = (e) => { if (caixaRef.current && !caixaRef.current.contains(e.target)) esconder(); };
    document.addEventListener('keydown', esc);
    document.addEventListener('pointerdown', fora);
    return () => {
      window.removeEventListener('resize', posicionar);
      window.removeEventListener('scroll', posicionar, true);
      document.removeEventListener('keydown', esc);
      document.removeEventListener('pointerdown', fora);
    };
  }, [aberto, esconder, posicionar]);

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
  const estado = ouvindo ? 'te ouvindo…' : pensando ? 'pensando…' : falando ? 'falando' : 'toca e pergunta';

  return (
    <>
      <style>{`
        @keyframes darci-sobe { from { transform: translateY(10px); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes darci-blink { 0%,100%{opacity:.25} 50%{opacity:1} }
        /* O botão mora na barra onde foi colocado (cabeçalho ou lateral), em
           linha com os outros — nada de flutuar solto por cima da tela. */
        .darci-canto { display: flex; flex-shrink: 0; align-items: center; }
        .darci-balao { animation: darci-sobe .2s ease both; }
        .darci-pt { display:inline-block; width:5px; height:5px; border-radius:999px; background:${C.accent}; margin-right:4px; animation: darci-blink 1s infinite; }
        .darci-pt:nth-child(2){ animation-delay:.15s } .darci-pt:nth-child(3){ animation-delay:.3s }
      `}</style>

      <div className="darci-canto" ref={caixaRef} style={cheio ? { width: '100%' } : undefined}>
        {aberto && pos && (
          <div className="darci-balao" role="dialog" aria-label="Darci" style={{
            position: 'fixed', zIndex: 70,
            left: pos.left, top: pos.top == null ? undefined : pos.top, bottom: pos.bottom == null ? undefined : pos.bottom,
            width: pos.largura,
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

        {/* A onda de voz do Darci, deitada na faixa do cabeçalho: ocupa pouca
            altura e não briga com os botões que já moram lá. */}
        <button
          ref={botaoRef}
          className="darci-bola"
          onClick={() => { if (!aberto) return abrir(); if (falando || pensando) return esconder(); return ouvirOk ? ouvir() : esconder(); }}
          aria-label="Falar com o Darci"
          title="Falar com o Darci"
          style={{
            height: cheio ? 40 : 36, width: cheio ? '100%' : undefined,
            borderRadius: cheio ? 12 : 10, padding: cheio ? '0 12px' : '0 8px', overflow: 'hidden',
            border: `1px solid ${ativa ? C.accent : C.line}`, background: 'transparent',
            color: C.accent, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: cheio ? 'flex-start' : 'center', gap: 9, flexShrink: 0,
          }}
        >
          {/* Traço simples, na cor do app: dentro das barras claras do PicoOS a
              onda de neon parecia pedaço de outro programa. */}
          <OndaDarci ativo={ativa} neon={false} largura={cheio ? 54 : 30} altura={cheio ? 22 : 18} />
          {cheio && (
            <span style={{ fontSize: 13.5, fontWeight: 700, color: ativa ? C.accent : C.muted, letterSpacing: '.01em' }}>
              {ativa ? estado : 'Falar com o Darci'}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
