'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { C, Card, Label, Empty, SecTitle, inputStyle, Icone } from './ui';
import { CORES_HABITO, todayISO, ymHoje, mesLabel, passoMes, fmtDate } from '../lib/util';

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const WD3 = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const isoAdd = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const wd3De = (iso) => WD3[new Date(iso + 'T12:00:00').getDay()];

function diasDoMes(ym) {
  const [y, m] = ym.split('-').map(Number);
  const inicio = new Date(y, m - 1, 1).getDay();
  const total = new Date(y, m, 0).getDate();
  const out = [];
  for (let i = 0; i < inicio; i++) out.push(null);
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

  const adicionar = async (e) => {
    e.preventDefault();
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    await acao({ acao: 'habitoAdd', nome: nome.trim(), cor: corSel });
    setNome(''); setSalvando(false);
  };
  const apagar = (id) => { if (window.confirm('Apagar este hábito? (isso remove o histórico dele)')) acao({ acao: 'habitoDel', id }); };
  const marcar = (habitoId, dia, feito) => acao({ acao: 'checkin', habitoId, data: dia, feito });
  const trocarCor = (h) => acao({ acao: 'habitoCor', id: h.id, cor: CORES_HABITO[(CORES_HABITO.indexOf(h.cor) + 1) % CORES_HABITO.length] });

  const corDe = useMemo(() => {
    const m = {};
    habitos.forEach((h, i) => { m[h.id] = CORES_HABITO.includes(h.cor) ? h.cor : CORES_HABITO[i % CORES_HABITO.length]; });
    return m;
  }, [habitos]);

  const grupos = useMemo(() => {
    const porPessoa = new Map();
    for (const h of habitos) { if (!porPessoa.has(h.usuario)) porPessoa.set(h.usuario, []); porPessoa.get(h.usuario).push(h); }
    const nomes = [...porPessoa.keys()].sort((a, b) => (a === usuario.nome ? -1 : b === usuario.nome ? 1 : a.localeCompare(b)));
    return nomes.map((n) => ({ pessoa: n, eu: n === usuario.nome, itens: porPessoa.get(n) }));
  }, [habitos, usuario.nome]);

  const meus = useMemo(() => habitos.filter((h) => h.usuario === usuario.nome), [habitos, usuario.nome]);
  const hoje = todayISO();
  const feitosNo = useCallback((dia, hset) => hset.filter((h) => checkins[`${h.id}|${dia}`]).length, [checkins]);

  return (
    <div>
      {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{erro}</div>}
      {carregando ? <Empty>Carregando…</Empty> : (
        <>
          {/* ===== Marcar hábitos do dia (Hoje) ===== */}
          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button onClick={() => setDiaSel(isoAdd(diaSel, -1))} style={miniNav}>‹</button>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{diaSel === hoje ? 'Hoje' : fmtDate(diaSel)}</div>
              <button onClick={() => setDiaSel(diaSel < hoje ? isoAdd(diaSel, 1) : diaSel)} style={{ ...miniNav, opacity: diaSel < hoje ? 1 : 0.35 }}>›</button>
            </div>
            {meus.length === 0 ? (
              <div style={{ color: C.faint, fontSize: 13, textAlign: 'center', padding: '8px 0' }}>Crie seu primeiro hábito ali embaixo.</div>
            ) : (
              <>
                <ProgressoDia feitos={feitosNo(diaSel, meus)} total={meus.length} />
                <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4, marginTop: 14 }}>
                  {meus.map((h) => {
                    const feito = !!checkins[`${h.id}|${diaSel}`];
                    const cor = corDe[h.id];
                    return (
                      <div key={h.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 62 }}>
                        <button onClick={() => marcar(h.id, diaSel, !feito)} title={feito ? 'Desmarcar' : 'Marcar'}
                          style={{ width: 58, height: 58, borderRadius: 999, cursor: 'pointer', border: `2px solid ${cor}`, background: feito ? cor : 'transparent', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {feito ? <Icone name="check" size={26} /> : <span style={{ width: 14, height: 14, borderRadius: 999, background: cor }} />}
                        </button>
                        <span style={{ fontSize: 11, color: C.muted, maxWidth: 62, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.nome}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: C.faint, marginTop: 8 }}>Toque no círculo pra registrar. Use ‹ › pra outro dia.</div>
              </>
            )}
          </Card>

          {/* ===== Esta semana ===== */}
          {meus.length > 0 && <EstaSemana meus={meus} feitosNo={feitosNo} hoje={hoje} />}

          {/* ===== Sequência + contadores ===== */}
          {meus.length > 0 && <Sequencia meus={meus} checkins={checkins} feitosNo={feitosNo} hoje={hoje} />}

          {/* ===== Calendário mensal ===== */}
          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button onClick={() => setMes(passoMes(mes, -1))} style={miniNav}>‹</button>
              <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'capitalize' }}>{mesLabel(mes)}</div>
              <button onClick={() => setMes(passoMes(mes, 1))} style={miniNav}>›</button>
            </div>
            <EstatLinhaMes habitos={meus} feitosNo={feitosNo} mes={mes} />
            <Grade mes={mes} habitos={meus} feitosNo={feitosNo} corDe={corDe} diaSel={diaSel} onDia={setDiaSel} hoje={hoje} />
          </Card>

          {/* ===== Adicionar hábito ===== */}
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
            {meus.length > 0 && (
              <div style={{ marginTop: 16, borderTop: `1px solid ${C.hair}`, paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: C.faint, marginBottom: 8 }}>Seus hábitos — toque na bolinha pra trocar a cor:</div>
                {meus.map((h) => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                    <button onClick={() => trocarCor(h)} title="Trocar a cor" style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0, border: 'none', cursor: 'pointer', background: corDe[h.id], boxShadow: '0 0 0 2px rgba(255,255,255,0.15)' }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.nome}</span>
                    <button onClick={() => apagar(h.id)} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '4px 6px' }}>apagar</button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ===== Hábitos da outra pessoa (ver) ===== */}
          {grupos.filter((g) => !g.eu).map((g) => (
            <div key={g.pessoa} style={{ marginBottom: 18 }}>
              <SecTitle>Hábitos de {g.pessoa}</SecTitle>
              <Card>
                <div style={{ marginBottom: 12 }}><EstatLinhaMes habitos={g.itens} feitosNo={feitosNo} mes={mes} /></div>
                <Grade mes={mes} habitos={g.itens} feitosNo={feitosNo} corDe={corDe} hoje={hoje} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
                  {g.itens.map((h) => (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 999, background: corDe[h.id] }} />
                      <span style={{ color: C.muted }}>{h.nome}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function ProgressoDia({ feitos, total }) {
  const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{feitos}/{total} completados</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: pct >= 100 ? C.green : C.accent }}>{pct}%</span>
      </div>
      <div style={{ height: 8, background: 'rgba(160,150,130,0.18)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? C.green : C.accent, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function EstaSemana({ meus, feitosNo, hoje }) {
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => isoAdd(hoje, -(6 - i))), [hoje]);
  const pcts = dias.map((d) => (meus.length ? Math.round((feitosNo(d, meus) / meus.length) * 100) : 0));
  const media = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
  const cor = (p) => (p >= 60 ? C.green : p >= 40 ? C.amber : C.faint);
  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Label>Esta semana</Label>
        <div style={{ fontSize: 13, color: C.muted }}>Média <b style={{ color: cor(media), fontSize: 15 }}>{media}%</b></div>
      </div>
      <div style={{ display: 'flex', gap: 8, height: 92 }}>
        {dias.map((d, i) => (
          <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '100%', height: `${Math.max(6, pcts[i])}%`, background: cor(pcts[i]), borderRadius: 6, opacity: pcts[i] === 0 ? 0.35 : 1 }} />
            </div>
            <span style={{ fontSize: 10, color: d === hoje ? C.accent : C.faint, fontWeight: d === hoje ? 800 : 500 }}>{wd3De(d)}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12, fontSize: 11, color: C.muted }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: C.green, marginRight: 5 }} />60%+ Ótimo</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: C.amber, marginRight: 5 }} />40–60% Bom</span>
      </div>
    </Card>
  );
}

