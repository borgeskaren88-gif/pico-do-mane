'use client';
import { useId } from 'react';

// Cores por variáveis CSS (definidas em app/globals.css), pra permitir tema
// claro e escuro sem trocar o código dos componentes. Os valores concretos de
// cada tema ficam no globals.css; aqui só apontamos para as variáveis.
export const C = {
  ink: 'var(--c-ink)', panel: 'var(--c-panel)', panel2: 'var(--c-panel2)', raised: 'var(--c-raised)',
  line: 'var(--c-line)', hair: 'var(--c-hair)', accent: 'var(--c-accent)', accent2: 'var(--c-accent2)',
  onAccent: 'var(--c-on-accent)',
  text: 'var(--c-text)', muted: 'var(--c-muted)', faint: 'var(--c-faint)',
  green: 'var(--c-green)', red: 'var(--c-red)', amber: 'var(--c-amber)',
  redSoft: 'var(--c-red-soft)', barBg: 'var(--c-bar-bg)',
  cardBorder: 'var(--c-card-border)', cardShadow: 'var(--c-card-shadow)',
  glassBg: 'var(--c-glass-bg)', glassBorder: 'var(--c-glass-border)', glassShadow: 'var(--c-glass-shadow)',
};

// Fundo da página com profundidade: um brilho azul no topo por cima de um
// leve degradê, dando cara mais moderna que o fundo chapado. As cores vêm das
// variáveis do tema, então o degradê muda junto no claro/escuro.
export const pageBg = 'radial-gradient(135% 115% at 12% 6%, var(--c-glow-a), var(--c-glow-b) 55%), linear-gradient(152deg, var(--c-bg-top) 0%, var(--c-bg-bottom) 100%)';

// Marca do app: coração "dobrado" (dois planos com vinco no meio, dando um ar
// 3D moderno) em degradê café/caramelo, com um coração-eco desfocado atrás,
// sobre um quadrado creme. `size` em px; `radius` é o arredondamento em px.
const H_FULL = 'M50 82 C 42 72, 22 60, 16 43 C 12 31, 21 22, 32 24 C 40 25.5, 46 31, 50 38 C 54 31, 60 25.5, 68 24 C 79 22, 88 31, 84 43 C 78 60, 58 72, 50 82 Z';
const H_LEFT = 'M50 38 C 46 31, 40 25.5, 32 24 C 21 22, 12 31, 16 43 C 22 60, 42 72, 50 82 Z';
const H_RIGHT = 'M50 38 C 54 31, 60 25.5, 68 24 C 79 22, 88 31, 84 43 C 78 60, 58 72, 50 82 Z';
export function LogoMark({ size = 42, radius = 12 }) {
  const rx = (radius * 100) / size; // converte px -> unidades do viewBox 0..100
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flexShrink: 0, display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id="lm-tile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FDF8F0" />
          <stop offset="1" stopColor="#EADFCC" />
        </linearGradient>
        <linearGradient id="lm-left" x1="0.1" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#D9B481" />
          <stop offset="1" stopColor="#EBD1A2" />
        </linearGradient>
        <linearGradient id="lm-right" x1="0.4" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7E5433" />
          <stop offset="1" stopColor="#B0855A" />
        </linearGradient>
        <linearGradient id="lm-sheen" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.42" />
          <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.05" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <filter id="lm-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect width="100" height="100" rx={rx} fill="url(#lm-tile)" />
      {/* coração-eco desfocado atrás (glow moderno) */}
      <g transform="translate(50,50) scale(1.14) translate(-50,-52)">
        <path d={H_FULL} fill="#CBA476" opacity="0.32" filter="url(#lm-glow)" />
      </g>
      {/* coração dobrado: plano claro à esquerda, escuro à direita, brilho por cima */}
      <path d={H_LEFT} fill="url(#lm-left)" />
      <path d={H_RIGHT} fill="url(#lm-right)" />
      <path d={H_FULL} fill="url(#lm-sheen)" />
    </svg>
  );
}

