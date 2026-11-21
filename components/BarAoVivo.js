'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { C, Card } from './ui';
import { brl } from '../lib/util';

// O BAR AO VIVO, NA PEGADA DE JOGUINHO.
//
// "Uma tela em que eu veja quantas pessoas tem no bar e quem está trabalhando,
// nessa pegada" — a do escritório de bonequinhos visto de cima, com o nome de
// cada um numa plaquinha e a bolinha verde de "está aqui".
//
// É um desenho isométrico (aquele 3D de lado, de jogo antigo) feito à mão, em
// SVG, com a cara do Pico ("poderia se parecer com o Pico, a vista ali"): o
// deck de madeira, o guarda-corpo de vidro de frente pra baía, a parede do
// grafite, o varal de lâmpadas, o balcão de tijolinho e a placa redonda. Cada
// pessoa de uma comanda aberta é um bonequinho sentado; cada um da equipe com
// ponto aberto é um bonequinho em pé, com o nome em cima, no lugar do setor
// dele. A tela se atualiza sozinha.

const TW = 72;
const TH = 36;
const iso = (x, y, z = 0) => [(x - y) * TW / 2, (x + y) * TH / 2 - z];
const pts = (a) => a.map(([p, q]) => `${p.toFixed(1)},${q.toFixed(1)}`).join(' ');

// Clareia (f > 0) ou escurece (f < 0) uma cor: as três faces da caixa.
function tom(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('')}`;
}

function Caixa({ x, y, w, d, h, z = 0, cor }) {
  const A = iso(x, y, z + h); const B = iso(x + w, y, z + h); const Cc = iso(x + w, y + d, z + h); const D = iso(x, y + d, z + h);
  const Bb = iso(x + w, y, z); const Cb = iso(x + w, y + d, z); const Db = iso(x, y + d, z);
  return (
    <g>
      <polygon points={pts([D, Cc, Cb, Db])} fill={tom(cor, -0.18)} />
      <polygon points={pts([B, Cc, Cb, Bb])} fill={tom(cor, -0.32)} />
      <polygon points={pts([A, B, Cc, D])} fill={cor} />
    </g>
  );
}

const PELES = ['#F1C9A5', '#D9A47A', '#B07A52', '#8A5A3B', '#F5D7BD'];
const CAMISAS = ['#E76F51', '#2A9D8F', '#E9C46A', '#8E7DBE', '#F4A261', '#5FA8D3', '#D1495B', '#66A182'];
const CABELOS = ['#2B2118', '#5A3A22', '#1F1F1F', '#A0522D', '#3B2A1A'];
const COR_SETOR = { garcom: '#4F8EF7', extra: '#A78BFA', cozinha: '#F4F6F8', gerente: '#22C55E', dona: '#F59E0B', reservas: '#EC4899' };
const hashN = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };

// Um bonequinho de blocos. Em pé tem perna; sentado, o corpo começa no banco.
function Boneco({ x, y, semente, camisa, sentado = false, chef = false }) {
  const pele = PELES[semente % PELES.length];
  const cabelo = CABELOS[(semente >> 3) % CABELOS.length];
  const base = sentado ? 10 : 0;
  const pernas = sentado ? 0 : 14;
  return (
    <g>
      {!sentado && <Caixa x={x - 0.11} y={y - 0.07} w={0.22} d={0.14} h={pernas} cor="#3D4451" />}
      <Caixa x={x - 0.14} y={y - 0.1} w={0.28} d={0.2} h={18} z={base + pernas} cor={camisa} />
      <Caixa x={x - 0.11} y={y - 0.11} w={0.22} d={0.22} h={14} z={base + pernas + 18} cor={pele} />
      {chef
        ? <Caixa x={x - 0.12} y={y - 0.12} w={0.24} d={0.24} h={12} z={base + pernas + 32} cor="#FFFFFF" />
        : <Caixa x={x - 0.12} y={y - 0.12} w={0.24} d={0.24} h={4} z={base + pernas + 31} cor={cabelo} />}
    </g>
  );
}

// A plaquinha com o nome e a bolinha verde, igual à do escritório de jogo.
function Placa({ x, y, z, texto, cor }) {
  const [px, py] = iso(x, y, z);
  const larg = Math.max(60, texto.length * 9 + 36);
  return (
    <g>
      <rect x={px - larg / 2} y={py - 28} width={larg} height={24} rx={5} fill="#1E2533" opacity={0.93} />
      <rect x={px - larg / 2} y={py - 28} width={4} height={24} rx={2} fill={cor} />
      <text x={px - larg / 2 + 11} y={py - 11} fontSize={14.5} fontWeight={700} fill="#FFFFFF" fontFamily="system-ui, -apple-system, sans-serif">{texto}</text>
      <circle cx={px + larg / 2 - 10} cy={py - 16} r={4.5} fill="#22C55E" />
    </g>
  );
}

const horas = (min) => (min == null ? '' : min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`);

