'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { C, Card, Btn, KPI, Field, NumInput, Empty, SecTitle, PageTitle } from './ui';
import { brl, fmtDate } from '../lib/util';

const METODOS = ['Dinheiro', 'Pix', 'Crédito', 'Débito'];
const hora = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
const papelRot = (x) => (x === 'garcom' ? 'Garçom' : x === 'dona' ? 'Dona' : '');

export default function Caixa() {
  const [dados, setDados] = useState(null);
  const [carregado, setCarregado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [saldoInput, setSaldoInput] = useState('');
  const [contado, setContado] = useState('');
  const [fechando, setFechando] = useState(false);
  const [verHist, setVerHist] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/caixa', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) { setDados(j); setErro(''); } else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Sem conexão.'); }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const t = setInterval(() => { if (!fechando) carregar(); }, 15000);
    return () => clearInterval(t);
  }, [carregar, fechando]);

  const acao = async (payload) => {
    setBusy(true);
    try {
      const r = await fetch('/api/caixa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Erro.'); return null; }
      setErro('');
      await carregar();
      return j;
    } catch { setErro('Sem conexão.'); return null; }
    finally { setBusy(false); }
  };
  const abrir = async () => { const j = await acao({ acao: 'abrir', saldoInicial: saldoInput }); if (j) setSaldoInput(''); };
  const fechar = async () => {
    if (typeof window !== 'undefined' && !window.confirm('Fechar o caixa do turno? Isso encerra o caixa atual.')) return;
    const j = await acao({ acao: 'fechar', id: dados.aberto.id, contado });
    if (j) { setContado(''); setFechando(false); }
  };

  const aberto = dados?.aberto || null;
  const entradas = dados?.entradas || {};
  const historico = dados?.historico || [];

  return (
    <div>
      <PageTitle sub="Abertura e fechamento do caixa do turno">Caixa</PageTitle>
      {erro && <div style={{ fontSize: 13, color: C.red, marginBottom: 10 }}>{erro}</div>}

      {!carregado ? <Empty>Carregando…</Empty> : !aberto ? (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Abrir caixa</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Informe o dinheiro que já está na gaveta (fundo de troco).</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 0 }}><Field label="Saldo inicial (R$)"><NumInput value={saldoInput} onChange={setSaldoInput} /></Field></div>
            <div style={{ marginBottom: 2 }}><Btn onClick={abrir} disabled={busy}>Abrir caixa</Btn></div>
          </div>
        </Card>
      ) : (
        <>
          <div style={{ fontSize: 13, color: C.faint, marginBottom: 12 }}>
            Aberto às <b style={{ color: C.muted }}>{hora(aberto.abertoEm)}</b>{papelRot(aberto.abertoPor) && <> · por {papelRot(aberto.abertoPor)}</>} · {dados.qtdVendas} venda(s)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <KPI titulo="Dinheiro na gaveta" valor={brl(dados.dinheiroFinal)} cor={C.green} sub="saldo inicial + dinheiro" />
            <KPI titulo="Total recebido (tudo)" valor={brl(dados.recebido)} cor={C.accent} sub="dinheiro + pix + cartões" />
          </div>

          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 700, marginBottom: 10 }}>Movimento do caixa</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 14 }}>
              <span style={{ color: C.muted }}>Saldo inicial</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{brl(aberto.saldoInicial)}</span>
            </div>
            {METODOS.map((m) => (
              <div key={m} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: `1px solid ${C.line}`, fontSize: 14 }}>
                <span style={{ color: C.muted }}>Entrada · {m}</span>
                <span style={{ fontWeight: 700, color: C.green, fontVariantNumeric: 'tabular-nums' }}>{brl(entradas[m] || 0)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderTop: `2px solid ${C.line}`, marginTop: 4 }}>
              <span style={{ fontWeight: 800, color: C.text }}>Dinheiro na gaveta (saldo final)</span>
              <span style={{ fontWeight: 800, color: C.green, fontVariantNumeric: 'tabular-nums' }}>{brl(dados.dinheiroFinal)}</span>
            </div>
            {(entradas.Fiado || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: `1px solid ${C.line}`, fontSize: 13 }}>
                <span style={{ color: C.amber }}>Fiado (não é caixa)</span>
                <span style={{ fontWeight: 700, color: C.amber, fontVariantNumeric: 'tabular-nums' }}>{brl(entradas.Fiado)}</span>
              </div>
            )}
          </Card>

          {!fechando ? (
            <Btn kind="danger" onClick={() => setFechando(true)}>Fechar caixa</Btn>
          ) : (
            <Card style={{ padding: 14, borderColor: C.amber }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Fechar caixa</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Confira: o esperado na gaveta é <b style={{ color: C.green }}>{brl(dados.dinheiroFinal)}</b>. Conte o dinheiro (opcional) pra ver se bate.</div>
              <Field label="Dinheiro contado na gaveta (R$) — opcional"><NumInput value={contado} onChange={setContado} /></Field>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <Btn kind="danger" onClick={fechar} disabled={busy}>Confirmar fechamento</Btn>
                <Btn kind="ghost" onClick={() => { setFechando(false); setContado(''); }}>Voltar</Btn>
              </div>
            </Card>
          )}
        </>
      )}

      {historico.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button onClick={() => setVerHist((x) => !x)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0 }}>
            {verHist ? '▾' : '▸'} Caixas fechados ({historico.length})
          </button>
          {verHist && (
            <div style={{ marginTop: 10 }}>
              {historico.map((c) => (
                <Card key={c.id} style={{ marginBottom: 8, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{fmtDate((c.fechadoEm || '').slice(0, 10))} · {hora(c.abertoEm)}–{hora(c.fechadoEm)}</div>
                      <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>Recebido {brl(c.recebido)} · gaveta {brl(c.dinheiroFinal)}{c.contado != null ? ` · contado ${brl(c.contado)}` : ''}</div>
                    </div>
                    {c.diferenca != null && Math.abs(c.diferenca) > 0.005 && (
                      <div style={{ fontSize: 12, fontWeight: 800, color: c.diferenca < 0 ? C.red : C.amber, flexShrink: 0 }}>{c.diferenca > 0 ? '+' : ''}{brl(c.diferenca)}</div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
