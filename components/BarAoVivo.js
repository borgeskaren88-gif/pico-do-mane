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
// SVG: o salão com as mesas, o balcão no fundo, a cozinha no canto. Cada
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

  // A PLANTA DO BAR, montada a partir do número de mesas.
  const planta = useMemo(() => {
    if (!cena) return null;
    const n = cena.mesas.length;
    const cols = n <= 4 ? 2 : n <= 9 ? 3 : 4;
    const rows = Math.max(1, Math.ceil(n / cols));
    const PASSO = 2.6;
    const x0 = 4.4; const y0 = 2.7;
    const W = x0 + cols * PASSO + 0.4;
    const D = Math.max(4.4, y0 + rows * PASSO + 0.2);
    const mesas = cena.mesas.map((m, i) => ({ ...m, x: x0 + (i % cols) * PASSO, y: y0 + Math.floor(i / cols) * PASSO }));
    const bx = x0 - 0.2; const bw = cols * PASSO - 0.6;
    // Onde cada um da equipe fica em pé.
    const vagas = { cozinha: [[1.2, 1.4], [2.4, 1.2], [1.6, 2.5], [2.6, 2.6]], frente: [], salao: [] };
    for (let k = 0; k < 6; k += 1) vagas.frente.push([bx + 1 + k * 1.7, 1.75]);
    // No corredor ENTRE as mesas (não na beira da cozinha).
    for (let r = 0; r < rows; r += 1) for (let c = 1; c <= cols; c += 1) vagas.salao.push([x0 - 0.75 + c * PASSO, y0 + 0.55 + r * PASSO]);
    const usadas = { cozinha: 0, frente: 0, salao: 0 };
    const equipe = cena.equipe.map((p) => {
      const zona = p.setor === 'cozinha' ? 'cozinha' : (p.setor === 'gerente' || p.setor === 'dona' || p.setor === 'reservas') ? 'frente' : 'salao';
      const lista = vagas[zona];
      const [x, y] = lista[usadas[zona] % lista.length];
      usadas[zona] += 1;
      return { ...p, x, y };
    });
    return { W, D, mesas, equipe, bx, bw, cols, rows };
  }, [cena]);

  if (erro && !cena) return <div style={{ color: C.red, fontSize: 13 }}>{erro}</div>;
  if (!cena || !planta) return <div style={{ color: C.faint, fontSize: 13, padding: 20 }}>Abrindo o bar…</div>;

  const { W, D, mesas, equipe, bx, bw } = planta;
  const PAREDE = 74;
  const vx = [iso(0, D)[0], iso(W, 0)[0]];
  const vy = [iso(0, 0, PAREDE + 40)[1], iso(W, D)[1] + 30];
  const viewBox = `${vx[0] - 30} ${vy[0]} ${vx[1] - vx[0] + 60} ${vy[1] - vy[0]}`;

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
          <Caixa x={c.x - 0.2} y={c.y - 0.2} w={0.4} d={0.4} h={10} cor="#7C83C9" />
          {ocupada && <Boneco x={c.x} y={c.y} semente={s} camisa={CAMISAS[s % CAMISAS.length]} sentado />}
        </g>
      );
    };
    const extra = m.ocupada && m.pessoas > 4 ? m.pessoas - 4 : 0;
    const [nx, ny] = iso(tx + L / 2, ty + L / 2, 16);
    return (
      <g key={`m${m.numero}`} data-mesa={m.numero} data-ocupada={m.ocupada ? '1' : '0'} onClick={() => setSel(m.ocupada && sel !== m.numero ? m.numero : '')} style={{ cursor: m.ocupada ? 'pointer' : 'default' }}>
        {cadeiras.filter((c) => c.k === 'n' || c.k === 'w').map(cadeira)}
        <Caixa x={tx} y={ty} w={L} d={L} h={16} cor={m.ocupada ? '#C98B4E' : '#D2B48C'} />
        {m.ocupada && m.itens > 0 && <Caixa x={tx + 0.42} y={ty + 0.42} w={0.16} d={0.16} h={10} z={16} cor="#E9C46A" />}
        {/* Mesa livre: o número vai pintado no tampo, sem plaquinha. */}
        {!m.ocupada && <text x={nx} y={ny + 5} textAnchor="middle" fontSize={15} fontWeight={900} fill="#8C6A44" fontFamily="system-ui, -apple-system, sans-serif">{m.numero}</text>}
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
      <div ref={centrar} data-palco style={{ borderRadius: 16, overflowX: 'auto', overflowY: 'hidden', border: `1px solid ${C.line}`, background: 'linear-gradient(180deg, #2B1B47 0%, #3A2A5E 100%)', marginBottom: 12, WebkitOverflowScrolling: 'touch' }}>
        <svg viewBox={viewBox} width="100%" style={{ display: 'block', minWidth: 640 }} role="img" aria-label={`O bar agora: ${cena.pessoasNoBar} pessoas em ${cena.mesasOcupadas} mesas, ${equipe.length} da equipe no turno`}>
          {/* Paredes do fundo e da esquerda. */}
          <polygon points={pts([iso(0, 0), iso(W, 0), iso(W, 0, PAREDE), iso(0, 0, PAREDE)])} fill="#C9B59E" />
          <polygon points={pts([iso(0, 0), iso(0, D), iso(0, D, PAREDE), iso(0, 0, PAREDE)])} fill="#B9A38A" />
          <polyline points={pts([iso(0, D, PAREDE), iso(0, 0, PAREDE), iso(W, 0, PAREDE)])} fill="none" stroke="#8F7A62" strokeWidth={3} />
          {/* O chão, com o rejunte. */}
          <polygon points={pts([iso(0, 0), iso(W, 0), iso(W, D), iso(0, D)])} fill="#F3EBD9" />
          {Array.from({ length: Math.floor(W) }, (_, i) => i + 1).map((i) => <line key={`lx${i}`} x1={iso(i, 0)[0]} y1={iso(i, 0)[1]} x2={iso(i, D)[0]} y2={iso(i, D)[1]} stroke="#E4D8C2" strokeWidth={1} />)}
          {Array.from({ length: Math.floor(D) }, (_, i) => i + 1).map((j) => <line key={`ly${j}`} x1={iso(0, j)[0]} y1={iso(0, j)[1]} x2={iso(W, j)[0]} y2={iso(W, j)[1]} stroke="#E4D8C2" strokeWidth={1} />)}
          {/* A cozinha: piso de outra cor, fogão, bancada e as paredinhas. */}
          <polygon points={pts([iso(0, 0), iso(3.5, 0), iso(3.5, 3.5), iso(0, 3.5)])} fill="#DCE3E8" />
          <Caixa x={0.25} y={0.15} w={1.5} d={0.6} h={26} cor="#8D99A6" />
          <Caixa x={0.5} y={0.25} w={0.3} d={0.3} h={4} z={26} cor="#3D4451" />
          <Caixa x={1.1} y={0.25} w={0.3} d={0.3} h={4} z={26} cor="#3D4451" />
          <Caixa x={2.0} y={0.15} w={1.3} d={0.6} h={26} cor="#B8C2CC" />
          <Caixa x={0.15} y={1.0} w={0.6} d={1.6} h={26} cor="#B8C2CC" />
          <text x={iso(1.7, 3.0)[0]} y={iso(1.7, 3.0)[1]} textAnchor="middle" fontSize={12} fontWeight={800} fill="#7A8794" fontFamily="system-ui, sans-serif" letterSpacing="2">COZINHA</text>
          {/* A prateleira de garrafas na parede e o balcão. */}
          <Caixa x={bx} y={0.02} w={bw} d={0.18} h={8} z={46} cor="#6B4F3A" />
          {Array.from({ length: Math.max(3, Math.floor(bw / 0.45)) }, (_, k) => (
            <Caixa key={`gf${k}`} x={bx + 0.15 + k * 0.45} y={0.05} w={0.14} d={0.12} h={16} z={54} cor={['#2A9D8F', '#E9C46A', '#D1495B', '#8E7DBE', '#66A182'][k % 5]} />
          ))}
          <Caixa x={bx} y={0.55} w={bw} d={0.75} h={30} cor="#7A5638" />
          <Caixa x={bx} y={0.55} w={bw} d={0.75} h={3} z={30} cor="#3E2C1F" />
          <text x={iso(bx + bw / 2, 1.3, 8)[0]} y={iso(bx + bw / 2, 1.3, 8)[1]} textAnchor="middle" fontSize={11} fontWeight={800} fill="#F3EBD9" fontFamily="system-ui, sans-serif" letterSpacing="2">BALCÃO</text>
          {/* Plantas nos cantos. */}
          <Caixa x={W - 0.7} y={0.2} w={0.4} d={0.4} h={14} cor="#B5651D" />
          <Caixa x={W - 0.75} y={0.15} w={0.5} d={0.5} h={18} z={14} cor="#3E8E41" />
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
