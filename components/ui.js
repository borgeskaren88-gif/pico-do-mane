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
};

// Fundo da página com profundidade: um brilho azul no topo por cima de um
// leve degradê, dando cara mais moderna que o fundo chapado. As cores vêm das
// variáveis do tema, então o degradê muda junto no claro/escuro.
export const pageBg = 'radial-gradient(1000px 560px at 50% -4%, var(--c-glow-a), var(--c-glow-b) 58%), linear-gradient(180deg, var(--c-bg-top) 0%, var(--c-bg-bottom) 55%)';

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

// Ícones desenhados (linha), sem emoji. Herdam a cor via currentColor, então
// acompanham o texto do lugar onde são usados (aba ativa, tema, etc.).
export function Icone({ name, size = 20, stroke = 2 }) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
    style: { display: 'block', flexShrink: 0 },
  };
  switch (name) {
    case 'wallet':
      return (<svg {...props}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>);
    case 'flame':
      return (<svg {...props}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>);
    case 'cart':
      return (<svg {...props}><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.5 3h2l2.6 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 8H5.1" /></svg>);
    case 'check':
      return (<svg {...props}><path d="M20 6 9 17l-5-5" /></svg>);
    case 'sun':
      return (<svg {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>);
    case 'moon':
      return (<svg {...props}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>);
    default:
      return null;
  }
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
  return <div style={{ background: C.panel, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 18, boxShadow: C.cardShadow, ...style }}>{children}</div>;
}

export function Field({ label, children }) {
  return <div style={{ marginBottom: 14 }}><Label>{label}</Label>{children}</div>;
}

export function Empty({ children }) {
  return <div style={{ textAlign: 'center', color: C.faint, padding: '36px 12px', fontSize: 14, lineHeight: 1.5 }}>{children}</div>;
}

export function KPI({ titulo, valor, cor, sub }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.cardBorder}`, borderRadius: 14, padding: '13px 15px', minWidth: 0, boxShadow: C.cardShadow }}>
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