export default function BarAoVivo() {
  const [cena, setCena] = useState(null);
  const [erro, setErro] = useState('');
  const [sel, setSel] = useState('');
  const centrado = React.useRef(false);
  const centrar = useCallback((el) => {
    if (!el || centrado.current) return;
    requestAnimationFrame(() => { el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2); centrado.current = true; });
  }, []);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/aovivo', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) { setCena(j); setErro(''); } else setErro(j.erro || 'Não consegui carregar.');
    } catch { setErro('Sem conexão.'); }
  }, []);
  // Atualiza sozinha a cada 20 s — mas só com a tela à vista.
  useEffect(() => {
    carregar();
    const t = setInterval(() => { if (document.visibilityState === 'visible') carregar(); }, 20000);
    const volta = () => { if (document.visibilityState === 'visible') carregar(); };
    document.addEventListener('visibilitychange', volta);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', volta); };
  }, [carregar]);

  // A PLANTA DO BAR — o Pico: o deck de frente pra baía. À esquerda o
  // guarda-corpo de vidro com a vista; ao fundo a parede do grafite; no
  // canto do fundo a cozinha; na frente, à direita, o balcão de tijolinho.
  const planta = useMemo(() => {
    if (!cena) return null;
    const n = cena.mesas.length;
    const cols = n <= 4 ? 2 : n <= 9 ? 3 : 4;
    const rows = Math.max(1, Math.ceil(n / cols));
    const PASSO = 2.6;
    const x0 = 1.3; const y0 = 2.9;
    const W = x0 + cols * PASSO + 1.7;
    const D = Math.max(5.4, y0 + rows * PASSO + 0.3);
    const mesas = cena.mesas.map((m, i) => ({ ...m, x: x0 + (i % cols) * PASSO, y: y0 + Math.floor(i / cols) * PASSO }));
    const cozX = W - 3.1;
    const balcao = { x: W - 1.05, y: 2.9, w: 0.75, d: Math.max(1.6, D - 0.7 - 2.9) };
    const vagas = { cozinha: [[cozX + 0.9, 1.4], [cozX + 2.0, 1.6], [cozX + 1.4, 1.95], [cozX + 2.5, 1.1]], frente: [], salao: [] };
    for (let k = 0; k < 6; k += 1) vagas.frente.push([balcao.x - 0.45, balcao.y + 0.5 + k * 1.3]);
    for (let r = 0; r < rows; r += 1) for (let c = 1; c <= cols; c += 1) vagas.salao.push([x0 - 0.75 + c * PASSO, y0 + 0.55 + r * PASSO]);
    const usadas = { cozinha: 0, frente: 0, salao: 0 };
    const equipe = cena.equipe.map((p) => {
      const zona = p.setor === 'cozinha' ? 'cozinha' : (p.setor === 'gerente' || p.setor === 'dona' || p.setor === 'reservas') ? 'frente' : 'salao';
      const lista = vagas[zona];
      const [x, y] = lista[usadas[zona] % lista.length];
      usadas[zona] += 1;
      return { ...p, x, y };
    });
    return { W, D, mesas, equipe, cozX, balcao, cols, rows };
  }, [cena]);

  if (erro && !cena) return <div style={{ color: C.red, fontSize: 13 }}>{erro}</div>;
  if (!cena || !planta) return <div style={{ color: C.faint, fontSize: 13, padding: 20 }}>Abrindo o bar…</div>;

  const { W, D, mesas, equipe, cozX, balcao } = planta;
  const PAREDE = 96;
  const POSTE = 150;
  const vx = [iso(0, D)[0] - 40, iso(W, 0)[0] + 40];
  const vy = [-215, iso(W, D)[1] + 46];
  const viewBox = `${vx[0]} ${vy[0]} ${vx[1] - vx[0]} ${vy[1] - vy[0]}`;
  const HORIZONTE = -58;

  // Tudo que tem altura entra numa fila só, do fundo pra frente: quem está
  // mais atrás é desenhado antes (senão a mesa da frente some atrás da de trás).
  const objetos = [];
  for (const m of mesas) objetos.push({ prof: m.x + m.y + 0.55, tipo: 'mesa', m });
  equipe.forEach((p, i) => objetos.push({ prof: p.x + p.y, tipo: 'equipe', p, i }));
  objetos.sort((a, b) => a.prof - b.prof);
  const mesaSel = mesas.find((m) => m.numero === sel && m.ocupada) || null;
  const abertas = mesas.filter((m) => m.ocupada).sort((a, b) => (b.minutos || 0) - (a.minutos || 0));
  const atualizado = cena.agora ? new Date(cena.agora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '';

  const mesaDesenho = (m) => {
    const tx = m.x; const ty = m.y; const L = 1.1;
    const cadeiras = [
      { k: 'n', x: tx + L / 2, y: ty - 0.42 }, { k: 'w', x: tx - 0.42, y: ty + L / 2 },
      { k: 'e', x: tx + L + 0.42, y: ty + L / 2 }, { k: 's', x: tx + L / 2, y: ty + L + 0.42 },
    ];
    const sentados = m.ocupada ? Math.min(4, m.pessoas) : 0;
    const ordem = ['n', 'w', 'e', 's'];
    const cadeira = (c, idx) => {
      const ocupada = ordem.indexOf(c.k) < sentados;
      const s = hashN(`${m.numero}-${c.k}`);
      return (
        <g key={c.k} data-sentado={ocupada ? '1' : undefined}>
          {/* Cadeira de madeira dobrável, com o encosto do lado de fora. */}
          <Caixa x={c.x - 0.19} y={c.y - 0.19} w={0.38} d={0.38} h={10} cor="#B5763F" />
          {(c.k === 'n' || c.k === 'w') && <Caixa x={c.k === 'w' ? c.x - 0.21 : c.x - 0.19} y={c.k === 'n' ? c.y - 0.21 : c.y - 0.19} w={c.k === 'w' ? 0.06 : 0.38} d={c.k === 'n' ? 0.06 : 0.38} h={26} cor="#9C6233" />}
          {ocupada && <Boneco x={c.x} y={c.y} semente={s} camisa={CAMISAS[s % CAMISAS.length]} sentado />}
          {(c.k === 'e' || c.k === 's') && <Caixa x={c.k === 'e' ? c.x + 0.15 : c.x - 0.19} y={c.k === 's' ? c.y + 0.15 : c.y - 0.19} w={c.k === 'e' ? 0.06 : 0.38} d={c.k === 's' ? 0.06 : 0.38} h={22} cor="#9C6233" />}
        </g>
      );
    };
    const extra = m.ocupada && m.pessoas > 4 ? m.pessoas - 4 : 0;
    const [nx, ny] = iso(tx + L / 2, ty + L / 2, 16);
    return (
      <g key={`m${m.numero}`} data-mesa={m.numero} data-ocupada={m.ocupada ? '1' : '0'} onClick={() => setSel(m.ocupada && sel !== m.numero ? m.numero : '')} style={{ cursor: m.ocupada ? 'pointer' : 'default' }}>
        {cadeiras.filter((c) => c.k === 'n' || c.k === 'w').map(cadeira)}
        <Caixa x={tx} y={ty} w={L} d={L} h={16} cor={m.ocupada ? '#C8874D' : '#D6A876'} />
        {/* As ripas do tampo, como as mesas de madeira do Pico. */}
        {[0.28, 0.55, 0.82].map((f) => <line key={f} x1={iso(tx + f * L, ty, 16)[0]} y1={iso(tx + f * L, ty, 16)[1]} x2={iso(tx + f * L, ty + L, 16)[0]} y2={iso(tx + f * L, ty + L, 16)[1]} stroke="#A86B36" strokeWidth={1.2} />)}
        {m.ocupada && m.itens > 0 && !m.narguile && <Caixa x={tx + 0.2} y={ty + 0.62} w={0.12} d={0.12} h={12} z={16} cor="#2E7D4F" />}
        {m.ocupada && m.itens > 1 && <Caixa x={tx + 0.72} y={ty + 0.25} w={0.12} d={0.12} h={10} z={16} cor="#E9C46A" />}
        {/* NARGUILÉ: se tem na comanda, ele aparece aceso na mesa. */}
        {m.ocupada && m.narguile && (
          <g data-narguile>
            <ellipse cx={iso(tx + L / 2, ty + L / 2, 30)[0]} cy={iso(tx + L / 2, ty + L / 2, 30)[1]} rx={20} ry={14} fill="url(#av-brilho)" />
            <Caixa x={tx + 0.45} y={ty + 0.45} w={0.2} d={0.2} h={4} z={16} cor="#222831" />
            <Caixa x={tx + 0.47} y={ty + 0.47} w={0.16} d={0.16} h={12} z={20} cor="#7C3AED" />
            <Caixa x={tx + 0.53} y={ty + 0.53} w={0.04} d={0.04} h={22} z={32} cor="#D4A72C" />
            <Caixa x={tx + 0.48} y={ty + 0.48} w={0.14} d={0.14} h={5} z={54} cor="#C0392B" />
          </g>
        )}
        {/* Mesa livre: o número vai pintado no tampo, sem plaquinha. */}
        {!m.ocupada && <text x={nx} y={ny + 5} textAnchor="middle" fontSize={15} fontWeight={900} fill="#8A5A2E" fontFamily="system-ui, -apple-system, sans-serif">{m.numero}</text>}
        {cadeiras.filter((c) => c.k === 'e' || c.k === 's').map(cadeira)}
        {extra > 0 && (
          <g data-mais={extra} transform={`translate(${iso(tx + L, ty, 30)[0].toFixed(1)},${iso(tx + L, ty, 30)[1].toFixed(1)})`}>
            <circle r={12} fill="#E76F51" />
            <text y={4.5} textAnchor="middle" fontSize={12} fontWeight={900} fill="#fff" fontFamily="system-ui, sans-serif">+{extra}</text>
          </g>
        )}
      </g>
    );
  };

  // AS PLAQUINHAS VÃO POR CIMA DE TUDO. Desenhadas junto da mesa, a mesa da
  // frente cobria a plaquinha da de trás.
  const mesaRotulo = (m) => {
    const L = 1.1;
    const [lx, ly] = iso(m.x + L / 2, m.y + L / 2, 62);
    const rotulo = `Mesa ${m.numero} · ${m.pessoas}`;
    const larg = rotulo.length * 9 + 34;
    return (
      <g key={`r${m.numero}`} data-rotulo-mesa={m.numero} onClick={() => setSel(sel !== m.numero ? m.numero : '')} style={{ cursor: 'pointer' }} transform={`translate(${lx.toFixed(1)},${ly.toFixed(1)})`}>
        <rect x={-larg / 2} y={-15} width={larg} height={25} rx={12.5} fill={sel === m.numero ? '#F59E0B' : '#2563EB'} stroke="#FFFFFF" strokeWidth={1.5} />
        <text x={-larg / 2 + 11} y={3} fontSize={15} fontWeight={800} fill="#FFFFFF" fontFamily="system-ui, -apple-system, sans-serif">{rotulo}</text>
        <g transform={`translate(${larg / 2 - 15},-3)`}><circle r={3.4} cy={-2.5} fill="#fff" /><rect x={-4.5} y={2} width={9} height={5.5} rx={2.5} fill="#fff" /></g>
      </g>
    );
  };

  const stat = (rot, valor, sub, data) => (
    <div data-stat={data} style={{ flex: '1 1 0', minWidth: 0, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{rot}</div>
      <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
      {sub && <div style={{ fontSize: 11.5, color: C.faint }}>{sub}</div>}
    </div>
  );

  return (
    <div data-bar-ao-vivo>
      <style>{`
        @keyframes av-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        @keyframes av-pulso { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
        .av-bob { animation: av-bob 2.6s ease-in-out infinite }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Bar ao vivo</div>
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: C.green, animation: 'av-pulso 1.6s ease-in-out infinite' }} />
          AO VIVO{atualizado ? ` · ${atualizado}` : ''}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {stat('Pessoas no bar', cena.pessoasNoBar, null, 'pessoas')}
        {stat('Mesas', `${cena.mesasOcupadas}/${cena.mesasTotal}`, 'ocupadas', 'mesas')}
        {stat('Equipe', equipe.length, 'no turno', 'equipe')}
      </div>

      {/* A EQUIPE NO TURNO, em fila de avatares. */}
      <div data-equipe-fila style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1E2533', borderRadius: 999, padding: '6px 12px 6px 8px', marginBottom: 10, overflowX: 'auto' }}>
        {equipe.length === 0 ? <span style={{ color: '#C9D1DC', fontSize: 12.5, padding: '2px 6px' }}>Ninguém bateu o ponto ainda.</span> : equipe.map((p) => (
          <div key={p.nome} title={`${p.nome} · ${p.setorNome} · desde ${new Date(p.desde).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ width: 24, height: 24, borderRadius: 999, background: COR_SETOR[p.setor] || '#94A3B8', color: '#0B1220', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p.nome.slice(0, 1).toUpperCase()}</span>
            <span style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{p.nome.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      {/* O BAR. */}
      {/* No celular o bar fica maior que a tela, pra dar pra ler os nomes:
          arrasta pro lado. Começa centrado. */}
      <div ref={centrar} data-palco style={{ borderRadius: 16, overflowX: 'auto', overflowY: 'hidden', border: `1px solid ${C.line}`, background: '#6E9FBE', marginBottom: 12, WebkitOverflowScrolling: 'touch' }}>
        <svg viewBox={viewBox} width="100%" style={{ display: 'block', minWidth: 640 }} role="img" aria-label={`O bar agora: ${cena.pessoasNoBar} pessoas em ${cena.mesasOcupadas} mesas, ${equipe.length} da equipe no turno`}>
          <defs>
            <linearGradient id="av-ceu" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8EB1D6" /><stop offset="1" stopColor="#F3D3BC" />
            </linearGradient>
            <linearGradient id="av-mar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#A9CBDD" /><stop offset="1" stopColor="#6E9FBE" />
            </linearGradient>
            <radialGradient id="av-luz"><stop offset="0" stopColor="#FFF4C8" /><stop offset=".45" stopColor="#FFD873" stopOpacity=".55" /><stop offset="1" stopColor="#FFD873" stopOpacity="0" /></radialGradient>
            <radialGradient id="av-brilho"><stop offset="0" stopColor="#B57BFF" stopOpacity=".75" /><stop offset="1" stopColor="#7C3AED" stopOpacity="0" /></radialGradient>
          </defs>

          {/* A VISTA: céu de fim de tarde, os morros, a cidade e a baía. */}
          <rect x={vx[0]} y={vy[0]} width={vx[1] - vx[0]} height={HORIZONTE - vy[0]} fill="url(#av-ceu)" />
          <rect x={vx[0]} y={HORIZONTE} width={vx[1] - vx[0]} height={vy[1] - HORIZONTE} fill="url(#av-mar)" />
          <polygon fill="#7D8DB3" points={pts([[vx[0], HORIZONTE], [vx[0], -118], [vx[0] + 70, -138], [vx[0] + 150, -112], [vx[0] + 230, -150], [vx[0] + 320, -120], [vx[0] + 400, -142], [vx[0] + 480, -108], [vx[0] + 560, -128], [vx[1], -116], [vx[1], HORIZONTE]])} />
          <polygon fill="#94A3C4" points={pts([[vx[0], HORIZONTE], [vx[0], -86], [vx[0] + 110, -98], [vx[0] + 210, -80], [vx[0] + 300, -94], [vx[0] + 420, -78], [vx[1], -88], [vx[1], HORIZONTE]])} />
          {Array.from({ length: 46 }, (_, k) => {
            const x = vx[0] + 8 + k * ((0 - vx[0]) / 46);
            const h = 4 + (hashN(`c${k}`) % 12);
            return <rect key={`pr${k}`} x={x} y={HORIZONTE - h} width={((0 - vx[0]) / 46) - 1.5} height={h} fill={['#ECE6DA', '#DCD5C8', '#F5F1E8', '#CFC8BB'][k % 4]} />;
          })}
          <rect x={vx[0]} y={HORIZONTE} width={vx[1] - vx[0]} height={2} fill="#E9E1D2" opacity={0.7} />
          {[0.18, 0.42, 0.66].map((f, k) => <line key={`onda${k}`} x1={vx[0] + 20 + k * 40} y1={HORIZONTE + 22 + k * 30} x2={vx[0] + 90 + k * 40} y2={HORIZONTE + 22 + k * 30} stroke="#C9E0EC" strokeWidth={2} strokeLinecap="round" opacity={0.6} />)}

          {/* A PAREDE DO GRAFITE, ao fundo. As formas são desenhadas "deitadas
              na parede" (a matriz entorta o desenho junto com a parede). */}
          <g transform="matrix(1,0.5,0,-1,0,0)">
            <rect x={0} y={0} width={cozX * TW / 2} height={PAREDE} fill="#2E3F7F" />
            <polygon points="0,0 70,0 30,60" fill="#D94F45" stroke="#1D2340" strokeWidth={1.5} />
            <polygon points="30,60 70,0 95,70" fill="#E68A8A" stroke="#1D2340" strokeWidth={1.5} />
            <polygon points="0,60 30,60 0,96" fill="#7FB3D5" stroke="#1D2340" strokeWidth={1.5} />
            <polygon points="95,70 70,0 130,30" fill="#F2B632" stroke="#1D2340" strokeWidth={1.5} />
            <polygon points="30,60 95,70 60,96 0,96" fill="#F3EBD9" stroke="#1D2340" strokeWidth={1.5} opacity={0.9} />
            <circle cx={cozX * TW / 2 * 0.68} cy={50} r={44} fill="#F2B632" />
            <circle cx={cozX * TW / 2 * 0.68} cy={50} r={26} fill="#4B4B52" />
            <circle cx={cozX * TW / 2 * 0.68 - 9} cy={56} r={4} fill="#E9E1D2" />
            <circle cx={cozX * TW / 2 * 0.68 + 9} cy={56} r={4} fill="#E9E1D2" />
            {[[150, 20], [175, 75], [205, 35], [260, 82], [300, 15], [330, 60]].filter(([u]) => u < cozX * TW / 2 - 10).map(([u, v], k) => <circle key={`pt${k}`} cx={u} cy={v} r={3} fill="#F3EBD9" />)}
            <rect x={cozX * TW / 2} y={0} width={(W - cozX) * TW / 2} height={PAREDE} fill="#E3DACB" />
            <rect x={0} y={PAREDE - 4} width={W * TW / 2} height={4} fill="#1D2340" opacity={0.5} />
          </g>

          {/* O DECK DE MADEIRA, tábua por tábua, com a borda grossa na frente. */}
          <polygon points={pts([iso(W, 0), iso(W, D), iso(W, D, -14), iso(W, 0, -14)])} fill="#5E3B22" />
          <polygon points={pts([iso(0, D), iso(W, D), iso(W, D, -14), iso(0, D, -14)])} fill="#6E4628" />
          {Array.from({ length: Math.ceil(D / 0.5) }, (_, k) => {
            const y1 = k * 0.5; const y2 = Math.min(D, y1 + 0.5);
            return <polygon key={`tb${k}`} points={pts([iso(0, y1), iso(W, y1), iso(W, y2), iso(0, y2)])} fill={k % 2 ? '#A3714A' : '#AC7A51'} stroke="#8A5B37" strokeWidth={0.8} />;
          })}
          {/* A cozinha, no canto do fundo. */}
          <polygon points={pts([iso(cozX, 0), iso(W, 0), iso(W, 2.4), iso(cozX, 2.4)])} fill="#D9DEE2" />
          <Caixa x={cozX + 0.2} y={0.12} w={1.3} d={0.55} h={26} cor="#8D99A6" />
          <Caixa x={cozX + 0.4} y={0.22} w={0.3} d={0.3} h={4} z={26} cor="#3D4451" />
          <Caixa x={cozX + 0.95} y={0.22} w={0.3} d={0.3} h={4} z={26} cor="#3D4451" />
          <Caixa x={cozX + 1.7} y={0.12} w={1.2} d={0.55} h={26} cor="#B8C2CC" />
          <Caixa x={cozX} y={2.35} w={1.1} d={0.1} h={30} cor="#C9B8A0" />
          <Caixa x={cozX + 2.0} y={2.35} w={W - cozX - 2.0} d={0.1} h={30} cor="#C9B8A0" />
          <text x={iso(cozX + 1.55, 2.2)[0]} y={iso(cozX + 1.55, 2.2)[1]} textAnchor="middle" fontSize={12} fontWeight={800} fill="#7A8794" fontFamily="system-ui, sans-serif" letterSpacing="2">COZINHA</text>

          {/* A placa redonda do Pico e a caixa de som, perto do vidro. */}
          <Caixa x={0.55} y={0.75} w={0.06} d={0.06} h={64} cor="#F3F3F3" />
          <g transform={`translate(${iso(0.58, 0.78, 84)[0].toFixed(1)},${iso(0.58, 0.78, 84)[1].toFixed(1)})`}>
            <circle r={26} fill="#2D2F6B" stroke="#1A1B45" strokeWidth={2} />
            <text y={-2} textAnchor="middle" fontSize={9.5} fontWeight={900} fill="#E9C46A" fontFamily="system-ui, sans-serif" letterSpacing="1">PICO DO</text>
            <text y={10} textAnchor="middle" fontSize={9.5} fontWeight={900} fill="#E9C46A" fontFamily="system-ui, sans-serif" letterSpacing="1">MANÉ</text>
          </g>
          <Caixa x={1.55} y={0.5} w={0.05} d={0.05} h={42} cor="#2B2B2B" />
          <Caixa x={1.35} y={0.32} w={0.45} d={0.36} h={46} z={42} cor="#1F1F23" />

          {/* O balcão de tijolinho com o tampo escuro de granito. */}
          <Caixa x={balcao.x} y={balcao.y} w={balcao.w} d={balcao.d} h={34} cor="#B5603A" />
          {Array.from({ length: 4 }, (_, r) => (
            <line key={`jr${r}`} x1={iso(balcao.x + balcao.w, balcao.y, 7 + r * 8)[0]} y1={iso(balcao.x + balcao.w, balcao.y, 7 + r * 8)[1]} x2={iso(balcao.x + balcao.w, balcao.y + balcao.d, 7 + r * 8)[0]} y2={iso(balcao.x + balcao.w, balcao.y + balcao.d, 7 + r * 8)[1]} stroke="#E7C7A8" strokeWidth={1} opacity={0.7} />
          ))}
          {Array.from({ length: Math.floor(balcao.d / 0.3) }, (_, k) => (
            <line key={`jv${k}`} x1={iso(balcao.x + balcao.w, balcao.y + 0.15 + k * 0.3, (k % 2) * 8)[0]} y1={iso(balcao.x + balcao.w, balcao.y + 0.15 + k * 0.3, (k % 2) * 8)[1]} x2={iso(balcao.x + balcao.w, balcao.y + 0.15 + k * 0.3, (k % 2) * 8 + 8)[0]} y2={iso(balcao.x + balcao.w, balcao.y + 0.15 + k * 0.3, (k % 2) * 8 + 8)[1]} stroke="#E7C7A8" strokeWidth={1} opacity={0.6} />
          ))}
          <Caixa x={balcao.x - 0.05} y={balcao.y - 0.05} w={balcao.w + 0.1} d={balcao.d + 0.1} h={5} z={34} cor="#3B3F45" />
          <text x={iso(balcao.x + balcao.w, balcao.y + balcao.d / 2, 16)[0] + 8} y={iso(balcao.x + balcao.w, balcao.y + balcao.d / 2, 16)[1]} textAnchor="middle" fontSize={10} fontWeight={900} fill="#FBE9D7" fontFamily="system-ui, sans-serif" letterSpacing="2">BALCÃO</text>

          {/* Uma planta no canto do vidro. */}
          <Caixa x={0.25} y={D - 0.7} w={0.4} d={0.4} h={14} cor="#B5651D" />
          <Caixa x={0.2} y={D - 0.75} w={0.5} d={0.5} h={18} z={14} cor="#3E8E41" />

          {/* Mesas e equipe, do fundo pra frente. */}
          {objetos.map((o) => (o.tipo === 'mesa' ? mesaDesenho(o.m) : (
            <g key={`p${o.p.nome}`} data-pessoa-equipe={o.p.nome} data-setor={o.p.setor}>
              <g className="av-bob" style={{ animationDelay: `${(o.i * 0.37) % 2.6}s` }}>
                <Boneco x={o.p.x} y={o.p.y} semente={hashN(o.p.nome)} camisa={COR_SETOR[o.p.setor] || '#94A3B8'} chef={o.p.setor === 'cozinha'} />
              </g>
            </g>
          )))}
          {/* O GUARDA-CORPO DE VIDRO, do lado da vista. */}
          {Array.from({ length: Math.floor(D / 1.2) + 1 }, (_, k) => Math.min(D, k * 1.2)).map((y, k, arr) => (
            <g key={`gc${k}`}>
              {k < arr.length - 1 && <polygon points={pts([iso(0, y, 4), iso(0, arr[k + 1], 4), iso(0, arr[k + 1], 44), iso(0, y, 44)])} fill="#D6EEF8" opacity={0.28} stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={0.8} />}
              <Caixa x={-0.04} y={y - 0.04} w={0.08} d={0.08} h={46} cor="#F4F6F8" />
            </g>
          ))}
          <polyline points={pts([iso(0, 0, 46), iso(0, D, 46)])} stroke="#FFFFFF" strokeWidth={3} fill="none" />

          {/* O VARAL DE LÂMPADAS, cruzando por cima do deck. */}
          <Caixa x={-0.05} y={-0.05} w={0.1} d={0.1} h={POSTE} cor="#F4F6F8" />
          <Caixa x={-0.05} y={D - 0.05} w={0.1} d={0.1} h={POSTE} cor="#F4F6F8" />
          <Caixa x={W - 0.05} y={D - 0.05} w={0.1} d={0.1} h={POSTE} cor="#F4F6F8" />
          {Array.from({ length: 5 }, (_, k) => {
            const a1 = iso(0, (D * (k + 0.2)) / 5, POSTE); const a2 = iso(W, (D * (k + 0.9)) / 5, POSTE - 10);
            const cx = (a1[0] + a2[0]) / 2; const cy = (a1[1] + a2[1]) / 2 + 34;
            const ponto = (t) => [(1 - t) * (1 - t) * a1[0] + 2 * (1 - t) * t * cx + t * t * a2[0], (1 - t) * (1 - t) * a1[1] + 2 * (1 - t) * t * cy + t * t * a2[1]];
            return (
              <g key={`vr${k}`}>
                <path d={`M${a1[0].toFixed(1)},${a1[1].toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${a2[0].toFixed(1)},${a2[1].toFixed(1)}`} stroke="#2B2B2B" strokeWidth={1.3} fill="none" opacity={0.75} />
                {Array.from({ length: 9 }, (_, b2) => {
                  const [px, py] = ponto((b2 + 0.5) / 9);
                  return (
                    <g key={b2} data-lampada>
                      <line x1={px} y1={py} x2={px} y2={py + 6} stroke="#2B2B2B" strokeWidth={1} />
                      <circle cx={px} cy={py + 10} r={11} fill="url(#av-luz)" />
                      <circle cx={px} cy={py + 10} r={3.6} fill="#FFF1C1" />
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* A camada de cima: as plaquinhas das mesas e os nomes da equipe. */}
          {objetos.map((o) => (o.tipo === 'mesa'
            ? (o.m.ocupada ? mesaRotulo(o.m) : null)
            : (
              <g key={`n${o.p.nome}`} data-placa={o.p.nome} className="av-bob" style={{ animationDelay: `${(o.i * 0.37) % 2.6}s` }}>
                <Placa x={o.p.x} y={o.p.y} z={o.p.setor === 'cozinha' ? 62 : 54} texto={o.p.nome.split(' ')[0]} cor={COR_SETOR[o.p.setor] || '#94A3B8'} />
              </g>
            )))}
        </svg>
      </div>

      {mesaSel && (
        <Card data-mesa-detalhe style={{ marginBottom: 12, padding: 14, borderColor: '#F59E0B' }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>Mesa {mesaSel.numero}{mesaSel.nome ? ` · ${mesaSel.nome}` : ''}</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 1.6 }}>
            {mesaSel.pessoas} {mesaSel.pessoas === 1 ? 'pessoa' : 'pessoas'} · sentou há {horas(mesaSel.minutos)} · {mesaSel.itens} {mesaSel.itens === 1 ? 'item' : 'itens'} · <b style={{ color: C.text }}>{brl(mesaSel.total)}</b> até agora
          </div>
        </Card>
      )}

      <Card style={{ padding: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>Mesas abertas</div>
        {abertas.length === 0 ? <div style={{ fontSize: 13, color: C.faint }}>Nenhuma mesa aberta agora.</div> : abertas.map((m) => (
          <div key={m.numero} data-aberta={m.numero} onClick={() => setSel(m.numero)} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: `1px solid ${C.hair}`, fontSize: 13.5, cursor: 'pointer' }}>
            <span style={{ minWidth: 0 }}><b>Mesa {m.numero}</b>{m.nome ? <span style={{ color: C.muted }}> · {m.nome}</span> : null} <span style={{ color: C.faint }}>· {m.pessoas} {m.pessoas === 1 ? 'pessoa' : 'pessoas'} · {horas(m.minutos)}</span></span>
            <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(m.total)}</span>
          </div>
        ))}
        {abertas.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.line}`, marginTop: 4, paddingTop: 8, fontSize: 13, fontWeight: 900 }}>
            <span>Aberto no salão</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{brl(cena.abertoNoSalao)}</span>
          </div>
        )}
      </Card>
    </div>
  );
}
