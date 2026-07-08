export const C = {
  ink: '#0A1220', panel: '#101B2E', panel2: '#17263F', raised: '#1D2E4B',
  line: '#27395B', accent: '#4C93F5', accent2: '#7FB2FA',
  text: '#E9F0FB', muted: '#94A8C7', faint: '#5E7391',
  green: '#5BC98D', red: '#E9765C', amber: '#E7B24D',
};

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
    primary: { background: C.accent, color: '#06101F', border: 'none' },
    ghost: { background: 'transparent', color: C.text, border: `1px solid ${C.line}` },
    danger: { background: 'transparent', color: C.red, border: `1px solid ${C.red}55` },
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
  return <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, ...style }}>{children}</div>;
}

export function Field({ label, children }) {
  return <div style={{ marginBottom: 14 }}><Label>{label}</Label>{children}</div>;
}

export function Empty({ children }) {
  return <div style={{ textAlign: 'center', color: C.faint, padding: '36px 12px', fontSize: 14, lineHeight: 1.5 }}>{children}</div>;
}

export function KPI({ titulo, valor, cor, sub }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '13px 15px', minWidth: 0 }}>
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
