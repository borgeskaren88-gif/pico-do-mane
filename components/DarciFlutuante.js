'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { C, inputStyle } from './ui';
import OndaDarci from './OndaDarci';
import { analisarBar, responder, listaNovidades, interpretarComando, faz, lerVisto, marcarVisto, ATALHOS } from '../lib/darci';
import { falarTexto, pararFala, podeOuvir, ReconhecimentoFala, lerSotaque } from '../lib/darciVoz';

// A onda do Darci: encaixa numa barra que já existe (a lateral no computador,
// a barra de cima no celular), em linha com os outros botões. Ao tocar ela NÃO
// abre a tela dele — ele já começa a ouvir e responde ali mesmo, num balão
// grudado no botão. A aba "Darci" continua existindo pra quando a dona quiser a
// tela inteira (voz, tom, jeito de falar, conversa longa).
//
// No iPhone o Safari não tem reconhecimento de fala; nesse caso o balão abre
// com o campo pronto e os atalhos — a resposta vem em voz alta do mesmo jeito.
export default function DarciFlutuante({ onAbrir, onAnotar, ...dados }) {
  const [aberto, setAberto] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [falando, setFalando] = useState(false);
  const [pergunta, setPergunta] = useState('');
  const [ouviu, setOuviu] = useState('');      // o que ela falou
  const [resposta, setResposta] = useState(''); // o que a Darci respondeu
  const [pedido, setPedido] = useState(null);   // ordem entendida, esperando confirmação
  const [aviso, setAviso] = useState('');       // por que ele não conseguiu ouvir
  const [edit, setEdit] = useState({});         // campos da ordem, editáveis antes de gravar
  useEffect(() => { setEdit(pedido ? { ...pedido.dados } : {}); }, [pedido]);
  const podeGravar = !pedido ? false
    : pedido.tipo === 'despesa' ? (Number(edit.valor) > 0 && String(edit.descricao || '').trim().length > 1)
      : pedido.tipo === 'tarefa' ? String(edit.texto || '').trim().length > 1
        : pedido.tipo === 'agenda' ? (String(edit.titulo || '').trim().length > 2 && /^\d{4}-\d{2}-\d{2}$/.test(edit.data || ''))
          : Number(edit.qtd) > 0;
  const [ouvirOk, setOuvirOk] = useState(false); // este aparelho entende voz?
  const [pos, setPos] = useState(null); // onde o balão abre, medido no botão
  const [desdeMs, setDesdeMs] = useState(0); // até onde ela já foi informada

  useEffect(() => { setDesdeMs(lerVisto()); }, []);

  // O que mudou desde a última conversa. É o que faz a onda piscar chamando.
  // As dependências são as listas em si (e não o objeto de props, que nasce novo
  // a cada render) — senão isso recalcularia à toa o tempo todo.
  const novas = useMemo(
    () => (desdeMs ? listaNovidades(dados, desdeMs) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [desdeMs, dados.vendas, dados.estoque, dados.receitas, dados.despesas, dados.compras, dados.tarefas],
  );
  const jaVi = () => { const agora = Date.now(); marcarVisto(agora); setDesdeMs(agora); };
  const sotaqueRef = useRef('manezinho');

  useEffect(() => { setOuvirOk(podeOuvir()); sotaqueRef.current = lerSotaque(); }, []);

  const dadosRef = useRef(dados);
  dadosRef.current = dados;
  const desdeRef = useRef(0);
  desdeRef.current = desdeMs;
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
    setPedido(null);
    // Antes de responder, vê se é uma ORDEM (lançar despesa, baixar estoque,
    // anotar tarefa). Se for, mostra o que entendeu e espera o "confirmar" —
    // nada é gravado sem ela mandar.
    if (onAnotar) {
      const cmd = interpretarComando(q, dadosRef.current);
      if (cmd) { setPedido(cmd); setResposta(''); return; }
    }
    setPensando(true);
    timerRef.current = setTimeout(() => {
      const resp = responder(q, analisarBar({ ...dadosRef.current, desdeMs: desdeRef.current }), sotaqueRef.current);
      setPensando(false);
      setResposta(resp);
      falarTexto(resp, { sotaque: sotaqueRef.current, aoIniciar: () => setFalando(true), aoTerminar: () => setFalando(false) });
    }, 380);
  }, [onAnotar]);

  // Começa a ouvir. Só funciona onde o navegador tem reconhecimento de fala.
  const ouvir = useCallback(() => {
    const Rec = ReconhecimentoFala();
    if (!Rec) {
      // iPhone: o Safari não deixa o site escutar. O microfone do teclado faz o
      // mesmo serviço — melhor dizer isso do que ficar em silêncio.
      setAviso('Neste aparelho eu não consigo escutar direto. Toca no campo aqui embaixo e usa o microfone do teclado — funciona igualzinho.');
      try { campoRef.current?.focus(); } catch { /* ignora */ }
      return;
    }
    pararFala();
    setAviso('');
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
    // Sem isso, quando o microfone é bloqueado ou não entende, ele só ficava
    // quieto — e parecia que não estava ouvindo. Agora ele DIZ o que houve.
    rec.onerror = (e) => {
      setOuvindo(false);
      recRef.current = null;
      const c = (e && e.error) || '';
      setAviso(
        (c === 'not-allowed' || c === 'service-not-allowed')
          ? 'O navegador bloqueou o microfone. Libera o microfone pro PicoOS (no cadeado ao lado do endereço) e tenta de novo. Enquanto isso, escreve aqui embaixo.'
          : c === 'audio-capture' ? 'Não achei microfone neste aparelho. Escreve aqui embaixo que eu respondo igual.'
            : c === 'no-speech' ? 'Não ouvi nada. Fala mais perto do aparelho, ou escreve aqui embaixo.'
              : c === 'network' ? 'Sem internet pra entender a fala agora. Escreve aqui embaixo.'
                : 'Não consegui ouvir agora. Escreve aqui embaixo ou usa o microfone do teclado.',
      );
    };
    rec.onstart = () => setAviso('');
    rec.onend = () => {
      setOuvindo(false);
      recRef.current = null;
      const dito = fala.trim();
      if (dito) responderAgora(dito);
    };
    recRef.current = rec;
    try { rec.start(); setOuvindo(true); setOuviu(''); setResposta(''); setAviso(''); }
    catch { setOuvindo(false); setAviso('Não consegui ligar o microfone. Escreve aqui embaixo que dá no mesmo.'); }
  }, [responderAgora]);

  // Toque na bola: abre o balão e já sai ouvindo (o toque é o gesto que o
  // navegador exige pra liberar microfone e voz). Se ele já estiver falando,
  // só mostra o balão de novo — não corta a resposta no meio.
  const abrir = () => {
    posicionar();
    setAberto(true);
    setAviso('');
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

      <div className="darci-canto" ref={caixaRef}>
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

            {novas.length > 0 && (
              <div style={{ background: C.panel, border: `1px solid ${C.cardBorder}`, borderRadius: 14, padding: '10px 12px', marginBottom: 9 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: C.accent, letterSpacing: '.04em' }}>O QUE MUDOU</span>
                  <span style={{ fontSize: 10.5, color: C.faint }}>desde {faz(desdeMs)}</span>
                </div>
                {novas.slice(0, 4).map((linha, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.45, marginBottom: 3 }}>· {linha}</div>
                ))}
                <div style={{ display: 'flex', gap: 12, marginTop: 7 }}>
                  <button onClick={() => responderAgora('O que mudou?')} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12, fontWeight: 700, padding: 0, cursor: 'pointer' }}>ouvir</button>
                  <button onClick={jaVi} style={{ background: 'none', border: 'none', color: C.faint, fontSize: 12, fontWeight: 700, padding: 0, cursor: 'pointer' }}>já vi</button>
                </div>
              </div>
            )}

            {ouviu && (
              <div style={{ fontSize: 12.5, color: C.muted, fontStyle: 'italic', marginBottom: 8 }}>“{ouviu}”</div>
            )}

            {pensando && (
              <div style={{ padding: '6px 0 10px' }}>
                <span className="darci-pt" /><span className="darci-pt" /><span className="darci-pt" />
              </div>
            )}

            {aviso && (
              <div style={{ background: 'color-mix(in srgb, ' + C.amber + ' 12%, transparent)', border: `1px solid ${C.amber}`, borderRadius: 12, padding: '9px 11px', marginBottom: 9, fontSize: 12.5, color: C.text, lineHeight: 1.45 }}>
                {aviso}
              </div>
            )}

            {/* Ele mostra o que entendeu em campos que dá pra corrigir. Se pescou
                só o valor, ela completa "do que foi" e confirma. */}
            {pedido && (
              <div style={{ background: C.panel, border: `1px solid ${C.accent}`, borderRadius: 14, padding: '11px 12px', marginBottom: 10 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: C.accent, marginBottom: 6 }}>{(pedido.titulo || 'Confirma?').toUpperCase()}</div>
                {pedido.tipo === 'despesa' && (
                  <>
                    <div style={{ display: 'flex', gap: 7, marginBottom: 7 }}>
                      <input value={edit.valor ?? ''} onChange={(e) => setEdit((m) => ({ ...m, valor: e.target.value.replace(',', '.') }))}
                        inputMode="decimal" placeholder="Valor"
                        style={{ ...inputStyle, width: 92, padding: '9px 10px', fontSize: 13 }} />
                      <input value={edit.descricao ?? ''} onChange={(e) => setEdit((m) => ({ ...m, descricao: e.target.value }))}
                        placeholder="Do que foi?" autoFocus={!String(pedido.dados.descricao || '').trim()}
                        style={{ ...inputStyle, flex: 1, minWidth: 0, padding: '9px 10px', fontSize: 13 }} />
                    </div>
                    <div style={{ fontSize: 11.5, color: C.faint }}>Categoria: {edit.categoria || 'A classificar'} · hoje</div>
                  </>
                )}
                {pedido.tipo === 'tarefa' && (
                  <input value={edit.texto ?? ''} onChange={(e) => setEdit((m) => ({ ...m, texto: e.target.value }))}
                    style={{ ...inputStyle, width: '100%', padding: '9px 10px', fontSize: 13 }} />
                )}
                {pedido.tipo === 'agenda' && (
                  <>
                    <input value={edit.titulo ?? ''} onChange={(e) => setEdit((m) => ({ ...m, titulo: e.target.value }))}
                      placeholder="O que é?" style={{ ...inputStyle, width: '100%', padding: '9px 10px', fontSize: 13, marginBottom: 7 }} />
                    <div style={{ display: 'flex', gap: 7 }}>
                      <input type="date" value={edit.data ?? ''} onChange={(e) => setEdit((m) => ({ ...m, data: e.target.value }))}
                        style={{ ...inputStyle, flex: 1, minWidth: 0, padding: '9px 10px', fontSize: 13 }} />
                      <input type="time" value={edit.hora ?? ''} onChange={(e) => setEdit((m) => ({ ...m, hora: e.target.value, diaTodo: !e.target.value }))}
                        style={{ ...inputStyle, width: 110, padding: '9px 10px', fontSize: 13 }} />
                    </div>
                  </>
                )}
                {pedido.tipo === 'perda' && (
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                    <input value={edit.qtd ?? ''} onChange={(e) => setEdit((m) => ({ ...m, qtd: e.target.value.replace(',', '.') }))}
                      inputMode="decimal" style={{ ...inputStyle, width: 92, padding: '9px 10px', fontSize: 13 }} />
                    <span style={{ fontSize: 13, color: C.text }}>{edit.unidade} de <b>{edit.nome}</b> · {String(edit.motivo || '').toLowerCase()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button disabled={!podeGravar} onClick={async () => {
                    if (!podeGravar) return;
                    const feito = await onAnotar({ ...pedido, dados: { ...pedido.dados, ...edit } });
                    setPedido(null);
                    setResposta(feito && feito.ok ? (feito.msg || 'Feito, anotado.') : (feito && feito.erro) || 'Não consegui gravar.');
                  }} style={{ border: 'none', background: podeGravar ? C.accent : C.line, color: podeGravar ? '#06101F' : C.faint, borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 800, cursor: podeGravar ? 'pointer' : 'default' }}>Confirmar</button>
                  <button onClick={() => setPedido(null)} style={{ border: `1px solid ${C.line}`, background: 'transparent', color: C.muted, borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                </div>
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

        {/* Mesmo formato do botão Ocultar, que fica coladinho nele: mesma borda,
            mesmo canto, mesmo recuo. O traço é simples e na cor do app. */}
        <button
          ref={botaoRef}
          onClick={() => { if (!aberto) return abrir(); if (falando || pensando) return esconder(); return ouvirOk ? ouvir() : esconder(); }}
          aria-label="Falar com o Darci"
          title="Falar com o Darci"
          style={{
            flexShrink: 0, background: 'transparent', borderRadius: 10, padding: '7px 12px',
            border: `1px solid ${ativa ? C.accent : C.line}`, color: C.accent, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0,
          }}
        >
          <OndaDarci ativo={ativa} neon={false} largura={30} altura={18} />
          {/* Pontinho: tem coisa nova pra ela saber. */}
          {novas.length > 0 && !aberto && (
            <span style={{ width: 7, height: 7, borderRadius: 999, background: C.amber, marginLeft: 6, flexShrink: 0 }} />
          )}
        </button>
      </div>
    </>
  );
}
