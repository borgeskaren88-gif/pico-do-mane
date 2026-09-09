'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Select, Empty } from './ui';
import { num, todayISO, ymOf, fmtDate, mesLabel, uid } from '../lib/util';
import AreaVoz from './AreaVoz';

const CANAIS = ['Instagram', 'Google', 'TripAdvisor', 'Indicação', 'Passando na rua', 'Já é cliente', 'Outro'];
const vazio = () => ({ data: todayISO(), pessoas: '', origem: '', comoConheceu: 'Instagram', obs: '' });
const pes = (d) => (num(d.pessoas) > 0 ? num(d.pessoas) : 1); // sem número = ao menos 1 pessoa

export default function Visitantes({ dados = [], onChange }) {
  const [form, setForm] = useState(vazio());
  const [editId, setEditId] = useState(null);
  const [aberto, setAberto] = useState(false);
  // O bloco inteiro nasce fechado: no Log ele ficava comprido demais e empurrava
  // o resto da tela pra baixo. Fechado mostra só o título e o número do mês.
  const [expandido, setExpandido] = useState(false);
  const [historiaAberta, setHistoriaAberta] = useState({}); // { [id]: true }
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const salvar = () => {
    if (!form.origem.trim() && !form.obs.trim()) return; // precisa de ao menos origem ou história
    if (editId) onChange(dados.map((d) => (d.id === editId ? { ...form, id: editId } : d)));
    else onChange([{ ...form, id: uid() }, ...dados]);
    setForm(vazio()); setEditId(null); setAberto(false);
  };
  const editar = (d) => { setForm({ ...vazio(), ...d }); setEditId(d.id); setAberto(true); setExpandido(true); };
  const excluir = (id) => { if (id === editId) { setForm(vazio()); setEditId(null); } onChange(dados.filter((d) => d.id !== id)); };

  const resumo = useMemo(() => {
    const mesAtual = ymOf(todayISO());
    const doMes = dados.filter((d) => ymOf(d.data) === mesAtual);
    const pessoasMes = doMes.reduce((s, d) => s + pes(d), 0);
    const porCanal = {};
    for (const d of doMes) porCanal[d.comoConheceu || 'Outro'] = (porCanal[d.comoConheceu || 'Outro'] || 0) + pes(d);
    return { mesAtual, doMes, pessoasMes, porCanal };
  }, [dados]);

  const ordenado = [...dados].sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  return (
    <Card style={{
      marginBottom: 18,
      // Azul fraquinho pra o bloco saltar aos olhos no meio do Log — fechado
      // ele é só uma linha, e sem cor a dona passava direto.
      background: `color-mix(in srgb, ${C.accent} 9%, ${C.panel})`,
      borderColor: `color-mix(in srgb, ${C.accent} 38%, transparent)`,
    }}>
      {/* Só o título: toca e abre. */}
      <button onClick={() => setExpandido((v) => !v)} style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: C.accent, display: 'block' }}>Visitantes em destaque</span>
          <span style={{ fontSize: 12.5, color: C.muted, display: 'block', marginTop: 3 }}>
            {resumo.doMes.length > 0
              ? `${resumo.pessoasMes} pessoa(s) este mês · ${ordenado.length} registro(s) no total`
              : ordenado.length > 0 ? `${ordenado.length} registro(s) · nenhum este mês` : 'turistas, Instagram, histórias legais do bar'}
          </span>
        </span>
        <span style={{ color: C.accent, fontSize: 13, fontWeight: 900, flexShrink: 0 }}>{expandido ? '▾' : '▸'}</span>
      </button>

      {expandido && (
      <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Turistas, quem veio pelo Instagram, histórias legais de quem apareceu no bar.</div>

      {resumo.doMes.length > 0 && (
        <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '11px 12px', marginBottom: 14 }}>
          <div style={{ fontSize: 14 }}>
            <b style={{ color: C.accent }}>{resumo.pessoasMes}</b> visitante{resumo.pessoasMes > 1 ? 's' : ''} em destaque este mês
            <span style={{ color: C.faint }}> · {resumo.doMes.length} registro{resumo.doMes.length > 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {Object.entries(resumo.porCanal).sort((a, b) => b[1] - a[1]).map(([canal, n]) => (
              <span key={canal} style={{ fontSize: 12, fontWeight: 600, color: canal === 'Instagram' ? C.accent : C.muted, background: `${C.hair}`, borderRadius: 999, padding: '3px 9px' }}>
                {canal}: {n}
              </span>
            ))}
          </div>
        </div>
      )}

      {!aberto ? (
        <Btn kind="ghost" onClick={() => { setForm(vazio()); setEditId(null); setAberto(true); }}>+ Registrar visitante</Btn>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Data"><TextInput type="date" value={form.data} onChange={set('data')} /></Field>
            <Field label="Nº de pessoas"><NumInput value={form.pessoas} onChange={set('pessoas')} placeholder="1" /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="De onde vieram"><TextInput value={form.origem} onChange={set('origem')} placeholder="João Pessoa/PB…" /></Field>
            <Field label="Como conheceram"><Select value={form.comoConheceu} onChange={set('comoConheceu')} options={CANAIS} /></Field>
          </div>
          <Field label="História / observação"><AreaVoz value={form.obs} onChange={set('obs')} placeholder="De passagem por Floripa, viram no Instagram e o Pico foi o 1º lugar que visitaram na cidade." /></Field>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={salvar}>{editId ? 'Salvar' : 'Registrar'}</Btn>
            <Btn kind="ghost" onClick={() => { setForm(vazio()); setEditId(null); setAberto(false); }}>Cancelar</Btn>
          </div>
        </div>
      )}

      {ordenado.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {ordenado.slice(0, 12).map((d) => (
            <div key={d.id} style={{ borderTop: `1px solid ${C.line}`, padding: '11px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <div style={{ fontWeight: 700, fontSize: 14, minWidth: 0 }}>
                  {d.origem || 'Visitante'}
                  <span style={{ fontSize: 12, color: C.faint, fontWeight: 400 }}> · {pes(d)} pessoa{pes(d) > 1 ? 's' : ''} · {fmtDate(d.data)}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: d.comoConheceu === 'Instagram' ? C.accent : C.muted, background: `${C.hair}`, borderRadius: 999, padding: '2px 8px', flexShrink: 0, whiteSpace: 'nowrap' }}>{d.comoConheceu || 'Outro'}</span>
              </div>
              {/* A história fica guardada: toca no registro pra ler. Assim a
                  lista continua curta mesmo com muita gente anotada. */}
              <button onClick={() => setHistoriaAberta((m) => ({ ...m, [d.id]: !m[d.id] }))} style={{ background: 'none', border: 'none', padding: '4px 0 0', cursor: 'pointer', color: C.accent, fontSize: 12, fontWeight: 700 }}>
                {historiaAberta[d.id] ? 'ocultar' : (d.obs ? 'ver a história' : 'abrir')}
              </button>
              {historiaAberta[d.id] && (
                <>
                  {d.obs && <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{d.obs}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <Btn kind="ghost" small onClick={() => editar(d)}>Editar</Btn>
                    <Btn kind="danger" small onClick={() => excluir(d.id)}>Excluir</Btn>
                  </div>
                </>
              )}
            </div>
          ))}
          {ordenado.length > 12 && <div style={{ fontSize: 12, color: C.faint, textAlign: 'center', marginTop: 8 }}>Mostrando os 12 mais recentes de {ordenado.length}.</div>}
        </div>
      )}

      {ordenado.length === 0 && !aberto && (
        <div style={{ fontSize: 13, color: C.faint, marginTop: 12 }}>Nenhum visitante registrado ainda.</div>
      )}
      </div>
      )}
    </Card>
  );
}
