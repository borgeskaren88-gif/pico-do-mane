'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { C, Card, Icone } from './ui';
import { todayISO, ymHoje, brl, MESES_LONGO } from '../lib/util';

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const WD3 = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const PESSOAS_PADRAO = [
  { id: 'mariele', nome: 'Mariele', cor: '#88937B' },
  { id: 'karen', nome: 'Karen', cor: '#9A7BA0' },
  { id: 'aurora', nome: 'Aurora', cor: '#D3A45C' },
];
const isoAdd = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function dataExtenso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${DIAS_SEMANA[new Date(y, m - 1, d).getDay()]}, ${d} de ${MESES_LONGO[m - 1].toLowerCase()}`;
}
function rotuloDia(iso, hoje) {
  if (iso === hoje) return 'hoje';
  if (iso === isoAdd(hoje, 1)) return 'amanhã';
  const [y, m, d] = iso.split('-').map(Number);
  return `${WD3[new Date(y, m - 1, d).getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

export default function Inicio({ usuario, onIr }) {
  const [casa, setCasa] = useState(null);
  const [lembretes, setLembretes] = useState([]);
  const [saldo, setSaldo] = useState(null);
  const [gastos, setGastos] = useState(null);
  const hoje = todayISO();

  const carregar = useCallback(async () => {
    try {
      const [rc, rl, rf] = await Promise.all([
        fetch('/api/casa', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
        fetch('/api/caderno', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
        fetch(`/api/lancamentos?mes=${ymHoje()}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
      ]);
      if (rc && rc.ok) setCasa(rc);
      if (rl && rl.ok) setLembretes(rl.lembretes || []);
      if (rf && rf.ok) {
        let d = 0, r = 0;
        for (const l of rf.lancamentos || []) { const v = Number(l.valor) || 0; if (l.tipo === 'receita') r += v; else d += v; }
        setSaldo(r - d); setGastos(d);
      }
    } catch {}
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const pessoas = (casa?.pessoas && casa.pessoas.length ? casa.pessoas : PESSOAS_PADRAO);
  const corDe = (pid) => (pessoas.find((p) => p.id === pid)?.cor || C.accent);

  // Agenda: tarefas com data (compartilhadas) + lembretes com data (seus), dos
  // próximos ~14 dias, sem os já feitos, em ordem de data/hora.
  const agenda = useMemo(() => {
    const ate = isoAdd(hoje, 14);
    const itens = [];
    for (const t of (casa?.tarefas || [])) {
      if (t.data && t.data >= hoje && t.data <= ate && (Number(t.feitos) || 0) < t.meta) {
        itens.push({ id: 't' + t.id, tipo: 'tarefa', titulo: t.titulo, data: t.data, hora: t.hora || '', cor: corDe(t.pessoa) });
      }
    }
    for (const l of lembretes) {
      if (l.data && l.data >= hoje && l.data <= ate && !l.feito) {
        itens.push({ id: 'l' + l.id, tipo: 'lembrete', titulo: l.texto, data: l.data, hora: '', cor: C.muted });
      }
    }
    itens.sort((a, b) => (a.data === b.data ? (a.hora || '99').localeCompare(b.hora || '99') : a.data.localeCompare(b.data)));
    return itens;
  }, [casa, lembretes, hoje]);

  // Números dos quadradinhos.
  const habitosHoje = useMemo(() => {
    const meus = (casa?.habitos || []).filter((h) => h.usuario === usuario.nome);
    const feitos = meus.filter((h) => (casa?.checkins || {})[`${h.id}|${hoje}`]).length;
    return { feitos, total: meus.length };
  }, [casa, usuario.nome, hoje]);
  const listaAbertos = (casa?.lista || []).filter((i) => !i.comprado).length;
  const tarefasAbertas = (casa?.tarefas || []).filter((t) => (Number(t.feitos) || 0) < t.meta).length;
  const lembretesDevidos = lembretes.filter((l) => !l.feito && l.data && l.data <= hoje).length;

  const tiles = [
    { id: 'financas', nome: 'Finanças', ico: 'wallet', cor: '#88937B', sub: saldo == null ? 'toque pra abrir' : `Saldo ${brl(saldo)}` },
    { id: 'habitos', nome: 'Hábitos', ico: 'flame', cor: '#C56B4E', sub: habitosHoje.total ? `${habitosHoje.feitos}/${habitosHoje.total} hoje` : 'toque pra abrir' },
    { id: 'lista', nome: 'Lista', ico: 'cart', cor: '#D3A45C', sub: listaAbertos ? `${listaAbertos} a comprar` : 'tudo em dia' },
    { id: 'tarefas', nome: 'Tarefas', ico: 'tasks', cor: '#9A7BA0', sub: tarefasAbertas ? `${tarefasAbertas} a fazer` : 'nada pendente' },
    { id: 'caderno', nome: 'Caderno', ico: 'book', cor: '#6E8CA0', sub: lembretesDevidos ? `${lembretesDevidos} lembrete${lembretesDevidos > 1 ? 's' : ''}` : 'só seu' },
  ];

  return (
    <div>
      {/* Agenda / calendário em cima */}
      <Card style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(136,147,123,0.30), rgba(110,140,160,0.18))', padding: '16px 16px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icone name="calendar" size={18} />
            <div style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: C.muted, fontWeight: 700 }}>Agenda</div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, textTransform: 'capitalize', marginTop: 4 }}>{dataExtenso(hoje)}</div>
        </div>
        <div style={{ padding: '6px 6px 8px' }}>
          {agenda.length === 0 ? (
            <div style={{ color: C.faint, fontSize: 14, textAlign: 'center', padding: '20px 12px' }}>Nada marcado por enquanto.<br />Marque uma tarefa com dia/hora que ela aparece aqui.</div>
          ) : agenda.slice(0, 6).map((it) => (
            <button key={it.id} onClick={() => onIr(it.tipo === 'tarefa' ? 'tarefas' : 'caderno')}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px', borderRadius: 12 }}>
              <span style={{ width: 4, alignSelf: 'stretch', minHeight: 30, borderRadius: 999, background: it.cor, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.titulo}</div>
                <div style={{ fontSize: 12, color: C.faint }}>{it.tipo === 'lembrete' ? 'lembrete' : 'tarefa'}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: it.data === hoje ? C.accent : C.muted, whiteSpace: 'nowrap', textAlign: 'right' }}>
                {rotuloDia(it.data, hoje)}{it.hora ? <div style={{ fontSize: 13, color: C.text }}>{it.hora}</div> : null}
              </div>
            </button>
          ))}
          {agenda.length > 6 && <div style={{ textAlign: 'center', fontSize: 12, color: C.muted, padding: '4px 0 8px' }}>e mais {agenda.length - 6}…</div>}
        </div>
      </Card>

      {/* Quadradinhos dos menus */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {tiles.map((t) => (
          <button key={t.id} onClick={() => onIr(t.id)}
            style={{ textAlign: 'left', cursor: 'pointer', background: C.glassBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${C.glassBorder}`, borderRadius: 16, padding: 15, boxShadow: C.glassShadow, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 104 }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, background: `${t.cor}26`, border: `1px solid ${t.cor}55`, color: t.cor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icone name={t.ico} size={22} /></span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{t.nome}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.sub}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
