'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { C } from './ui';
import SinoNotificacoes from './SinoNotificacoes';
import { minhaChavePush } from '../lib/pushClient';

// O RÁDIO — o botão redondo no canto de todas as telas da equipe.
//
// "A gente anda com fone; se eu quiser falar com a Sarah, aperto um botão e já
// falo, como se fosse um rádio." Capricha, ela disse. Então:
//
//   - SEGURA, FALA, SOLTA. Sem "gravar", "parar", "enviar": um gesto só, o de
//     rádio. Recado curto demais (toque sem querer) não sai.
//   - QUEM OUVE NÃO TOCA EM NADA: com o PicoOS aberto, o recado toca sozinho
//     no fone, com uma tarja dizendo quem está falando.
//   - TELA APAGADA: chega a notificação "🎙️ Karen"; tocou, abriu e tocou.
//   - O QUE NÃO DEU PRA OUVIR FICA: os recados do dia ficam no painel, com
//     uma bolinha nos que ainda não foram ouvidos.
//
// O que um app de navegador NÃO consegue (e a Karen sabe): tocar sozinho com a
// tela do iPhone apagada. Isso só app de loja.

const OUVIDOS = 'picoos-radio-ouvidos';
const TAXA = 16000;
const lerOuvidos = () => { try { return JSON.parse(localStorage.getItem(OUVIDOS) || '[]'); } catch { return []; } };
const marcarOuvido = (id) => { try { localStorage.setItem(OUVIDOS, JSON.stringify([id, ...lerOuvidos().filter((x) => x !== id)].slice(0, 200))); } catch { /* ignora */ } };
const hora = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const seg = (s) => `${String(Math.round((Number(s) || 0) * 10) / 10).replace('.', ',')} s`;

// Um WAV de silêncio, minúsculo. Tocar ele no primeiro toque da pessoa na
// tela é o que "destrava" o som no iPhone: depois disso, o mesmo tocador pode
// tocar os recados sem pedir licença de novo.
const SILENCIO = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

