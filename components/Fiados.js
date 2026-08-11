'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { C, Card, Btn, KPI, Empty, SecTitle, PageTitle } from './ui';
import { brl, fmtDate } from '../lib/util';

export default function Fiados({ onMudou }) {
  const [vendas, setVendas] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [verPagos, setVerPagos] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/vendas', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) { setVendas(Array.isArray(j.vendas) ? j.vendas : []); setErro(''); }
      else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Sem conexão.'); }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const acao = async (payload) => {
    setBusy(true);
    try {
      const r = await fetch('/api/vendas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Erro.'); return; }
      await carregar();
      if (onMudou) onMudou();
    } catch { setErro('Sem conexão.'); }
    finally { setBusy(false); }
  };
  const receber = (id) => acao({ acao: 'receber', id });
  const excluir = (id) => { if (typeof window !== 'undefined' && !window.confirm('Excluir este fiado? Não vai mais aparecer nem contar em lugar nenhum.')) return; acao({ acao: 'excluir', id }); };

  const fiados = vendas.filter((v) => v.pagamento === 'Fiado');
  const abertos = fiados.filter((v) => !v.pago).sort((a, b) => (a.fechadaEm || '').localeCompare(b.fechadaEm || ''));
  const pagos = fiados.filter((v) => v.pago).sort((a, b) => (b.pagoEm || '').localeCompare(a.pagoEm || ''));
  const totalDevido = abertos.reduce((s, v) => s + (Number(v.total) || 0), 0);
  const rotulo = (v) => (v.nome && v.nome.trim()) || `Mesa ${v.mesa}`;

  return (
    <div>
      <PageTitle sub="Quem está devendo (contas fechadas no fiado)">Fiados</PageTitle>

      <KPI titulo="Total a receber" valor={brl(totalDevido)} cor={totalDevido > 0 ? C.amber : C.faint} sub={`${abertos.length} fiado(s) em aberto`} />

      {erro && <div style={{ fontSize: 13, color: C.red, margin: '10px 0' }}>{erro}</div>}

      <div style={{ marginTop: 16 }}>
        <SecTitle>Em aberto ({abertos.length})</SecTitle>
        {!carregado ? <Empty>Carregando…</Empty> :
          abertos.length === 0 ? <Empty>Ninguém devendo.<br />Contas fechadas no fiado aparecem aqui pra você cobrar.</Empty> :
            abertos.map((v) => (
              <Card key={v.id} style={{ marginBottom: 8, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{rotulo(v)}</div>
                    <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>Mesa {v.mesa} · {fmtDate(v.data)}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: C.amber, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(Number(v.total) || 0)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 10 }}>
                  <Btn kind="ok" small onClick={() => receber(v.id)} disabled={busy}>Recebi</Btn>
                  <Btn kind="danger" small onClick={() => excluir(v.id)} disabled={busy}>Excluir</Btn>
                </div>
              </Card>
            ))}
      </div>

      {pagos.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <button onClick={() => setVerPagos((x) => !x)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0 }}>
            {verPagos ? '▾' : '▸'} Já recebidos ({pagos.length})
          </button>
          {verPagos && (
            <div style={{ marginTop: 10 }}>
              {pagos.slice(0, 40).map((v) => (
                <Card key={v.id} style={{ marginBottom: 6, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.faint }}>{rotulo(v)}</div>
                      <div style={{ fontSize: 12, color: C.faint }}>Recebido {v.pagoEm ? fmtDate(v.pagoEm) : ''}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: C.green, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(Number(v.total) || 0)}</div>
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