function Sequencia({ meus, checkins, feitosNo, hoje }) {
  const seq = useMemo(() => {
    let cur = feitosNo(hoje, meus) > 0 ? hoje : isoAdd(hoje, -1);
    let s = 0;
    while (feitosNo(cur, meus) > 0) { s += 1; cur = isoAdd(cur, -1); }
    return s;
  }, [meus, feitosNo, hoje]);
  const stats = useMemo(() => {
    const ids = new Set(meus.map((h) => h.id));
    const dayMap = {}; let checks = 0;
    for (const k in checkins) {
      if (!checkins[k]) continue;
      const [id, dia] = k.split('|');
      if (!ids.has(id)) continue;
      checks += 1; dayMap[dia] = (dayMap[dia] || 0) + 1;
    }
    let ativos = 0, perfeitos = 0;
    for (const d in dayMap) { if (dayMap[d] > 0) ativos += 1; if (meus.length > 0 && dayMap[d] === meus.length) perfeitos += 1; }
    return { checks, ativos, perfeitos };
  }, [checkins, meus]);
  const cont = (n, r) => (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#2A1D16' }}>{n}</div>
      <div style={{ fontSize: 11, color: '#5A4632', fontWeight: 600 }}>{r}</div>
    </div>
  );
  return (
    <div style={{ borderRadius: 16, padding: 18, marginBottom: 12, background: 'linear-gradient(135deg, #D9B06A 0%, #C0794D 100%)', boxShadow: '0 10px 32px rgba(0,0,0,0.22)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 56, height: 56, borderRadius: 999, background: 'rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A3B1E' }}>
          <Icone name="flame" size={30} />
        </div>
        <div>
          <div style={{ fontSize: 13, color: '#5A4632', fontWeight: 600 }}>Sequência atual</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#2A1D16', lineHeight: 1.1 }}>{seq} <span style={{ fontSize: 16, fontWeight: 700 }}>dias</span></div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(90,70,50,0.25)' }}>
        {cont(stats.ativos, 'Dias ativos')}
        {cont(stats.perfeitos, 'Dias perfeitos')}
        {cont(stats.checks, 'Checks')}
      </div>
    </div>
  );
}

function EstatLinhaMes({ habitos, feitosNo, mes }) {
  const { ativos, perfeitos } = useMemo(() => {
    const dias = diasDoMes(mes).filter(Boolean);
    let ativos = 0, perfeitos = 0;
    for (const dia of dias) {
      const f = feitosNo(dia, habitos);
      if (f > 0) ativos += 1;
      if (habitos.length > 0 && f === habitos.length) perfeitos += 1;
    }
    return { ativos, perfeitos };
  }, [habitos, feitosNo, mes]);
  const item = (n, r, cor) => (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: cor }}>{n}</div>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>{r}</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      {item(ativos, 'Dias ativos', C.amber)}
      {item(perfeitos, 'Dias perfeitos', C.green)}
      {item(habitos.length, 'Total hábitos', C.text)}
    </div>
  );
}