// --- GRAVAR EM WAV -----------------------------------------------------------
// O microfone entrega o som em pedacinhos, na taxa do aparelho (44 ou 48 mil
// por segundo). No fim, junta, desce pra 16 mil (voz não precisa de mais) e
// escreve o cabeçalho do WAV.
function paraWav(pedacos, taxaOrigem) {
  const total = pedacos.reduce((s, p) => s + p.length, 0);
  const tudo = new Float32Array(total);
  let o = 0;
  for (const p of pedacos) { tudo.set(p, o); o += p.length; }
  const razao = taxaOrigem / TAXA;
  const n = Math.floor(total / razao);
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i += 1) {
    const a = Math.floor(i * razao); const b = Math.min(total, Math.floor((i + 1) * razao));
    let soma = 0; for (let k = a; k < b; k += 1) soma += tudo[k];
    const v = Math.max(-1, Math.min(1, b > a ? soma / (b - a) : 0));
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const d = new DataView(buf);
  const txt = (pos, s) => { for (let i = 0; i < s.length; i += 1) d.setUint8(pos + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); d.setUint32(4, 36 + pcm.length * 2, true); txt(8, 'WAVE');
  txt(12, 'fmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
  d.setUint32(24, TAXA, true); d.setUint32(28, TAXA * 2, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true);
  txt(36, 'data'); d.setUint32(40, pcm.length * 2, true);
  new Int16Array(buf, 44).set(pcm);
  return { bytes: new Uint8Array(buf), segundos: n / TAXA };
}
function base64De(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function urlDoAudio(b64, mime) {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) u[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([u], { type: mime || 'audio/wav' }));
}

export default function Radio() {
  const [aberto, setAberto] = useState(false);
  const [destinos, setDestinos] = useState([['todos', 'Todos']]);
  const [para, setPara] = useState('todos');
  const [recados, setRecados] = useState([]);
  const [maxSeg, setMaxSeg] = useState(20);
  const [ouvidos, setOuvidos] = useState([]);
  const [estado, setEstado] = useState('pronto');   // pronto | abrindo | gravando | mandando
  const [segundos, setSegundos] = useState(0);
  const [msg, setMsg] = useState({ texto: '', tipo: '' });
  const [tocando, setTocando] = useState(null);     // recado que está tocando agora
  const [esperando, setEsperando] = useState(null); // recado que o aparelho não deixou tocar sozinho

  const tocador = useRef(null);
  const fila = useRef([]);
  const ocupado = useRef(false);
  const grav = useRef(null);       // { stream, ctx, src, proc, pedacos, inicio }
  const segurando = useRef(false);
  const relogio = useRef(null);
  const chavePush = useRef('');

  // --- CARREGAR ---
  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/radio', { cache: 'no-store' });
      const j = await r.json();
      if (!j.ok) return;
      setDestinos(j.destinos || [['todos', 'Todos']]);
      setRecados(j.recados || []);
      if (j.maxSegundos) setMaxSeg(j.maxSegundos);
    } catch { /* sem internet: fica o que tinha */ }
  }, []);

  useEffect(() => {
    setOuvidos(lerOuvidos());
    try { const p = localStorage.getItem('picoos-radio-para'); if (p) setPara(p); } catch { /* ignora */ }
    carregar();
    minhaChavePush().then((c) => { chavePush.current = c; });
    const volta = () => { if (document.visibilityState === 'visible') carregar(); };
    document.addEventListener('visibilitychange', volta);
    return () => document.removeEventListener('visibilitychange', volta);
  }, [carregar]);
  useEffect(() => { try { localStorage.setItem('picoos-radio-para', para); } catch { /* ignora */ } }, [para]);
  // Se o destino lembrado não existe mais (acesso fechado), volta pro Todos.
  useEffect(() => { if (!destinos.some(([v]) => v === para)) setPara('todos'); }, [destinos, para]);

  // --- DESTRAVAR O SOM no primeiro toque em qualquer lugar da tela ---
  useEffect(() => {
    tocador.current = new Audio();
    tocador.current.preload = 'auto';
    const destravar = () => {
      const a = tocador.current;
      if (!a || a.dataset.destravado) return;
      a.dataset.destravado = '1';
      if (ocupado.current) return;
      a.src = SILENCIO;
      a.play().then(() => a.pause()).catch(() => { delete a.dataset.destravado; });
    };
    document.addEventListener('pointerdown', destravar, true);
    return () => document.removeEventListener('pointerdown', destravar, true);
  }, []);

  // --- TOCAR ---
  const tocarProximo = useCallback(async () => {
    if (ocupado.current) return;
    const id = fila.current.shift();
    if (!id) return;
    ocupado.current = true;
    try {
      const r = await fetch(`/api/radio?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      const rec = j.recado;
      const a = tocador.current;
      const url = urlDoAudio(rec.audio, rec.mime);
      a.src = url;
      setTocando(rec);
      try {
        await a.play();
      } catch {
        // O aparelho não deixou tocar sozinho (ninguém tocou na tela ainda):
        // a tarja vira um botão "Ouvir".
        setTocando(null);
        setEsperando(rec);
        ocupado.current = false;
        return;
      }
      await new Promise((ok) => { a.onended = ok; a.onerror = ok; a.onpause = () => { if (a.ended || a.dataset.parou) ok(); }; });
      delete a.dataset.parou;
      URL.revokeObjectURL(url);
      marcarOuvido(rec.id); setOuvidos(lerOuvidos());
      // Ouviu no app: a notificação do mesmo recado não precisa ficar lá.
      // SEM esperar: num aparelho sem o service worker pronto, esperar por ele
      // travava a fila e o rádio nunca mais tocava nada.
      try {
        navigator.serviceWorker?.getRegistration()
          .then((reg) => reg && reg.getNotifications({ tag: 'radio-' + rec.id }))
          .then((ns) => (ns || []).forEach((n) => n.close()))
          .catch(() => {});
      } catch { /* ignora */ }
    } catch { /* recado sumiu ou sem internet: segue a fila */ }
    setTocando(null);
    ocupado.current = false;
    if (fila.current.length) tocarProximo();
  }, []);

  const ouvir = useCallback((id) => {
    if (!id || fila.current.includes(id)) return;
    fila.current.push(id);
    setEsperando(null);
    tocarProximo();
  }, [tocarProximo]);

  const parar = () => {
    const a = tocador.current;
    if (a) { a.dataset.parou = '1'; a.pause(); }
  };

  // --- CHEGOU RECADO: pelo service worker (push) ou pela própria página ---
  useEffect(() => {
    const doSW = (e) => { if (e.data && e.data.tipo === 'radio' && e.data.id) { ouvir(e.data.id); carregar(); } };
    const daPagina = (e) => { if (e.detail && e.detail.id) { ouvir(e.detail.id); carregar(); } };
    try { navigator.serviceWorker?.addEventListener('message', doSW); } catch { /* sem service worker */ }
    window.addEventListener('picoos-radio', daPagina);
    // Abriu pelo toque na notificação: /?radio=<id>.
    try {
      const u = new URL(window.location.href);
      const id = u.searchParams.get('radio');
      if (id) {
        u.searchParams.delete('radio');
        window.history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
        ouvir(id);
      }
    } catch { /* ignora */ }
    return () => {
      try { navigator.serviceWorker?.removeEventListener('message', doSW); } catch { /* ignora */ }
      window.removeEventListener('picoos-radio', daPagina);
    };
  }, [ouvir, carregar]);

  // --- FALAR ---
  const soltarMicrofone = () => {
    const g = grav.current;
    grav.current = null;
    if (!g) return;
    try { g.proc.disconnect(); g.src.disconnect(); } catch { /* ignora */ }
    try { g.stream.getTracks().forEach((t) => t.stop()); } catch { /* ignora */ }
    try { g.ctx.close(); } catch { /* ignora */ }
  };

  const comecar = async () => {
    if (estado !== 'pronto') return;
    segurando.current = true;
    setMsg({ texto: '', tipo: '' });
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMsg({ texto: 'Este aparelho não deixa o app usar o microfone.', tipo: 'erro' });
      return;
    }
    setEstado('abrindo');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === 'suspended') await ctx.resume();
      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const pedacos = [];
      proc.onaudioprocess = (e) => { pedacos.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      src.connect(proc); proc.connect(ctx.destination);
      grav.current = { stream, ctx, src, proc, pedacos, inicio: Date.now() };
      // Soltou antes do microfone abrir (o primeiro uso pede licença): não grava nada.
      if (!segurando.current) {
        soltarMicrofone(); setEstado('pronto');
        setMsg({ texto: 'Microfone liberado. Agora segura o botão enquanto fala.', tipo: 'ok' });
        return;
      }
      try { navigator.vibrate && navigator.vibrate(25); } catch { /* ignora */ }
      setEstado('gravando'); setSegundos(0);
      relogio.current = setInterval(() => {
        const s = (Date.now() - (grav.current?.inicio || Date.now())) / 1000;
        setSegundos(s);
        if (s >= maxSeg) terminar();   // eslint-disable-line no-use-before-define
      }, 200);
    } catch {
      soltarMicrofone(); setEstado('pronto');
      setMsg({ texto: 'Não consegui abrir o microfone. Confere se o app tem permissão de usar o microfone.', tipo: 'erro' });
    }
  };

  const terminar = async () => {
    segurando.current = false;
    if (relogio.current) { clearInterval(relogio.current); relogio.current = null; }
    const g = grav.current;
    if (!g) return;
    const taxa = g.ctx.sampleRate;
    const pedacos = g.pedacos.slice();
    soltarMicrofone();
    const { bytes, segundos: dur } = paraWav(pedacos, taxa);
    if (dur < 0.4) {
      setEstado('pronto');
      setMsg({ texto: 'Foi rapidinho demais. Segura o botão enquanto fala.', tipo: 'erro' });
      return;
    }
    setEstado('mandando');
    try {
      const r = await fetch('/api/radio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ para, audio: base64De(bytes), segundos: dur, excluir: chavePush.current }),
      });
      const j = await r.json();
      if (!j.ok) { setMsg({ texto: j.erro || 'Não consegui mandar.', tipo: 'erro' }); return; }
      marcarOuvido(j.id); setOuvidos(lerOuvidos());
      setMsg({
        texto: j.enviados > 0
          ? `Mandado pra ${j.paraNome} ✓`
          : `Guardado pra ${j.paraNome} ✓ — mas nenhum celular de lá está com os avisos ligados. Ouvem quando abrirem o rádio.`,
        tipo: j.enviados > 0 ? 'ok' : 'aviso',
      });
      carregar();
    } catch {
      setMsg({ texto: 'Sem internet: o recado não saiu. Tenta de novo.', tipo: 'erro' });
    } finally { setEstado('pronto'); }
  };

  // Soltar o dedo fora do botão também manda (dedo escorrega no balcão).
  useEffect(() => {
    if (estado !== 'gravando' && estado !== 'abrindo') return undefined;
    const fim = () => { if (segurando.current || grav.current) terminar(); };
    window.addEventListener('pointerup', fim);
    window.addEventListener('pointercancel', fim);
    return () => { window.removeEventListener('pointerup', fim); window.removeEventListener('pointercancel', fim); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // No computador: segurar a barra de espaço com o painel aberto.
  useEffect(() => {
    if (!aberto) return undefined;
    const desce = (e) => { if (e.code === 'Space' && !e.repeat && !/input|textarea|select/i.test(e.target.tagName)) { e.preventDefault(); comecar(); } };
    const sobe = (e) => { if (e.code === 'Space') { e.preventDefault(); terminar(); } };
    window.addEventListener('keydown', desce); window.addEventListener('keyup', sobe);
    return () => { window.removeEventListener('keydown', desce); window.removeEventListener('keyup', sobe); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // Fechou o painel: solta o microfone (a bolinha laranja do iPhone apaga).
  useEffect(() => { if (!aberto && grav.current) { soltarMicrofone(); setEstado('pronto'); } }, [aberto]);

  const naoOuvidos = recados.filter((r) => !ouvidos.includes(r.id)).length;
  const gravando = estado === 'gravando';
  const corBotao = gravando ? C.red : estado === 'mandando' || estado === 'abrindo' ? C.muted : C.accent;
  const nomePara = (destinos.find(([v]) => v === para) || [])[1] || 'Todos';

  return (
    <>
      <style>{`
        @keyframes radio-pulsa { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, ${C.red} 55%, transparent); } 100% { box-shadow: 0 0 0 26px transparent; } }
        @keyframes radio-onda { 0%,100% { transform: scaleY(.35); } 50% { transform: scaleY(1); } }
        @keyframes radio-sobe { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        .radio-onda span { display:inline-block; width:3px; height:14px; margin:0 1px; border-radius:2px; background:currentColor; animation: radio-onda .9s ease-in-out infinite; }
        .radio-onda span:nth-child(2){animation-delay:.15s}.radio-onda span:nth-child(3){animation-delay:.3s}.radio-onda span:nth-child(4){animation-delay:.45s}
      `}</style>

      {/* A TARJA DE QUEM ESTÁ FALANDO — em cima de tudo, em qualquer tela. */}
      {(tocando || esperando) && (
        <div data-radio-tarja style={{
          position: 'fixed', zIndex: 95, left: '50%', transform: 'translateX(-50%)', top: 'calc(10px + env(safe-area-inset-top))',
          width: 'min(92vw, 420px)', background: C.ink, border: `2px solid ${C.accent}`, borderRadius: 16, padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 12px 34px rgba(0,0,0,.45)', color: C.text,
        }}>
          {tocando ? (
            <>
              <span className="radio-onda" style={{ color: C.accent, flexShrink: 0 }}><span /><span /><span /><span /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 900 }}>{tocando.deNome} falando</div>
                <div style={{ fontSize: 11.5, color: C.muted }}>{tocando.para === 'todos' ? 'pra todos' : `pra ${tocando.paraNome}`} · {seg(tocando.segundos)}</div>
              </div>
              <button onClick={parar} style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '6px 10px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>Parar</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 20 }}>🎙️</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 900 }}>Recado de {esperando.deNome}</div>
                <div style={{ fontSize: 11.5, color: C.muted }}>{seg(esperando.segundos)}</div>
              </div>
              <button data-radio-ouvir onClick={() => ouvir(esperando.id)} style={{ background: C.accent, border: 'none', color: '#06101F', borderRadius: 10, padding: '8px 14px', fontSize: 13.5, fontWeight: 900, cursor: 'pointer' }}>Ouvir</button>
              <button onClick={() => setEsperando(null)} aria-label="Depois" style={{ background: 'none', border: 'none', color: C.faint, fontSize: 20, cursor: 'pointer', padding: '0 2px' }}>×</button>
            </>
          )}
        </div>
      )}

      {/* O BOTÃO DO CANTO. */}
      {!aberto && (
        <button data-radio-botao onClick={() => { setAberto(true); carregar(); }} aria-label="Rádio" title="Rádio" style={{
          position: 'fixed', zIndex: 60, right: 'calc(16px + env(safe-area-inset-right))', bottom: 'calc(18px + env(safe-area-inset-bottom))',
          width: 54, height: 54, borderRadius: 999, border: 'none', cursor: 'pointer', background: C.accent, color: '#06101F',
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(0,0,0,.35)',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
          </svg>
          {naoOuvidos > 0 && (
            <span data-radio-novos style={{ position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, borderRadius: 999, background: C.red, color: '#fff', fontSize: 11.5, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', border: `2px solid ${C.ink}` }}>{naoOuvidos}</span>
          )}
        </button>
      )}

      {/* O PAINEL. */}
      {aberto && (
        <>
          <div onClick={() => setAberto(false)} style={{ position: 'fixed', inset: 0, zIndex: 88, background: 'rgba(4,9,18,.5)' }} />
          <div data-radio-painel role="dialog" aria-label="Rádio" style={{
            // Centrado com margem automática, e não com "transform": a animação
            // de subir mexe no transform e jogava o painel pra fora da tela.
            position: 'fixed', zIndex: 89, left: 0, right: 0, marginLeft: 'auto', marginRight: 'auto', bottom: 0, width: 'min(100vw, 480px)',
            maxHeight: '88vh', overflowY: 'auto', background: C.ink, borderTop: `1px solid ${C.line}`, borderRadius: '22px 22px 0 0',
            padding: '14px 18px calc(20px + env(safe-area-inset-bottom))', color: C.text, animation: 'radio-sobe .2s ease both',
            boxShadow: '0 -18px 44px rgba(0,0,0,.4)', boxSizing: 'border-box',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>📻 Rádio</div>
              <button onClick={() => setAberto(false)} aria-label="Fechar" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.muted, fontSize: 26, lineHeight: 1, cursor: 'pointer', padding: '0 4px' }}>×</button>
            </div>

            <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Falar com</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
              {destinos.map(([v, rot]) => (
                <button key={v} data-radio-para={v} onClick={() => setPara(v)} disabled={gravando} style={{
                  border: `1px solid ${para === v ? C.accent : C.line}`, background: para === v ? C.accent : 'transparent',
                  color: para === v ? '#06101F' : C.text, borderRadius: 999, padding: '8px 14px', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                }}>{rot}</button>
              ))}
            </div>

            {/* SEGURA PRA FALAR. */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <button data-radio-falar
                onPointerDown={(e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignora */ } comecar(); }}
                onContextMenu={(e) => e.preventDefault()}
                disabled={estado === 'mandando'}
                aria-label={`Segura pra falar com ${nomePara}`}
                style={{
                  width: 150, height: 150, borderRadius: 999, border: 'none', cursor: 'pointer', background: corBotao, color: '#06101F',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                  touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
                  animation: gravando ? 'radio-pulsa 1.1s ease-out infinite' : 'none', transition: 'background .15s, transform .1s',
                  transform: gravando ? 'scale(1.06)' : 'none',
                }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
                </svg>
                <span style={{ fontSize: 13.5, fontWeight: 900, lineHeight: 1.15, textAlign: 'center', padding: '0 10px' }}>
                  {gravando ? `Solta pra mandar · ${Math.floor(segundos)} s` : estado === 'abrindo' ? 'Abrindo o microfone…' : estado === 'mandando' ? 'Mandando…' : 'Segura pra falar'}
                </span>
              </button>
              <div style={{ fontSize: 12.5, color: gravando ? C.red : C.muted, fontWeight: 700, textAlign: 'center', minHeight: 18 }}>
                {gravando ? `Falando com ${nomePara} · até ${maxSeg} s` : `Pra ${nomePara}. Segura, fala e solta.`}
              </div>
              {msg.texto && (
                <div data-radio-msg={msg.tipo} style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', lineHeight: 1.4, color: msg.tipo === 'erro' ? C.red : msg.tipo === 'aviso' ? C.amber : C.green }}>{msg.texto}</div>
              )}
            </div>

            <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', margin: '6px 0 6px' }}>Recados de hoje</div>
            {recados.length === 0 ? (
              <div style={{ fontSize: 13, color: C.faint, padding: '4px 0 10px' }}>Nenhum recado ainda.</div>
            ) : recados.map((r) => {
              const novo = !ouvidos.includes(r.id);
              return (
                <div key={r.id} data-radio-recado={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${C.hair}` }}>
                  <button onClick={() => ouvir(r.id)} aria-label={`Ouvir recado de ${r.deNome}`} style={{
                    width: 36, height: 36, borderRadius: 999, border: `1px solid ${novo ? C.accent : C.line}`, background: novo ? C.accent : 'transparent',
                    color: novo ? '#06101F' : C.text, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: novo ? 900 : 700 }}>{r.deNome} <span style={{ color: C.faint, fontWeight: 600 }}>→ {r.para === 'todos' ? 'Todos' : r.paraNome}</span></div>
                    <div style={{ fontSize: 11.5, color: C.faint }}>{hora(r.ts)} · {seg(r.segundos)}{novo ? ' · novo' : ''}</div>
                  </div>
                </div>
              );
            })}

            <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.5, margin: '12px 0 10px' }}>
              Com o PicoOS aberto, os recados tocam sozinhos no fone. Com a tela apagada, chega uma notificação — toca nela pra ouvir.
            </div>
            <SinoNotificacoes titulo="Ouvir com a tela apagada" descricao="Liga os avisos neste celular: o recado chega como notificação." />
          </div>
        </>
      )}
    </>
  );
}
