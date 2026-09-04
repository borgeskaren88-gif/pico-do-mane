'use client';
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { C, Card, Btn, inputStyle } from './ui';
import MicBtn from './MicBtn';
import OrbDarci from './OrbDarci';
import { analisarBar, responder, ATALHOS } from '../lib/darci';
import { temVoz, ehPt, ehMelhor, listarVozes, vozPadrao, lerTom, salvarTom, salvarVoz, lerNome, salvarNome, NOME_PADRAO, falarTexto, pararFala } from '../lib/darciVoz';

// Tela cheia do Darci: a esfera grande, a conversa e os ajustes de voz.
// O cérebro (os números e as respostas) mora em lib/darci.js, e a voz em
// lib/darciVoz.js — os mesmos que o balão flutuante usa.
export default function Darci(dados) {
  const [pergunta, setPergunta] = useState('');
  const [conversa, setConversa] = useState([]); // { de:'karen'|'darci', texto }
  const [falando, setFalando] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [vozOk, setVozOk] = useState(false);
  const [vozes, setVozes] = useState([]);
  const [vozId, setVozId] = useState('');
  const [tom, setTom] = useState(0.7);
  const [nome, setNome] = useState(NOME_PADRAO); // como ele fala o nome dela
  const [verTodas, setVerTodas] = useState(false); // vozes de outros idiomas
  const fimRef = useRef(null);
  const timerRef = useRef(null);

  const n = useMemo(() => analisarBar(dados), [dados]);

  const carregarVozes = useCallback(() => {
    const lista = listarVozes();
    if (!lista.length) return;
    setVozes(lista);
    setVozId((atual) => (atual && lista.some((v) => v.voiceURI === atual) ? atual : vozPadrao(lista)));
  }, []);

  useEffect(() => {
    const ok = temVoz();
    setVozOk(ok);
    setTom(lerTom());
    setNome(lerNome());
    if (!ok) return;
    carregarVozes();
    window.speechSynthesis.addEventListener?.('voiceschanged', carregarVozes);
    return () => {
      pararFala();
      window.speechSynthesis.removeEventListener?.('voiceschanged', carregarVozes);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [carregarVozes]);

  useEffect(() => { try { fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch { /* ignora */ } }, [conversa]);

  const falar = useCallback((texto) => {
    falarTexto(texto, {
      vozId, tom, nome,
      aoIniciar: () => setFalando(true),
      aoTerminar: () => { setFalando(false); carregarVozes(); },
    });
  }, [vozId, tom, nome, carregarVozes]);

  const trocarVoz = (id) => { setVozId(id); salvarVoz(id); };
  const trocarTom = (v) => { setTom(v); salvarTom(v); };
  const trocarNome = (v) => { setNome(v); salvarNome(v); };

  const enviar = (texto) => {
    const q = String(texto || '').trim();
    if (!q || pensando) return;
    setConversa((c) => [...c, { de: 'karen', texto: q }]);
    setPergunta('');
    setPensando(true);
    timerRef.current = setTimeout(() => {
      const resp = responder(q, n);
      setPensando(false);
      setConversa((c) => [...c, { de: 'darci', texto: resp }]);
      falar(resp);
    }, 520);
  };

  const ativa = falando || pensando;
  const vozesPt = vozes.filter(ehPt);
  const vozesOutras = vozes.filter((v) => !ehPt(v));
  const semPt = vozesPt.length === 0;
  // Nomes repetidos (o iPhone lista a mesma voz em versão simples e melhorada):
  // numera pra dar pra testar cada uma.
  const rotuloVoz = (v) => {
    const iguais = vozes.filter((x) => x.name === v.name);
    const base = iguais.length < 2 ? v.name : `${v.name} ${iguais.indexOf(v) + 1}`;
    return ehMelhor(v) ? `${base} (melhorada)` : base;
  };

  return (
    <div>
      <style>{`
        @keyframes darci-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .darci-bolha { animation: darci-fade .25s ease both; }
        .darci-pt { display:inline-block; width:5px; height:5px; border-radius:999px; background:${C.accent}; margin-right:4px; animation: darci-blink 1s infinite; }
        .darci-pt:nth-child(2){ animation-delay:.15s } .darci-pt:nth-child(3){ animation-delay:.3s }
        @keyframes darci-blink { 0%,100%{opacity:.25} 50%{opacity:1} }
      `}</style>

      <div style={{ textAlign: 'center', paddingTop: 6, marginBottom: 6 }}>
        <OrbDarci ativo={ativa} tamanho={200} />
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '.06em', color: C.text, marginTop: -6 }}>DARCI</div>
        <div style={{ fontSize: 11.5, color: C.accent, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, marginTop: 3 }}>
          {pensando ? 'processando…' : falando ? 'falando' : 'sócio · manezinho da ilha'}
        </div>
        {!vozOk && <div style={{ fontSize: 12, color: C.amber, marginTop: 8 }}>Neste aparelho a voz não funciona — ele responde escrito.</div>}

        {vozOk && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, color: C.faint, fontWeight: 700 }}>Voz</span>
              <select value={vozId} onChange={(e) => trocarVoz(e.target.value)}
                style={{ ...inputStyle, width: 'auto', maxWidth: 220, padding: '7px 10px', fontSize: 12.5 }}>
                {!vozes.length && <option value="">(nenhuma encontrada)</option>}
                {vozesPt.length > 0 && (
                  <optgroup label="Português">
                    {vozesPt.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{rotuloVoz(v)}</option>)}
                  </optgroup>
                )}
                {(verTodas || semPt) && vozesOutras.length > 0 && (
                  <optgroup label="Outros idiomas">
                    {vozesOutras.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{rotuloVoz(v)} ({v.lang})</option>)}
                  </optgroup>
                )}
              </select>
              <button onClick={() => falar('Ó, Karen. Sou o Darci, teu sócio aqui do Pico.')}
                style={{ background: 'none', border: `1px solid ${C.line}`, color: C.accent, borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>testar</button>
            </div>

            {/* Tom da voz: o iPhone não libera voz masculina pra apps, então
                abaixar o tom é o que deixa o Darci com voz de homem. */}
            <div style={{ maxWidth: 320, margin: '12px auto 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.faint, fontWeight: 700, marginBottom: 4 }}>
                <span>Tom da voz</span><span>{tom <= 0.72 ? 'grave' : tom >= 0.95 ? 'agudo' : 'médio'}</span>
              </div>
              <input type="range" min="0.5" max="1.2" step="0.02" value={tom}
                onChange={(e) => trocarTom(parseFloat(e.target.value))}
                onMouseUp={() => falar('Ó, Karen. Assim tá bom?')}
                onTouchEnd={() => falar('Ó, Karen. Assim tá bom?')}
                style={{ width: '100%', accentColor: C.accent }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: C.faint }}>
                <span>mais grave</span><span>mais fino</span>
              </div>
            </div>

            {/* A voz brasileira lê "Karen" como "Kerên". Escrevendo com acento
                ela acerta — e aqui a dona ajusta até ficar do jeito dela. */}
            <div style={{ maxWidth: 320, margin: '14px auto 0', textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: C.faint, fontWeight: 700, marginBottom: 4 }}>Como ele fala teu nome</div>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                <input value={nome} onChange={(e) => trocarNome(e.target.value)}
                  placeholder={NOME_PADRAO}
                  style={{ ...inputStyle, flex: 1, minWidth: 0, padding: '9px 11px', fontSize: 13.5 }} />
                <button onClick={() => falar('Ó, Karen. Falei teu nome certo agora?')}
                  style={{ background: 'none', border: `1px solid ${C.line}`, color: C.accent, borderRadius: 999, padding: '8px 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>ouvir</button>
              </div>
              <div style={{ fontSize: 10.5, color: C.faint, marginTop: 5, lineHeight: 1.45 }}>
                Escreve do jeito que soa: <b>Káren</b>, <b>Kárem</b>, <b>Cáren</b>… toca em “ouvir” até acertar.
              </div>
            </div>

            <div style={{ fontSize: 11, color: C.faint, marginTop: 8, lineHeight: 1.45, maxWidth: 380, margin: '8px auto 0' }}>
              O iPhone não libera pra apps as vozes que você baixa em Acessibilidade (nem as da Siri) — só estas. Por isso o tom é regulável aqui.
              {' '}<b>Quer voz melhor?</b> No notebook, abre o PicoOS no <b>Microsoft Edge</b>: lá aparecem as vozes “Natural” da Microsoft (a masculina é a <b>Antônio</b>), que falam português bem mais claro. Aqui na lista elas vêm marcadas como <i>melhorada</i>.
              {vozesOutras.length > 0 && !semPt && (
                <>{' '}<button onClick={() => setVerTodas((v) => !v)}
                  style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: 0 }}>
                  {verTodas ? 'esconder outros idiomas' : 'ver outros idiomas'}
                </button></>
              )}
            </div>
          </div>
        )}
      </div>

      {conversa.length === 0 ? (
        <Card style={{ margin: '16px 0 14px', borderColor: C.accent }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 6 }}>Bora começar pelo briefing</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 12 }}>
            Toca aí embaixo que eu te conto em voz alta como está o bar: ontem, o mês, o fiado, o estoque e o que tu tem que fazer primeiro.
          </div>
          <Btn onClick={() => enviar('Briefing do dia')}>Ouvir o briefing do dia</Btn>
        </Card>
      ) : (
        <div style={{ margin: '16px 0 14px' }}>
          {conversa.map((m, i) => (
            <div key={i} className="darci-bolha" style={{ display: 'flex', justifyContent: m.de === 'karen' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <div style={{
                maxWidth: '88%', borderRadius: 16, padding: '11px 14px', fontSize: 14, lineHeight: 1.5,
                background: m.de === 'karen' ? C.accent : C.panel,
                color: m.de === 'karen' ? '#06101F' : C.text,
                border: m.de === 'karen' ? 'none' : `1px solid ${C.cardBorder}`,
                fontWeight: m.de === 'karen' ? 700 : 400,
              }}>
                {m.de === 'darci' && <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.10em', color: C.accent, marginBottom: 5 }}>DARCI</div>}
                {m.texto}
                {m.de === 'darci' && vozOk && (
                  <button onClick={() => falar(m.texto)} style={{ display: 'block', marginTop: 8, background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>ouvir de novo</button>
                )}
              </div>
            </div>
          ))}
          {pensando && (
            <div className="darci-bolha" style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ borderRadius: 16, padding: '12px 16px', background: C.panel, border: `1px solid ${C.cardBorder}` }}>
                <span className="darci-pt" /><span className="darci-pt" /><span className="darci-pt" />
              </div>
            </div>
          )}
          <div ref={fimRef} />
        </div>
      )}

      {falando && (
        <div style={{ marginBottom: 10 }}>
          <Btn kind="danger" small onClick={() => { pararFala(); setFalando(false); }}>Parar de falar</Btn>
        </div>
      )}

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') enviar(pergunta); }}
            placeholder="Pergunta pro Darci… (ou usa o microfone do teclado)"
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          />
          <MicBtn value={pergunta} onChange={setPergunta} />
          <Btn onClick={() => enviar(pergunta)}>Perguntar</Btn>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
          {ATALHOS.map((a) => (
            <button key={a} onClick={() => enviar(a)} style={{
              border: `1px solid ${C.line}`, background: 'transparent', color: C.muted, borderRadius: 999,
              padding: '7px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>{a}</button>
          ))}
        </div>
      </Card>

      <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.5 }}>
        O Darci só fala do que está registrado no PicoOS. Se um número parecer estranho, provavelmente falta lançar alguma coisa.
      </div>
    </div>
  );
}
