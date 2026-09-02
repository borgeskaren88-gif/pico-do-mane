'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { C, Card, Field, Label, inputStyle, Empty, KPI } from './ui';
import {
  brl, num, todayISO, ymHoje, mesLabel, passoMes, fmtDate,
  CATEGORIAS_DESPESA, CATEGORIAS_RECEITA,
} from '../lib/util';

export default function Financas({ usuario, tema = 'escuro' }) {
  const [mes, setMes] = useState(ymHoje());
  const [lancamentos, setLancamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // Formulário
  const [tipo, setTipo] = useState('despesa');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(todayISO());
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async (ym) => {
    setCarregando(true);
    setErro('');
    try {
      const res = await fetch(`/api/lancamentos?mes=${ym}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) setLancamentos(json.lancamentos);
      else setErro(json.erro || 'Erro ao carregar.');
    } catch {
      setErro('Não consegui conectar ao servidor.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(mes); }, [mes, carregar]);

  const categorias = tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;

  const adicionar = async (e) => {
    e.preventDefault();
    const v = num(valor);
    if (!(v > 0)) { setErro('Digite um valor maior que zero.'); return; }
    setSalvando(true);
    setErro('');
    try {
      const res = await fetch('/api/lancamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, valor: v, categoria: categoria || 'Outros', descricao, data }),
      });
      const json = await res.json();
      if (!json.ok) { setErro(json.erro || 'Erro ao salvar.'); return; }
      // Limpa o formulário mantendo tipo e data.
      setValor(''); setCategoria(''); setDescricao('');
      // Recarrega o mês do lançamento (caso a data seja de outro mês).
      const ymNovo = (data || '').slice(0, 7);
      if (ymNovo && ymNovo !== mes) setMes(ymNovo);
      else carregar(mes);
    } catch {
      setErro('Não consegui salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  const apagar = async (id) => {
    if (!window.confirm('Apagar este lançamento?')) return;
    setLancamentos((l) => l.filter((x) => x.id !== id));
    try {
      await fetch(`/api/lancamentos?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {}
    carregar(mes);
  };

  // Cálculos do mês
  const resumo = useMemo(() => {
    let despesas = 0, receitas = 0;
    const porPessoa = {};
    const porCategoria = {};
    for (const l of lancamentos) {
      const v = Number(l.valor) || 0;
      if (l.tipo === 'receita') {
        receitas += v;
      } else {
        despesas += v;
        porPessoa[l.usuario] = (porPessoa[l.usuario] || 0) + v;
        porCategoria[l.categoria || 'Outros'] = (porCategoria[l.categoria || 'Outros'] || 0) + v;
      }
    }
    const catList = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);
    const pessoaList = Object.entries(porPessoa).sort((a, b) => b[1] - a[1]);
    return { despesas, receitas, saldo: receitas - despesas, catList, pessoaList };
  }, [lancamentos]);

  // Agrupa lançamentos por data (para a lista)
  const grupos = useMemo(() => {
    const map = new Map();
    for (const l of lancamentos) {
      if (!map.has(l.data)) map.set(l.data, []);
      map.get(l.data).push(l);
    }
    return [...map.entries()]; // já vem ordenado por data desc do backend
  }, [lancamentos]);

  const ehMesAtual = mes === ymHoje();

  return (
    <div>
        {/* Navegação de mês */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
          <button onClick={() => setMes((m) => passoMes(m, -1))} style={navBtn}>‹</button>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, textTransform: 'capitalize' }}>{mesLabel(mes)}</div>
            {!ehMesAtual && <button onClick={() => setMes(ymHoje())} style={{ fontSize: 11, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>voltar ao mês atual</button>}
          </div>
          <button onClick={() => setMes((m) => passoMes(m, 1))} style={navBtn}>›</button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
          <KPI titulo="Gastos" valor={brl(resumo.despesas)} cor={C.red} />
          <KPI titulo="Entradas" valor={brl(resumo.receitas)} cor={C.green} />
          <KPI titulo="Saldo" valor={brl(resumo.saldo)} cor={resumo.saldo >= 0 ? C.green : C.red} />
        </div>

        {/* Formulário de novo lançamento */}
        <Card style={{ marginBottom: 16 }}>
          <form onSubmit={adicionar}>
            {/* Tipo */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <TipoBtn ativo={tipo === 'despesa'} cor={C.red} onClick={() => { setTipo('despesa'); setCategoria(''); }}>Gasto</TipoBtn>
              <TipoBtn ativo={tipo === 'receita'} cor={C.green} onClick={() => { setTipo('receita'); setCategoria(''); }}>Entrada</TipoBtn>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
              <Field label="Valor (R$)">
                <input inputMode="decimal" value={valor} placeholder="0,00" autoFocus
                  onChange={(e) => setValor(e.target.value)}
                  style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums', fontSize: 17, fontWeight: 700 }} />
              </Field>
              <Field label="Data">
                <input type="date" value={data} onChange={(e) => setData(e.target.value)}
                  style={{ ...inputStyle, minWidth: 0, WebkitAppearance: 'none', appearance: 'none', colorScheme: tema === 'escuro' ? 'dark' : 'light' }} />
              </Field>
            </div>

            <Field label="Categoria">
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">Selecione…</option>
                {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            <Field label="Descrição (opcional)">
              <input value={descricao} placeholder="Ex.: mercado da semana"
                onChange={(e) => setDescricao(e.target.value)} style={inputStyle} />
            </Field>

            {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{erro}</div>}

            <button type="submit" disabled={salvando} style={{
              width: '100%', background: tipo === 'receita' ? C.green : C.accent,
              color: tipo === 'receita' ? '#052014' : C.onAccent, border: 'none', borderRadius: 10,
              padding: '12px 18px', fontSize: 15, fontWeight: 700, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.7 : 1,
            }}>
              {salvando ? 'Salvando…' : tipo === 'receita' ? '+ Adicionar entrada' : '+ Adicionar gasto'}
            </button>
          </form>
        </Card>

        {/* Por pessoa */}
        {resumo.pessoaList.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <Label>Gastos por pessoa</Label>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {resumo.pessoaList.map(([nome, v]) => {
                const pct = resumo.despesas > 0 ? Math.round((v / resumo.despesas) * 100) : 0;
                const eu = nome === usuario.nome;
                return (
                  <div key={nome}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{nome}{eu ? ' (você)' : ''}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{brl(v)} · {pct}%</span>
                    </div>
                    <Barra pct={pct} cor={eu ? C.accent : C.accent2} />
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Por categoria */}
        {resumo.catList.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <Label>Gastos por categoria</Label>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {resumo.catList.map(([cat, v]) => {
                const pct = resumo.despesas > 0 ? Math.round((v / resumo.despesas) * 100) : 0;
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                      <span>{cat}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: C.muted }}>{brl(v)}</span>
                    </div>
                    <Barra pct={pct} cor={C.red} />
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Lista de lançamentos */}
        <Label>Lançamentos do mês</Label>
        <div style={{ marginTop: 8 }}>
          {carregando ? (
            <Empty>Carregando…</Empty>
          ) : grupos.length === 0 ? (
            <Empty>Nenhum lançamento neste mês.<br />Adicione o primeiro gasto ali em cima.</Empty>
          ) : (
            grupos.map(([dia, itens]) => (
              <div key={dia} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: C.faint, fontWeight: 600, margin: '0 0 6px 2px' }}>{fmtDate(dia)}</div>
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                  {itens.map((l, i) => (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderTop: i === 0 ? 'none' : `1px solid ${C.hair}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.categoria || 'Outros'}
                          {l.descricao ? <span style={{ color: C.muted, fontWeight: 400 }}> · {l.descricao}</span> : null}
                        </div>
                        <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{l.usuario}</div>
                      </div>
                      <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 15, color: l.tipo === 'receita' ? C.green : C.text, whiteSpace: 'nowrap' }}>
                        {l.tipo === 'receita' ? '+' : '−'} {brl(Number(l.valor))}
                      </div>
                      <button onClick={() => apagar(l.id)} title="Apagar" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, padding: 4, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </Card>
              </div>
            ))
          )}
        </div>
    </div>
  );
}

const navBtn = {
  width: 40, height: 40, borderRadius: 10, border: `1px solid ${C.line}`, background: C.panel2,
  color: C.text, cursor: 'pointer', fontSize: 22, lineHeight: 1, flexShrink: 0,
};

function TipoBtn({ ativo, cor, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
      border: `1.5px solid ${ativo ? cor : C.line}`,
      background: ativo ? cor : 'transparent',
      color: ativo ? C.onAccent : C.muted,
    }}>{children}</button>
  );
}

function Barra({ pct, cor }) {
  return (
    <div style={{ height: 8, background: C.panel2, borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: cor, borderRadius: 999 }} />
    </div>
  );
}