function Grade({ mes, habitos, feitosNo, corDe, diaSel, onDia, hoje }) {
  const dias = useMemo(() => diasDoMes(mes), [mes]);
  const editavel = typeof onDia === 'function';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
      {DIAS_SEMANA.map((d, i) => (
        <div key={i} style={{ textAlign: 'center', fontSize: 11, color: C.faint, fontWeight: 700, paddingBottom: 4 }}>{d}</div>
      ))}
      {dias.map((iso, i) => {
        if (!iso) return <div key={`b${i}`} />;
        const cores = habitos.filter((h) => checkinAtivo(h, iso, feitosNo)).map((h) => corDe[h.id]);
        const ehHoje = iso === hoje;
        const selec = iso === diaSel;
        const perfeito = habitos.length > 0 && cores.length === habitos.length;
        return (
          <button key={iso} onClick={() => editavel && onDia(iso)} disabled={!editavel}
            style={{
              aspectRatio: '1', borderRadius: 10, cursor: editavel ? 'pointer' : 'default', padding: 2,
              border: `1.5px solid ${ehHoje ? C.accent : perfeito ? C.green : 'transparent'}`,
              background: selec ? 'rgba(160,150,130,0.18)' : 'transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
            }}>
            <span style={{ fontSize: 13, fontWeight: ehHoje ? 800 : 500, color: C.text }}>{Number(iso.slice(8))}</span>
            <span style={{ display: 'flex', gap: 2, height: 6, alignItems: 'center' }}>
              {cores.slice(0, 4).map((c, k) => <span key={k} style={{ width: 6, height: 6, borderRadius: 999, background: c }} />)}
              {cores.length > 4 && <span style={{ fontSize: 8, color: C.muted }}>+</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Um hábito está "feito" no dia? (usa o mesmo mapa de checkins via feitosNo por hábito único)
function checkinAtivo(h, iso, feitosNo) { return feitosNo(iso, [h]) > 0; }

const miniNav = {
  width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.line}`, background: C.panel2,
  color: C.text, cursor: 'pointer', fontSize: 20, lineHeight: 1, flexShrink: 0,
};
