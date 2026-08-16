'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { C, Card, Btn, KPI, Field, NumInput, Empty, SecTitle, PageTitle } from './ui';
import { brl, fmtDate } from '../lib/util';

const METODOS = ['Dinheiro', 'Pix', 'Crédito', 'Débito'];
const hora = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
// Dia no fuso do Brasil (YYYY-MM-DD). Cortar o ISO direto dava dia errado à
// noite, porque o ISO é UTC e depois das 21h já virou o dia seguinte.
const diaBR = (iso) => { if (!iso) return ''; try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)); } catch { return String(iso).slice(0, 10); } };
const dataHora = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
const papelRot = (x) => (x === 'garcom' ? 'Atendimento' : x === 'dona' ? 'Karen' : '');

export default function Caixa() {
  const [dados, setDados] = useState(null);
  const [carregado, setCarregado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [saldoInput, setSaldoInput] = useState('');
  const [contado, setContado] = useState('');
  const [fechando, setFechando] = useState(false);
  const [verHist, setVerHist] = useState(false);
  const [editSaldo, setEditSaldo] = useState(false);
  const [saldoEdit, setSaldoEdit] = useState('');

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
  const salvarSaldo = async () => { const j = await acao({ acao: 'ajustar', id: dados.aberto.id, saldoInicial: saldoEdit }); if (j) setEditSaldo(false); };

  const aberto = dados?.aberto || null;
  const entradas = dados?.entradas || {};
  const historico = dados?.historico || [];
  // Há quanto tempo o caixa está aberto (pra avisar se passou de 24h).
  const horasAberto = aberto?.abertoEm ? (Date.now() - new Date(aberto.abertoEm).getTime()) / 3600000 : 0;
  const alerta24 = !!aberto && horasAberto >= 24;
  const quemAbriu = aberto ? (papelRot(aberto.abertoPor) || 'alguém') : '';

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
          {alerta24 && (
            <Card style={{ marginBottom: 12, borderColor: C.red }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.red }}>Caixa aberto há mais de 24h</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
                Aberto por <b style={{ color: C.text }}>{quemAbriu}</b> em <b style={{ color: C.text }}>{dataHora(aberto.abertoEm)}</b> — cerca de <b style={{ color: C.text }}>{Math.floor(horasAberto)}h</b> atrás. Confira e feche o caixa do turno.
              </div>
            </Card>
          )}
          <div style={{ fontSize: 13, color: C.faint, marginBottom: 12 }}>
            Aberto em <b style={{ color: C.muted }}>{dataHora(aberto.abertoEm)}</b> · por <b style={{ color: alerta24 ? C.red : C.muted }}>{quemAbriu}</b> · {dados.qtdVendas} venda(s)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <KPI titulo="Dinheiro na gaveta" valor={brl(dados.dinheiroFinal)} cor={C.green} sub="saldo inicial + dinheiro" />
            <KPI titulo="Total recebido (tudo)" valor={brl(dados.recebido)} cor={C.accent} sub="dinheiro + pix + cartões" />
          </div>

          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 700, marginBottom: 10 }}>Movimento do caixa</div>
            {!editSaldo ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 14 }}>
                <span style={{ color: C.muted }}>Saldo inicial</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => { setSaldoEdit(String(aberto.saldoInicial).replace('.', ',')); setEditSaldo(true); }} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>editar</button>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{brl(aberto.saldoInicial)}</span>
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0' }}>
                <span style={{ color: C.muted, fontSize: 14, flexShrink: 0 }}>Saldo inicial</span>
                <div style={{ flex: 1, minWidth: 0 }}><NumInput value={saldoEdit} onChange={setSaldoEdit} /></div>
                <Btn small onClick={salvarSaldo} disabled={busy}>Salvar</Btn>
                <Btn kind="ghost" small onClick={() => setEditSaldo(false)}>×</Btn>
              </div>
            )}
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

          {(dados.servico || 0) > 0 && (
            <Card style={{ marginBottom: 14, padding: '12px 14px', borderColor: C.accent2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.accent2 }}>Serviço (10%) do turno</div>
                  <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>Parte dos garçons — já está incluída no total acima.</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: C.accent2, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(dados.servico)}</div>
              </div>
            </Card>
          )}

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
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{fmtDate(diaBR(c.abertoEm || c.fechadoEm))} · {hora(c.abertoEm)}–{hora(c.fechadoEm)}</div>
                      <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>Recebido {brl(c.recebido)} · gaveta {brl(c.dinheiroFinal)}{(c.servico || 0) > 0 ? ` · serviço ${brl(c.servico)}` : ''}{c.contado != null ? ` · contado ${brl(c.contado)}` : ''}</div>
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
