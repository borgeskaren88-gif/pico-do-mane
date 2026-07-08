'use client';
import React, { useState } from 'react';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Empty, SecTitle } from './ui';
import { brl, num, todayISO, fmtDate, addDays, uid, montarParcelas, CATEGORIAS_PRODUTO } from '../lib/util';

const formVazio = () => ({ fornecedor: '', descricao: '', categoria: '', valorTotal: '', parcelas: '1' });
const linhaVazia = () => [{ vencimento: todayISO(), valor: '' }];

export default function ContasPagar({ dados, onChange }) {
  const hoje = todayISO();
  const [form, setForm] = useState(formVazio());
  const [parcelas, setParcelas] = useState(linhaVazia());
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const setNumParcelas = (v) => {
    setForm((f) => ({ ...f, parcelas: v }));
    setParcelas((prev) => montarParcelas(v, form.valorTotal, hoje, prev));
  };
  const setValorTotal = (v) => {
    setForm((f) => ({ ...f, valorTotal: v }));
    setParcelas((prev) => montarParcelas(form.parcelas, v, hoje, prev));
  };
  const setParcelaCampo = (i, campo) => (v) =>
    setParcelas((prev) => prev.map((p, idx) => (idx === i ? { ...p, [campo]: v } : p)));

  const nParcelas = parcelas.length;
  const somaParcelas = parcelas.reduce((s, p) => s + num(p.valor), 0);
  const totalDigitado = num(form.valorTotal);
  const somaBate = Math.abs(somaParcelas - totalDigitado) < 0.005;

  const registrar = () => {
    if (!form.fornecedor || !form.descricao) return;
    const novas = parcelas.map((p, i) => ({
      id: uid(), data: hoje, produto: form.descricao, fornecedor: form.fornecedor,
      categoria: form.categoria, quantidade: '1', valorUnit: p.valor || '0',
      formaPagto: 'Prazo', prazoDias: '', vencimento: p.vencimento, pago: 'Não',
      dataPagamento: '', obs: nParcelas > 1 ? `Parcela ${i + 1}/${nParcelas}` : '',
    }));
    onChange([...novas, ...dados]);
    setForm(formVazio());
    setParcelas(linhaVazia());
  };

  const abertas = dados.filter((d) => d.pago !== 'Sim').sort((a, b) => (a.vencimento || '9999').localeCompare(b.vencimento || '9999'));
  const total = abertas.reduce((s, d) => s + num(d.quantidade) * num(d.valorUnit), 0);
  const vencidas = abertas.filter((d) => d.vencimento && d.vencimento < hoje);
  const proximas = abertas.filter((d) => d.vencimento && d.vencimento >= hoje && d.vencimento <= addDays(hoje, 7));
  const totalVenc = vencidas.reduce((s, d) => s + num(d.quantidade) * num(d.valorUnit), 0);
  const pagar = (d) => onChange(dados.map((x) => x.id === d.id ? { ...x, pago: 'Sim', dataPagamento: hoje } : x));

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <KPI titulo="Total em aberto" valor={brl(total)} cor={C.red} sub={`${abertas.length} conta(s)`} />
        <KPI titulo="Vencidas" valor={brl(totalVenc)} cor={vencidas.length ? C.red : C.faint} sub={`${vencidas.length} vencida(s)`} />
      </div>

      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Registrar conta a pagar</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>Para boletos parcelados, informe o valor total e o nº de parcelas — cada uma vira uma conta com seu próprio vencimento.</div>

        <Field label="Fornecedor / conta"><TextInput value={form.fornecedor} onChange={set('fornecedor')} placeholder="Ambev, Energia, Aluguel…" /></Field>
        <Field label="Descrição"><TextInput value={form.descricao} onChange={set('descricao')} placeholder="Boleto compra, fatura…" /></Field>
        <Field label="Categoria (opcional)"><Select value={form.categoria} onChange={set('categoria')} options={CATEGORIAS_PRODUTO} /></Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Valor total (R$)"><NumInput value={form.valorTotal} onChange={setValorTotal} /></Field>
          <Field label="Nº de parcelas"><NumInput value={form.parcelas} onChange={setNumParcelas} placeholder="1" /></Field>
        </div>

        <div style={{ marginBottom: 6, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', color: C.muted, fontWeight: 600 }}>
          {nParcelas > 1 ? 'Datas e valores das parcelas' : 'Vencimento e valor'}
        </div>
        {parcelas.map((p, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: nParcelas > 1 ? 'auto 1fr 1fr' : '1fr 1fr', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            {nParcelas > 1 && <div style={{ fontSize: 13, color: C.faint, fontWeight: 700, width: 22 }}>{i + 1}ª</div>}
            <TextInput type="date" value={p.vencimento} onChange={setParcelaCampo(i, 'vencimento')} />
            <NumInput value={p.valor} onChange={setParcelaCampo(i, 'valor')} />
          </div>
        ))}

        {nParcelas > 1 && (
          <div style={{ fontSize: 13, marginTop: 4, marginBottom: 12, color: somaBate ? C.green : C.amber, fontWeight: 600 }}>
            Soma das parcelas: {brl(somaParcelas)}
            {totalDigitado > 0 && !somaBate && <span> · não bate com o total ({brl(totalDigitado)})</span>}
            {totalDigitado > 0 && somaBate && <span> ✓</span>}
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <Btn onClick={registrar}>{nParcelas > 1 ? `Registrar ${nParcelas} parcelas` : 'Registrar conta'}</Btn>
        </div>
      </Card>

      {proximas.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: C.amber }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.amber, fontWeight: 700 }}>Vencem nos próximos 7 dias</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{proximas.length} conta(s) chegando. Programe o caixa.</div>
        </Card>
      )}

      <SecTitle>Contas em aberto ({abertas.length})</SecTitle>
      {abertas.length === 0 ? <Empty>Nenhuma conta em aberto. 🎉<br />Tudo pago por aqui.</Empty> :
        abertas.map((d) => {
          const tot = num(d.quantidade) * num(d.valorUnit);
          const vencida = d.vencimento && d.vencimento < hoje;
          const proxima = d.vencimento && d.vencimento >= hoje && d.vencimento <= addDays(hoje, 7);
          const cor = vencida ? C.red : proxima ? C.amber : C.line;
          return (
            <Card key={d.id} style={{ marginBottom: 8, padding: '12px 14px', borderColor: cor }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{d.fornecedor}</div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{d.produto}{d.obs ? ` · ${d.obs}` : ''}</div>
                  <div style={{ fontSize: 12, marginTop: 3, color: vencida ? C.red : proxima ? C.amber : C.faint, fontWeight: vencida || proxima ? 700 : 400 }}>
                    {d.vencimento ? `Vence ${fmtDate(d.vencimento)}${vencida ? ' · VENCIDA' : ''}` : 'Sem vencimento'} · {d.formaPagto}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{brl(tot)}</div>
                  <div style={{ marginTop: 8 }}><Btn kind="ok" small onClick={() => pagar(d)}>Marcar pago</Btn></div>
                </div>
              </div>
            </Card>
          );
        })}
    </div>
  );
}
