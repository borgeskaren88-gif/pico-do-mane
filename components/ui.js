'use client';
import { useRef, useLayoutEffect } from 'react';

// Cores por variáveis CSS (definidas em app/globals.css), pra permitir tema
// claro e escuro sem trocar o código dos componentes. Os valores concretos de
// cada tema ficam no globals.css; aqui só apontamos para as variáveis.
export const C = {
  ink: 'var(--c-ink)', panel: 'var(--c-panel)', panel2: 'var(--c-panel2)', raised: 'var(--c-raised)',
  line: 'var(--c-line)', hair: 'var(--c-hair)', accent: 'var(--c-accent)', accent2: 'var(--c-accent2)',
  text: 'var(--c-text)', muted: 'var(--c-muted)', faint: 'var(--c-faint)',
  green: 'var(--c-green)', red: 'var(--c-red)', amber: 'var(--c-amber)',
  redSoft: 'var(--c-red-soft)', barBg: 'var(--c-bar-bg)',
  cardBorder: 'var(--c-card-border)', cardShadow: 'var(--c-card-shadow)',
};

// Fundo da página com profundidade: um brilho azul no topo por cima de um
// leve degradê, dando cara mais moderna que o fundo chapado. As cores vêm das
// variáveis do tema, então o degradê muda junto no claro/escuro.
export const pageBg = 'radial-gradient(1000px 560px at 50% -4%, var(--c-glow-a), var(--c-glow-b) 58%), linear-gradient(180deg, var(--c-bg-top) 0%, var(--c-bg-bottom) 55%)';

// Marca do app: mesma seta de crescimento em degradê azul do ícone da tela
// inicial. `size` em px; `radius` é o arredondamento em px do quadrado.
export function LogoMark({ size = 42, radius = 12 }) {
  const rx = (radius * 100) / size; // converte px -> unidades do viewBox 0..100
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flexShrink: 0, display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id="lm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1652E8" />
          <stop offset="0.55" stopColor="#2C86F5" />
          <stop offset="1" stopColor="#38D2F0" />
        </linearGradient>
        <radialGradient id="lm-gloss" cx="0.28" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" rx={rx} fill="url(#lm-bg)" />
      <rect width="100" height="100" rx={rx} fill="url(#lm-gloss)" />
      <g fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M26 70 L74 30" />
        <path d="M58 30 L74 30 L74 46" />
      </g>
    </svg>
  );
}

export const inputStyle = {
  width: '100%', background: C.panel2, border: `1px solid ${C.line}`, color: C.text,
  borderRadius: 10, padding: '11px 12px', fontSize: 15, outline: 'none', boxSizing: 'border-box',
};

export function Label({ children }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 6, fontWeight: 600 }}>
      {children}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, type = 'text', inputMode, onBlur, list }) {
  return (
    <input type={type} value={value} placeholder={placeholder} inputMode={inputMode} onBlur={onBlur} list={list}
      onChange={(e) => onChange(e.target.value)} style={inputStyle} />
  );
}

// Lista de sugestões pra um input (autocompletar). Usa <datalist> nativo, que
// funciona no iPhone e no PC. Passe um id único e ligue no TextInput via list={id}.
export function Sugestoes({ id, itens = [] }) {
  const unicos = [...new Set(itens.map((s) => String(s || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  return (
    <datalist id={id}>
      {unicos.map((s) => <option key={s} value={s} />)}
    </datalist>
  );
}

export function NumInput({ value, onChange, placeholder }) {
  return (
    <input inputMode="decimal" value={value} placeholder={placeholder || '0,00'}
      onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }} />
  );
}

// Campo de QUANTIDADE. O teclado numérico do celular e do iPad só tem ponto,
// e ponto lá significa "os gramas" — então o campo troca por vírgula na hora,
// pra ela ver 12,992 e não 12.992 (que o sistema leria como doze mil).
export function QtdInput({ value, onChange, placeholder }) {
  const campoRef = useRef(null);
  const paraVirgula = (v) => {
    const s = String(v == null ? '' : v).replace(/\./g, ',');
    const i = s.indexOf(',');
    return i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, '');
  };
  const texto = paraVirgula(value);
  // O teclado numérico do iPhone abre só com os algarismos — sem vírgula e sem
  // ponto. Por isso a vírgula fica aqui do lado, num botão: é o que separa os
  // quilos dos gramas (12,992 = 12 kg e 992 g).
  const porVirgula = () => {
    if (texto.includes(',')) return;
    onChange((texto || '0') + ',');
    try { campoRef.current && campoRef.current.focus(); } catch { /* ignora */ }
  };
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
      <input ref={campoRef} inputMode="decimal" value={texto} placeholder={placeholder || '0'}
        onChange={(e) => onChange(paraVirgula(e.target.value))}
        style={{ ...inputStyle, flex: 1, minWidth: 0, fontVariantNumeric: 'tabular-nums' }} />
      <button type="button" onClick={porVirgula} aria-label="Vírgula (separar os gramas)" title="Vírgula — separa os gramas"
        style={{
          flexShrink: 0, width: 44, borderRadius: 10, cursor: 'pointer',
          border: `1px solid ${texto.includes(',') ? 'var(--c-hair)' : 'var(--c-line)'}`,
          background: 'transparent', color: texto.includes(',') ? 'var(--c-faint)' : 'var(--c-accent)',
          fontSize: 22, fontWeight: 800, lineHeight: 1, paddingBottom: 8,
        }}>,</button>
    </div>
  );
}

