'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, NumInput, Field } from './ui';
import { brl, num, ymOf, todayISO, mesLabel } from '../lib/util';
import { calcularMeta, diasSemanaDoMovimento } from '../lib/meta';

const TAB = { fontVariantNumeric: 'tabular-nums' };
const DIAS = [['D', 0], ['S', 1], ['T', 2], ['Q', 3], ['Q', 4], ['S', 5], ['S', 6]];
const NOMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// Cor e recado de cada estado. O verde não é decoração: é a resposta à única
// pergunta que ela faz olhando o Dashboard — "estou bem ou estou mal?".
const ESTADOS = {
  'sem-meta': { cor: C.faint, titulo: '' },
  comecando: { cor: C.accent, titulo: 'Mês começando' },
  adiantada: { cor: C.green, titulo: 'Adiantada' },
  'no-ritmo': { cor: C.green, titulo: 'No ritmo' },
  atras: { cor: C.amber, titulo: 'Um pouco atrás' },
  'muito-atras': { cor: C.red, titulo: 'Atrás do ritmo' },
  bateu: { cor: C.green, titulo: 'Meta batida' },
  'fechou-abaixo': { cor: C.red, titulo: 'Mês fechou abaixo' },
};

export default function MetaMes({ metas, receitas = [], realizado = 0, oculto = (t) => t, onSalvar }) {
  const hoje = todayISO();
  const mes = ymOf(hoje);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  const [soEsteMes, setSoEsteMes] = useState(false);
  const [dias, setDias] = useState(null);

  // O caixa do dia é lançado no fim da noite. Enquanto não for, hoje não conta
  // como dia já vendido — senão a tela acusaria atraso às dez da manhã.
  const temReceitaHoje = useMemo(
    () => receitas.some((r) => r && r.data === hoje && num(r.valor) > 0),
    [receitas, hoje],
  );
  const m = useMemo(
    () => calcularMeta({ metas, realizado, ym: mes, hoje, temReceitaHoje }),
    [metas, realizado, mes, hoje, temReceitaHoje],
  );
  const est = ESTADOS[m.estado] || ESTADOS.comecando;

  const abrir = () => {
    setValor(m.meta > 0 ? String(m.meta).replace('.', ',') : '');
    setSoEsteMes(metas && metas[mes] !== undefined && String(metas[mes]).trim() !== '');
    setDias(Array.isArray(metas?.diasSemana) && metas.diasSemana.length ? [...metas.diasSemana] : [0, 1, 2, 3, 4, 5, 6]);
    setEditando(true);
  };
  const salvar = () => {
    const v = num(valor);
    const novo = { ...(metas || {}) };
    if (soEsteMes) novo[mes] = v > 0 ? String(v) : '';
    else { novo.padrao = v > 0 ? String(v) : ''; delete novo[mes]; }
    novo.diasSemana = (dias && dias.length && dias.length < 7) ? [...dias].sort((a, b) => a - b) : null;
    onSalvar(novo);
    setEditando(false);
  };
  const usarMovimento = () => {
    const d = diasSemanaDoMovimento(receitas, hoje);
    if (d && d.length) setDias(d);
  };
  const alternar = (d) => setDias((atual) => {
    const s = new Set(atual || []);
    if (s.has(d)) s.delete(d); else s.add(d);
    return [...s];
  });

  if (editando) {
    const sug = diasSemanaDoMovimento(receitas, hoje);
    return (
      <Card style={{ marginBottom: 14, borderColor: C.accent }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>Minha meta</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
          Quanto tu queres faturar num mês. O PicoOS reparte isso pelos dias em que o bar abre e
          te diz, todo dia, quanto falta.
        </div>
        <Field label="Meta de faturamento no mês (R$)">
          <NumInput value={valor} onChange={setValor} placeholder="ex: 40000" />
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '-4px 0 14px', fontSize: 13, color: C.muted, cursor: 'pointer' }}>
          <input type="checkbox" checked={soEsteMes} onChange={(e) => setSoEsteMes(e.target.checked)} style={{ width: 16, height: 16, accentColor: C.accent }} />
          Vale só para {mesLabel(mes)} (senão vale todo mês)
        </label>

        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 7, lineHeight: 1.45 }}>
          Em que dias o bar abre? É por aí que a meta é repartida — contar os dias fechados daria
          um alvo diário que não existe.
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {DIAS.map(([rot, d]) => {
            const on = (dias || []).includes(d);
            return (
              <button key={d} onClick={() => alternar(d)} title={NOMES[d]} aria-label={NOMES[d]} aria-pressed={on}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 800,
                  background: on ? C.accent : 'transparent', color: on ? '#06101F' : C.muted,
                  border: `1px solid ${on ? C.accent : C.line}`,
                }}>{rot}</button>
            );
          })}
        </div>
        {sug && sug.length > 0 && sug.length < 7 && (
          <button onClick={usarMovimento} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '2px 0', marginBottom: 12, textAlign: 'left' }}>
            Pelos últimos 90 dias tu abres {sug.map((d) => NOMES[d]).join(', ')} — usar isso
          </button>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <Btn onClick={salvar}>Salvar meta</Btn>
          <Btn kind="ghost" onClick={() => setEditando(false)}>Cancelar</Btn>
        </div>
      </Card>
    );
  }

  // SEM META: convida, e não inventa número nenhum.
  if (m.semMeta) {
    return (
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Define tua meta do mês</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 3, lineHeight: 1.45 }}>
              Aí o Dashboard te diz todo dia quanto falta e quanto precisa por noite pra chegar lá.
            </div>
          </div>
          <Btn small onClick={abrir}>Definir meta</Btn>
        </div>
      </Card>
    );
  }

  const pctBarra = Math.max(0, Math.min(1, m.pct));
  const pctLinha = m.diasTotais > 0 ? Math.max(0, Math.min(1, m.diasDecorridos / m.diasTotais)) : 0;

  return (
    <Card style={{ marginBottom: 14, borderColor: `${est.cor}66` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 700 }}>
          Meta · {mesLabel(mes)}
        </div>
        <button onClick={abrir} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 2, flexShrink: 0 }}>editar</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: est.cor, lineHeight: 1.1, ...TAB }}>{oculto(brl(m.realizado))}</div>
        <div style={{ fontSize: 14, color: C.muted, ...TAB }}>de {oculto(brl(m.meta))}</div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: est.cor, marginTop: 2 }}>
        {est.titulo}{m.meta > 0 && m.estado !== 'sem-meta' ? ` · ${Math.round(m.pct * 100)}% da meta` : ''}
      </div>

      {/* A barra, com um risco em "onde o mês já está". Estar com a barra à
          frente do risco é estar adiantada — sem precisar entender a conta. */}
      <div style={{ position: 'relative', height: 10, borderRadius: 999, background: C.panel2, border: `1px solid ${C.hair}`, margin: '12px 0 4px', overflow: 'hidden' }}>
        <i style={{ display: 'block', height: '100%', width: `${pctBarra * 100}%`, background: est.cor, borderRadius: 999 }} />
        {pctLinha > 0 && pctLinha < 1 && (
          <i style={{ position: 'absolute', top: -2, bottom: -2, left: `${pctLinha * 100}%`, width: 2, background: C.text, opacity: 0.55 }} title="onde o mês já está" />
        )}
      </div>
      <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 12 }}>
        {m.diasDecorridos} de {m.diasTotais} dias de operação · o risco é onde o mês já está
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: C.faint, textTransform: 'uppercase', letterSpacing: '.05em' }}>Falta</div>
          <div style={{ fontSize: 16, fontWeight: 800, ...TAB }}>{oculto(brl(m.falta))}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.faint, textTransform: 'uppercase', letterSpacing: '.05em' }}>Por noite</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: m.porDia > 0 ? est.cor : C.faint, ...TAB }}>
            {m.diasRestantes > 0 ? oculto(brl(m.porDia)) : '—'}
          </div>
          <div style={{ fontSize: 11, color: C.faint }}>{m.diasRestantes > 0 ? `nas ${m.diasRestantes} que faltam` : 'mês encerrado'}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.faint, textTransform: 'uppercase', letterSpacing: '.05em' }}>Fecha em</div>
          <div style={{ fontSize: 16, fontWeight: 800, ...TAB }}>{m.projecao > 0 ? oculto(brl(m.projecao)) : '—'}</div>
          <div style={{ fontSize: 11, color: C.faint }}>{m.projecao > 0 ? `${Math.round(m.pctProjecao * 100)}% da meta` : 'sem ritmo ainda'}</div>
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: C.muted, marginTop: 12, lineHeight: 1.5, borderTop: `1px solid ${C.hair}`, paddingTop: 10 }}>
        {m.bateu ? (
          <>Bateste a meta de {mesLabel(mes)} — <b style={{ color: C.green }}>{oculto(brl(m.sobrou))}</b> acima. O que vier agora é a mais.</>
        ) : m.diasRestantes <= 0 ? (
          <>{mesLabel(mes)} fechou <b style={{ color: C.red }}>{oculto(brl(m.falta))}</b> abaixo da meta.</>
        ) : m.diasDecorridos === 0 ? (
          <>Mês novo: <b>{oculto(brl(m.porDia))}</b> por noite nas {m.diasRestantes} noites de {mesLabel(mes)} e tu chegas lá.</>
        ) : (
          <>
            Tua média é <b>{oculto(brl(m.media))}</b> por noite; pra bater a meta precisa de{' '}
            <b style={{ color: est.cor }}>{oculto(brl(m.porDia))}</b> nas {m.diasRestantes} que faltam.
            {m.porDia > m.media * 1.3 && <> É bem acima do teu ritmo — ou tu aumentas o movimento, ou essa meta não é desse mês.</>}
          </>
        )}
      </div>
    </Card>
  );
}