// Ícones "duotone" (sem emoji): uma forminha preenchida bem clarinha por baixo
// + o contorno fino por cima. Tudo herda a cor via currentColor, então o ícone
// acompanha a cor do lugar (aba ativa, chip colorido, tema claro/escuro).
export function Icone({ name, size = 20, stroke = 1.75 }) {
  const base = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true, style: { display: 'block', flexShrink: 0 } };
  const L = { fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const F = { fill: 'currentColor', fillOpacity: 0.2, stroke: 'none' };
  switch (name) {
    case 'wallet':
      return (<svg {...base}><rect x="4" y="6" width="17" height="13" rx="3" {...F} /><g {...L}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></g></svg>);
    case 'flame':
      return (<svg {...base}><path d="M12 3c1 3.5 5 4.5 5 8.5a5 5 0 0 1-10 0c0-1.3.5-2.3 1.3-3.2C9.5 9 10.3 7 9.8 5 11 5.6 11.5 4.3 12 3z" {...F} /><path {...L} d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>);
    case 'cart':
      return (<svg {...base}><path d="M5.5 8h13l-.8 11a2 2 0 0 1-2 1.9H8.3a2 2 0 0 1-2-1.9z" {...F} /><g {...L}><path d="M5.5 8h13l-.8 11a2 2 0 0 1-2 1.9H8.3a2 2 0 0 1-2-1.9z" /><path d="M9 9V6.5a3 3 0 0 1 6 0V9" /></g></svg>);
    case 'check':
      return (<svg {...base}><path {...L} d="M20 6 9 17l-5-5" /></svg>);
    case 'sun':
      return (<svg {...base}><circle cx="12" cy="12" r="4.2" {...F} /><g {...L}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></g></svg>);
    case 'moon':
      return (<svg {...base}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" {...F} /><path {...L} d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>);
    case 'book':
      return (<svg {...base}><path d="M6 3h13v14H6.5A2.5 2.5 0 0 0 4 19.5V5.5A2.5 2.5 0 0 1 6.5 3z" {...F} /><g {...L}><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5V4.5Z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20" /><path d="M9 7h7M9 11h5" /></g></svg>);
    case 'lock':
      return (<svg {...base}><rect x="4" y="11" width="16" height="10" rx="2" {...F} /><g {...L}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></g></svg>);
    case 'pencil':
      return (<svg {...base}><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" {...F} /><g {...L}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></g></svg>);
    case 'bell':
      return (<svg {...base}><path d="M6 9a6 6 0 0 1 12 0c0 5 2.5 7 2.5 7H3.5S6 14 6 9z" {...F} /><g {...L}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></g></svg>);
    case 'star':
      return (<svg {...base}><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L4.5 9.2l5.9-.9z" fill="currentColor" fillOpacity="0.28" stroke="none" /><path {...L} d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L4.5 9.2l5.9-.9z" /></svg>);
    case 'tasks':
      return (<svg {...base}><g {...F}><rect x="11" y="5.4" width="9" height="3.2" rx="1.6" /><rect x="11" y="15.4" width="9" height="3.2" rx="1.6" /></g><g {...L}><path d="M4 7l1.7 1.7L9 5" /><path d="M12 7h8" /><path d="M4 17l1.7 1.7L9 15" /><path d="M12 17h8" /></g></svg>);
    case 'plus':
      return (<svg {...base}><path {...L} d="M12 5v14M5 12h14" /></svg>);
    case 'clock':
      return (<svg {...base}><circle cx="12" cy="12" r="9" {...F} /><g {...L}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></g></svg>);
    case 'home':
      return (<svg {...base}><path d="M5 10 12 4.2 19 10v10.3h-4v-6H9v6H5z" {...F} /><g {...L}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></g></svg>);
    case 'calendar':
      return (<svg {...base}><rect x="3" y="4.5" width="18" height="16" rx="2.5" {...F} /><g {...L}><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></g></svg>);
    case 'chevron':
      return (<svg {...base}><path {...L} d="M9 6l6 6-6 6" /></svg>);
    default:
      return null;
  }
}

// Glifos (contorno 24x24) usados nos ícones 3D. Reaproveitam os desenhos.
const GLYPHS3D = {
  wallet: <><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></>,
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  cart: <><path d="M5.5 8h13l-.8 11a2 2 0 0 1-2 1.9H8.3a2 2 0 0 1-2-1.9z" /><path d="M9 9V6.5a3 3 0 0 1 6 0V9" /></>,
  tasks: <><path d="M4 7l1.7 1.7L9 5" /><path d="M12 7h8" /><path d="M4 17l1.7 1.7L9 15" /><path d="M12 17h8" /></>,
  book: <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5V4.5Z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20" /><path d="M9 7h7M9 11h5" /></>,
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>,
  calendar: <><path d="M3 9h18M8 2.5v4M16 2.5v4" /><rect x="3" y="4.5" width="18" height="16" rx="2.5" /></>,
};
// Clareia um hex misturando com branco (0..1).
function clarear(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (v) => Math.round(v + (255 - v) * amt);
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}
// Escurece um hex (mistura com preto), pra dar contraste ao desenho.
function escurecer(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (v) => Math.round(v * (1 - amt));
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}

// Degradês vibrantes (claro -> vivo) por tipo de ícone, pra os quadradinhos
// ficarem coloridos de verdade (e não apagados como a cor "chapada" da paleta).
const GRAD3D = {
  wallet: ['#9CB37B', '#5E7A46'],
  flame: ['#EF9A6E', '#C6542C'],
  cart: ['#EDBB63', '#C6862B'],
  tasks: ['#B197D1', '#7E5EA0'],
  book: ['#84B0D4', '#4E7C9E'],
  home: ['#9CB8A0', '#5E8A72'],
  calendar: ['#9CB8A0', '#5E8A72'],
};

// Ícone 3D "glass": uma forma vibrante em degradê atrás (girada), um cartão
// fosco translúcido na frente e o desenho por cima, com brilho e sombrinha.
// Fica lindo em tamanho grande (quadradinhos, destaques).
export function Icone3D({ name, cor = '#7C8A6C', size = 48 }) {
  const raw = useId().replace(/[:]/g, '');
  const [c1, c2] = GRAD3D[name] || [clarear(cor, 0.30), cor];
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-flex', flexShrink: 0 }}>
      {/* Só a forminha 3D "glass": fundo vibrante em degradê + cartão fosco + brilho. Sem desenho dentro. */}
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ display: 'block', filter: 'drop-shadow(0 5px 9px rgba(80,70,50,0.24))' }}>
        <defs>
          <linearGradient id={`${raw}a`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient>
          <linearGradient id={`${raw}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity="0.82" /><stop offset="1" stopColor={c2} stopOpacity="0.42" /></linearGradient>
        </defs>
        <rect x="7" y="5" width="28" height="28" rx="9" fill={`url(#${raw}a)`} transform="rotate(-12 21 19)" />
        <rect x="12" y="13" width="29" height="29" rx="10" fill={`url(#${raw}b)`} stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1" />
        <ellipse cx="22" cy="18" rx="11" ry="4.5" fill="#ffffff" opacity="0.32" />
      </svg>
    </span>
  );
}

export const inputStyle = {
  width: '100%', background: C.glassBg, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
  border: `1px solid ${C.glassBorder}`, color: C.text,
  borderRadius: 10, padding: '11px 12px', fontSize: 15, outline: 'none', boxSizing: 'border-box',
};

export function Label({ children }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 6, fontWeight: 600 }}>
      {children}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input type={type} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)} style={inputStyle} />
  );
}

export function NumInput({ value, onChange, placeholder }) {
  return (
    <input inputMode="decimal" value={value} placeholder={placeholder || '0,00'}
      onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }} />
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
    primary: { background: C.accent, color: C.onAccent, border: 'none' },
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
  return <div style={{ background: C.glassBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${C.glassBorder}`, borderRadius: 16, padding: 18, boxShadow: C.glassShadow, ...style }}>{children}</div>;
}

export function Field({ label, children }) {
  return <div style={{ marginBottom: 14 }}><Label>{label}</Label>{children}</div>;
}

export function Empty({ children }) {
  return <div style={{ textAlign: 'center', color: C.faint, padding: '36px 12px', fontSize: 14, lineHeight: 1.5 }}>{children}</div>;
}

export function KPI({ titulo, valor, cor, sub }) {
  return (
    <div style={{ background: C.glassBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${C.glassBorder}`, borderRadius: 14, padding: '13px 15px', minWidth: 0, boxShadow: C.glassShadow }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: C.muted, fontWeight: 600 }}>{titulo}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: cor || C.text, marginTop: 4, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{sub}</div>}
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
