'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { C, Card, Label, Empty, SecTitle, inputStyle, Icone } from './ui';
import { CORES_HABITO, todayISO, ymHoje, mesLabel, passoMes, fmtDate } from '../lib/util';

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// Monta a grade do mês (com "buracos" antes do dia 1 pra alinhar na semana).
function diasDoMes(ym) {
  const [y, m] = ym.split('-').map(Number);
  const inicioSemana = new Date(y, m - 1, 1).getDay(); // 0 = domingo
  const total = new Date(y, m, 0).getDate();
  const out = [];
  for (let i = 0; i < inicioSemana; i++) out.push(null);
  for (let d = 1; d <= total; d++) out.push(`${ym}-${String(d).padStart(2, '0')}`);
  return out;
}

export default function Habitos({ usuario }) {
  const [habitos, setHabitos] = useState([]);
  const [checkins, setCheckins] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [nome, setNome] = useState('');
  const [corSel, setCorSel] = useState(CORES_HABITO[0]);
  const [salvando, setSalvando] = useState(false);
  const [mes, setMes] = useState(ymHoje());
  const [diaSel, setDiaSel] = useState(todayISO());

  const aplicar = (j) => { if (j && j.ok) { setHabitos(j.habitos || []); setCheckins(j.checkins || {}); } };

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try {
      const r = await fetch('/api/casa', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) aplicar(j); else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Não consegui conectar.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const acao = async (payload) => {
    try {
      const r = await fetch('/api/casa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (j.ok) aplicar(j); else setErro(j.erro || 'Erro.');
      return j;
    } catch { setErro('Sem conexão.'); return { ok: false }; }
  };

  const trocarMes = (delta) => {
    const novo = passoMes(mes, delta);
    setMes(novo);
    setDiaSel(novo === ymHoje() ? todayISO() : `${novo}-01`);
  };

  const adicionar = async (e) => {
    e.preventDefault();
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    await acao({ acao: 'habitoAdd', nome: nome.trim(), cor: corSel });
    setNome(''); setSalvando(false);
  };
  const apagar = (id) => { if (window.confirm('Apagar este hábito? (isso remove o histórico dele)')) acao({ acao: 'habitoDel', id }); };
  const marcar = (habitoId, dia, feito) => acao({ acao: 'checkin', habitoId, data: dia, feito });
  const trocarCor = (h) => {
    const i = CORES_HABITO.indexOf(h.cor);
    const prox = CORES_HABITO[(i + 1) % CORES_HABITO.length];
    acao({ acao: 'habitoCor', id: h.id, cor: prox });
  };

  // Cor garantida por hábito (fallback pra hábitos antigos sem cor).
  const corDe = useMemo(() => {
    const m = {};
    habitos.forEach((h, i) => { m[h.id] = CORES_HABITO.includes(h.cor) ? h.cor : CORES_HABITO[i % CORES_HABITO.length]; });
    return m;
  }, [habitos]);

  // Agrupa por pessoa: os seus primeiro.
  const grupos = useMemo(() => {
    const porPessoa = new Map();
    for (const h of habitos) { if (!porPessoa.has(h.usuario)) porPessoa.set(h.usuario, []); porPessoa.get(h.usuario).push(h); }
    const nomes = [...porPessoa.keys()].sort((a, b) => (a === usuario.nome ? -1 : b === usuario.nome ? 1 : a.localeCompare(b)));
    return nomes.map((n) => ({ pessoa: n, eu: n === usuario.nome, itens: porPessoa.get(n) }));
  }, [habitos, usuario.nome]);

  const meus = useMemo(() => habitos.filter((h) => h.usuario === usuario.nome), [habitos, usuario.nome]);

  return (
    <div>
      {/* Navegação de mês */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
        <button onClick={() => trocarMes(-1)} style={navBtn}>‹</button>
        <div style={{ textAlign: 'center', flex: 1, fontSize: 16, fontWeight: 700, textTransform: 'capitalize' }}>{mesLabel(mes)}</div>
        <button onClick={() => trocarMes(1)} style={navBtn}>›</button>
      </div>

      {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{erro}</div>}

      {carregando ? <Empty>Carregando…</Empty> : (
        <>
          {/* ===== Seus hábitos ===== */}
          <SecTitle>Seus hábitos</SecTitle>
          <Estatisticas habitos={meus} checkins={checkins} mes={mes} />
          <Calendario mes={mes} habitos={meus} checkins={checkins} corDe={corDe} diaSel={diaSel} onDia={setDiaSel} />

          {/* Marcar hábitos do dia selecionado */}
          <Card style={{ marginTop: 12, marginBottom: 12 }}>
            <Label>{diaSel === todayISO() ? 'Marcar hoje' : `Marcar em ${fmtDate(diaSel)}`}</Label>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {meus.length === 0 ? (
                <div style={{ color: C.faint, fontSize: 13 }}>Você ainda não tem hábitos. Crie um ali embaixo.</div>
              ) : meus.map((h) => {
                const feito = !!checkins[`${h.id}|${diaSel}`];
                return (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => trocarCor(h)} title="Trocar a cor" style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0, border: 'none', cursor: 'pointer', background: corDe[h.id], boxShadow: '0 0 0 2px rgba(255,255,255,0.15)' }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.nome}</span>
                    <button onClick={() => apagar(h.id)} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '4px 6px' }}>apagar</button>
                    <button onClick={() => marcar(h.id, diaSel, !feito)} title={feito ? 'Desmarcar' : 'Marcar'}
                      style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, cursor: 'pointer', border: `2px solid ${feito ? corDe[h.id] : C.line}`, background: feito ? corDe[h.id] : 'transparent', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {feito ? <Icone name="check" size={20} /> : ''}
                    </button>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 10 }}>Toque na bolinha pra trocar a cor. Toque num dia no calendário pra marcar em outra data.</div>
          </Card>

          {/* Adicionar hábito */}
          <Card style={{ marginBottom: 18 }}>
            <Label>Novo hábito seu</Label>
            <form onSubmit={adicionar} style={{ marginTop: 8 }}>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Beber 2L de água, Academia, Ler 10min" style={inputStyle} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
                {CORES_HABITO.map((c) => (
                  <button type="button" key={c} onClick={() => setCorSel(c)} title="Escolher cor"
                    style={{ width: 30, height: 30, borderRadius: 999, cursor: 'pointer', background: c, border: 'none', boxShadow: corSel === c ? `0 0 0 3px ${C.text}` : '0 0 0 2px rgba(255,255,255,0.15)' }} />
                ))}
              </div>
              <button type="submit" disabled={salvando} style={{ width: '100%', background: C.accent, color: C.onAccent, border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 15, fontWeight: 700, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.7 : 1 }}>
                {salvando ? 'Adicionando…' : '+ Adicionar hábito'}
              </button>
            </form>
          </Card>

          {/* ===== Hábitos da outra pessoa (só ver) ===== */}
          {grupos.filter((g) => !g.eu).map((g) => (
            <div key={g.pessoa} style={{ marginBottom: 18 }}>
              <SecTitle>Hábitos de {g.pessoa}</SecTitle>
              <Estatisticas habitos={g.itens} checkins={checkins} mes={mes} />
              <Calendario mes={mes} habitos={g.itens} checkins={checkins} corDe={corDe} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10, padding: '0 2px' }}>
                {g.itens.map((h) => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 999, background: corDe[h.id] }} />
                    <span style={{ color: C.muted }}>{h.nome}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// Contadores do mês: dias ativos, dias perfeitos, total de hábitos.
function Estatisticas({ habitos, checkins, mes }) {
  const { ativos, perfeitos } = useMemo(() => {
    const dias = diasDoMes(mes).filter(Boolean);
    let ativos = 0, perfeitos = 0;
    for (const dia of dias) {
      const feitos = habitos.filter((h) => checkins[`${h.id}|${dia}`]).length;
      if (feitos > 0) ativos += 1;
      if (habitos.length > 0 && feitos === habitos.length) perfeitos += 1;
    }
    return { ativos, perfeitos };
  }, [habitos, checkins, mes]);
  const item = (n, rot, cor) => (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: cor }}>{n}</div>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{rot}</div>
    </div>
  );
  return (
    <Card style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
      {item(ativos, 'Dias ativos', C.amber)}
      {item(perfeitos, 'Dias perfeitos', C.green)}
      {item(habitos.length, 'Total hábitos', C.text)}
    </Card>
  );
}

// Calendário mensal com bolinhas coloridas por hábito concluído no dia.
function Calendario({ mes, habitos, checkins, corDe, diaSel, onDia }) {
  const dias = useMemo(() => diasDoMes(mes), [mes]);
  const hoje = todayISO();
  const editavel = typeof onDia === 'function';
  return (
    <Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 11, color: C.faint, fontWeight: 700, paddingBottom: 4 }}>{d}</div>
        ))}
        {dias.map((iso, i) => {
          if (!iso) return <div key={`b${i}`} />;
          const feitosCores = habitos.filter((h) => checkins[`${h.id}|${iso}`]).map((h) => corDe[h.id]);
          const ehHoje = iso === hoje;
          const selec = iso === diaSel;
          const perfeito = habitos.length > 0 && feitosCores.length === habitos.length;
          const num = Number(iso.slice(8));
          return (
            <button key={iso} onClick={() => editavel && onDia(iso)} disabled={!editavel}
              style={{
                aspectRatio: '1', borderRadius: 10, cursor: editavel ? 'pointer' : 'default', padding: 2,
                border: `1.5px solid ${ehHoje ? C.accent : perfeito ? C.green : 'transparent'}`,
                background: selec ? 'rgba(160,150,130,0.18)' : 'transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              }}>
              <span style={{ fontSize: 13, fontWeight: ehHoje ? 800 : 500, color: C.text }}>{num}</span>
              <span style={{ display: 'flex', gap: 2, height: 6, alignItems: 'center' }}>
                {feitosCores.slice(0, 4).map((c, k) => (
                  <span key={k} style={{ width: 6, height: 6, borderRadius: 999, background: c }} />
                ))}
                {feitosCores.length > 4 && <span style={{ fontSize: 8, color: C.muted }}>+</span>}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

const navBtn = {
  width: 40, height: 40, borderRadius: 10, border: `1px solid ${C.line}`, background: C.panel2,
  color: C.text, cursor: 'pointer', fontSize: 22, lineHeight: 1, flexShrink: 0,
};