export function Select({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
      <option value="">{placeholder || 'Selecione…'}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function Area({ value, onChange, placeholder, rows = 2 }) {
  return (
    <textarea value={value} placeholder={placeholder} rows={rows}
      onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.4 }} />
  );
}

export function Btn({ children, onClick, kind = 'primary', small, type = 'button' }) {
  const styles = {
    primary: { background: C.accent, color: '#06101F', border: 'none' },
    ghost: { background: 'transparent', color: C.text, border: `1px solid ${C.line}` },
    danger: { background: 'transparent', color: C.red, border: `1px solid ${C.redSoft}` },
    ok: { background: C.green, color: '#052014', border: 'none' },
  }[kind];
  return (
    <button type={type} onClick={onClick} style={{
      ...styles, borderRadius: 10, padding: small ? '7px 12px' : '11px 18px',
      fontSize: small ? 13 : 15, fontWeight: 700, cursor: 'pointer',
    }}>{children}</button>
  );
}

export function Card({ children, style }) {
  return <div style={{ background: C.panel, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 18, boxShadow: C.cardShadow, ...style }}>{children}</div>;
}

export function Field({ label, children }) {
  return <div style={{ marginBottom: 14 }}><Label>{label}</Label>{children}</div>;
}

export function Empty({ children }) {
  return <div style={{ textAlign: 'center', color: C.faint, padding: '36px 12px', fontSize: 14, lineHeight: 1.5 }}>{children}</div>;
}

// Ajusta a fonte do valor pra caber na largura da coluna: fica grande (18px)
// quando há espaço (ex.: KPI de 2 colunas) e só encolhe o necessário quando o
// número é longo numa coluna estreita (ex.: 3 colunas), sem cortar com "…".
function useFitFonte(valor) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const MAX = 24, MIN = 12;
    const ajustar = () => {
      el.style.fontSize = MAX + 'px';
      const disp = el.clientWidth;
      if (!disp) return;
      const preciso = el.scrollWidth;
      if (preciso > disp) el.style.fontSize = Math.max(MIN, Math.floor((MAX * disp) / preciso)) + 'px';
    };
    ajustar();
    let ro;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(ajustar); ro.observe(el); }
    return () => { if (ro) ro.disconnect(); };
  }, [valor]);
  return ref;
}

export function KPI({ titulo, valor, cor, sub }) {
  const ref = useFitFonte(valor);
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.cardBorder}`, borderRadius: 14, padding: '13px 15px', minWidth: 0 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: C.faint, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</div>
      <div ref={ref} style={{ fontSize: 24, fontWeight: 800, color: cor || C.text, marginTop: 8, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export function Resumo({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 10, marginBottom: 16 }}>
      {items.map((it, i) => <KPI key={i} titulo={it.t} valor={it.v} cor={it.c} sub={it.s} />)}
    </div>
  );
}

export function SecTitle({ children }) {
  return <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.08em', color: C.muted, fontWeight: 600, margin: '4px 0 10px' }}>{children}</div>;
}

// Título grande no topo de cada aba, pra deixar o app com cara de sistema só.
export function PageTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{children}</div>
      {sub && <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
