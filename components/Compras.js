'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Area, Empty, Resumo, SecTitle, inputStyle } from './ui';
import { brl, num, todayISO, ymOf, weekday, fmtDate, mesLabel, addDays, uid, limparNome, montarParcelas, FONTES_RECEITA, CUSTO_VARIAVEL, DESPESA_OPERACIONAL, CATEGORIAS_DESPESA, CATEGORIAS_PRODUTO, DIAS, MESES } from '../lib/util';

const compraVazia = () => ({
  data: todayISO(), produto: '', fornecedor: '', quantidade: '', valorUnit: '', categoria: '',
  formaPagto: 'À vista', prazoDias: '', vencimento: '', pago: 'Não', dataPagamento: '', obs: '', nota: '',
  frete: '', impostoST: '',
});
export default function Compras({ dados, cotacoes, onChange }) {
  const [form, setForm] = useState(compraVazia());
  const [editId, setEditId] = useState(null);
  const [numParcelas, setNumParcelas] = useState('1');
  const [parcelasList, setParcelasList] = useState([]);
  const [filtroMes, setFiltroMes] = useState(ymOf(todayISO()));
  const [busca, setBusca] = useState('');
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const menorCot = useMemo(() => {
    if (!form.produto) return null;
    const regs = cotacoes.filter((c) => c.produto.trim().toLowerCase() === form.produto.trim().toLowerCase());
    if (!regs.length) return null;
    const menor = Math.min(...regs.map((r) => num(r.preco)));
    return { menor, forn: regs.find((r) => num(r.preco) === menor)?.fornecedor };
  }, [form.produto, cotacoes]);

  const totalItem = num(form.quantidade) * num(form.valorUnit);
  const difVsCot = menorCot ? (num(form.valorUnit) - menorCot.menor) : 0;
  const impacto = difVsCot * num(form.quantidade);

  const parcelado = !editId && form.formaPagto === 'Prazo' && (parseInt(numParcelas, 10) || 1) > 1;
  const mudarParcelas = (v) => {
    setNumParcelas(v);
    setParcelasList((prev) => montarParcelas(v, totalItem, form.data, prev));
  };
  const recalcularParcelas = () => setParcelasList((prev) => montarParcelas(numParcelas, totalItem, form.data, prev));
  const setParcelaCampo = (i, campo) => (v) =>
    setParcelasList((prev) => prev.map((p, idx) => (idx === i ? { ...p, [campo]: v } : p)));
  const somaParcelas = parcelasList.reduce((s, p) => s + num(p.valor), 0);
  const somaBate = Math.abs(somaParcelas - totalItem) < 0.005;

  const limpar = () => { setForm(compraVazia()); setEditId(null); setNumParcelas('1'); setParcelasList([]); };
  // Após registrar um item, mantém os dados do "boleto" (fornecedor, data,
  // forma, vencimento e nota) preenchidos para agilizar adicionar o próximo
  // item da mesma nota; limpa só os campos do produto.
  const proximoItem = () => {
    setForm((f) => ({ ...compraVazia(), data: f.data, fornecedor: f.fornecedor, formaPagto: f.formaPagto, vencimento: f.vencimento, nota: f.nota }));
    setEditId(null); setNumParcelas('1'); setParcelasList([]);
  };

  const salvar = () => {
    if (!form.produto || !form.fornecedor || !form.valorUnit) return;

    if (parcelado) {
      const n = parcelasList.length;
      const novas = parcelasList.map((p, i) => ({
        id: uid(), data: form.data, produto: limparNome(form.produto), fornecedor: limparNome(form.fornecedor),
        categoria: form.categoria, quantidade: '1', valorUnit: p.valor || '0',
        formaPagto: 'Prazo', prazoDias: '', vencimento: p.vencimento, pago: 'Não',
        dataPagamento: '', obs: [`Parcela ${i + 1}/${n}`, form.obs].filter(Boolean).join(' · '), nota: form.nota,
      }));
      onChange([...novas, ...dados]);
      limpar();
      return;
    }

    let venc = form.vencimento;
    if (!venc && form.formaPagto === 'Prazo' && form.prazoDias) venc = addDays(form.data, form.prazoDias);
    if (!venc && form.formaPagto === 'À vista') venc = form.data;
    const rec = { ...form, produto: limparNome(form.produto), fornecedor: limparNome(form.fornecedor), vencimento: venc };
    delete rec.frete; delete rec.impostoST;
    if (editId) { onChange(dados.map((d) => d.id === editId ? { ...rec, id: editId } : d)); limpar(); return; }

    // Frete e Imposto ST da nota viram uma linha separada, na mesma nota, pra o
    // total em A Pagar bater com o boleto.
    const novos = [{ ...rec, id: uid() }];
    const extra = num(form.frete) + num(form.impostoST);
    if (extra > 0) {
      const partes = [];
      if (num(form.frete) > 0) partes.push('Frete');
      if (num(form.impostoST) > 0) partes.push('Imposto ST');
      novos.push({
        id: uid(), data: form.data, produto: partes.join(' + '), fornecedor: limparNome(form.fornecedor),
        categoria: '', quantidade: '1',
        valorUnit: extra.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        formaPagto: form.formaPagto, prazoDias: form.prazoDias, vencimento: venc, pago: form.pago,
        dataPagamento: '', nota: form.nota,
        obs: [num(form.frete) > 0 ? `Frete ${brl(num(form.frete))}` : '', num(form.impostoST) > 0 ? `Imposto ST ${brl(num(form.impostoST))}` : ''].filter(Boolean).join(' · '),
      });
    }
    onChange([...novos, ...dados]);
    proximoItem();
  };
  const editar = (d) => { setForm({ ...compraVazia(), ...d }); setEditId(d.id); setNumParcelas('1'); setParcelasList([]); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const excluir = (id) => onChange(dados.filter((d) => d.id !== id));

  const mesesDisp = [...new Set(dados.map((d) => ymOf(d.data)))].sort().reverse();
  const lista = dados
    .filter((d) => ymOf(d.data) === filtroMes)
    .filter((d) => (d.produto + ' ' + d.fornecedor).toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const totalMes = lista.reduce((s, d) => s + num(d.quantidade) * num(d.valorUnit), 0);
  const gastoGeral = dados.reduce((s, d) => s + num(d.quantidade) * num(d.valorUnit), 0);
  const emAberto = dados.filter((d) => d.pago !== 'Sim').length;

  return (
    <div>
      <Resumo items={[
        { t: 'Compras', v: dados.length },
        { t: 'Total gasto', v: brl(gastoGeral), c: C.red },
        { t: 'Em aberto', v: emAberto, c: emAberto ? C.amber : C.faint },
      ]} />

      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{editId ? 'Editar compra' : 'Nova compra'}</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>Registre o que comprou. Se o produto estiver nas Cotações, eu comparo com o menor preço na hora.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Data"><TextInput type="date" value={form.data} onChange={set('data')} /></Field>
          <Field label="Categoria"><Select value={form.categoria} onChange={set('categoria')} options={CATEGORIAS_PRODUTO} /></Field>
        </div>
        <Field label="Produto"><TextInput value={form.produto} onChange={set('produto')} placeholder="Original 600ml…" /></Field>
        <Field label="Fornecedor"><TextInput value={form.fornecedor} onChange={set('fornecedor')} placeholder="Ambev, Komprão…" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Quantidade"><NumInput value={form.quantidade} onChange={set('quantidade')} /></Field>
          <Field label="Valor unitário (R$)"><NumInput value={form.valorUnit} onChange={set('valorUnit')} /></Field>
        </div>
        {totalItem > 0 && <div style={{ fontSize: 14, color: C.text, margin: '-4px 0 10px' }}>Total da compra: <b>{brl(totalItem)}</b></div>}
        {menorCot && num(form.valorUnit) > 0 && (
          <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13 }}>
            <div style={{ color: C.muted }}>Menor cotação: <b style={{ color: C.green }}>{brl(menorCot.menor)}</b> ({menorCot.forn})</div>
            <div style={{ marginTop: 4, color: difVsCot > 0 ? C.red : C.green, fontWeight: 700 }}>
              {difVsCot > 0 ? `⚠ Pagando ${brl(difVsCot)} a mais por unidade` : difVsCot < 0 ? '✓ Abaixo da menor cotação' : '✓ No melhor preço'}
              {impacto !== 0 && <span> · impacto total {brl(Math.abs(impacto))}</span>}
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Forma de pagamento"><Select value={form.formaPagto} onChange={set('formaPagto')} options={['À vista', 'Prazo']} /></Field>
          {form.formaPagto === 'Prazo'
            ? <Field label="Nº de parcelas"><NumInput value={numParcelas} onChange={mudarParcelas} placeholder="1" /></Field>
            : <Field label="Já foi pago?"><Select value={form.pago} onChange={set('pago')} options={['Sim', 'Não']} /></Field>}
        </div>

        {form.formaPagto === 'Prazo' && !parcelado && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Vencimento (opcional)"><TextInput type="date" value={form.vencimento} onChange={set('vencimento')} /></Field>
            <Field label="Já foi pago?"><Select value={form.pago} onChange={set('pago')} options={['Sim', 'Não']} /></Field>
          </div>
        )}

        {parcelado && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', color: C.muted, fontWeight: 600 }}>Datas e valores das parcelas</div>
              <Btn kind="ghost" small onClick={recalcularParcelas}>Recalcular</Btn>
            </div>
            {parcelasList.map((p, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: C.faint, fontWeight: 700, width: 22 }}>{i + 1}ª</div>
                <TextInput type="date" value={p.vencimento} onChange={setParcelaCampo(i, 'vencimento')} />
                <NumInput value={p.valor} onChange={setParcelaCampo(i, 'valor')} />
              </div>
            ))}
            <div style={{ fontSize: 13, marginTop: 2, color: somaBate ? C.green : C.amber, fontWeight: 600 }}>
              Soma das parcelas: {brl(somaParcelas)}
              {totalItem > 0 && !somaBate && <span> · não bate com o total ({brl(totalItem)})</span>}
              {totalItem > 0 && somaBate && <span> ✓</span>}
            </div>
          </div>
        )}

        <Field label="Nota / boleto (opcional)"><TextInput value={form.nota} onChange={set('nota')} placeholder="ex: NF 4567, Boleto Ambev jul" /></Field>
        <div style={{ fontSize: 12, color: C.faint, margin: '-8px 0 14px', lineHeight: 1.4 }}>
          Comprou vários produtos num boleto só? Use a <b>mesma nota/boleto</b> em cada item — a aba A Pagar junta todos num pagamento único.
        </div>

        {!editId && (
          <details style={{ marginBottom: 14 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: C.muted, fontWeight: 600, padding: '2px 0' }}>+ Frete e imposto ST da nota (opcional)</summary>
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Frete (R$)"><NumInput value={form.frete} onChange={set('frete')} /></Field>
                <Field label="Imposto ST (R$)"><NumInput value={form.impostoST} onChange={set('impostoST')} /></Field>
              </div>
              <div style={{ fontSize: 12, color: C.faint, margin: '-4px 0 0', lineHeight: 1.4 }}>
                Preencha <b>uma vez por nota</b>. Ao registrar, viram uma linha <b>“Frete + Imposto ST”</b> na mesma nota — aí o total em A Pagar bate com o boleto.
              </div>
              {(num(form.frete) + num(form.impostoST)) > 0 && (
                <div style={{ fontSize: 13, color: C.text, marginTop: 8 }}>Frete + Imposto ST: <b>{brl(num(form.frete) + num(form.impostoST))}</b>{totalItem > 0 && <span style={{ color: C.muted }}> · com este produto: {brl(totalItem + num(form.frete) + num(form.impostoST))}</span>}</div>
              )}
            </div>
          </details>
        )}

        <Field label="Observação"><TextInput value={form.obs} onChange={set('obs')} placeholder="Boleto, nota…" /></Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={salvar}>{editId ? 'Salvar compra' : (parcelado ? `Registrar ${parcelasList.length} parcelas` : 'Registrar compra')}</Btn>
          {editId && <Btn kind="ghost" onClick={limpar}>Cancelar</Btn>}
        </div>
      </Card>

      <SecTitle>Histórico de compras</SecTitle>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 120 }}><Select value={filtroMes} onChange={setFiltroMes} options={mesesDisp.length ? mesesDisp : [ymOf(todayISO())]} placeholder="Mês" /></div>
        <div style={{ flex: 1, minWidth: 120 }}><TextInput value={busca} onChange={setBusca} placeholder="🔎 Produto/fornecedor" /></div>
      </div>
      <div style={{ textAlign: 'right', marginBottom: 10, fontSize: 14 }}>
        <span style={{ color: C.muted }}>Total do mês: </span><b style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>{brl(totalMes)}</b>
      </div>

      {lista.length === 0 ? <Empty>Nenhuma compra neste mês.</Empty> :
        lista.map((d) => {
          const tot = num(d.quantidade) * num(d.valorUnit);
          const aberto = d.pago !== 'Sim';
          return (
            <Card key={d.id} style={{ marginBottom: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{d.produto}</div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{limparNome(d.fornecedor)} · {fmtDate(d.data)}</div>
                  <div style={{ fontSize: 12, color: C.faint, marginTop: 3 }}>
                    {num(d.quantidade)} × {brl(num(d.valorUnit))} · {d.formaPagto}
                    {d.vencimento && d.formaPagto === 'Prazo' ? ` · vence ${fmtDate(d.vencimento)}` : ''}
                    {aberto ? <span style={{ color: C.amber }}> · em aberto</span> : <span style={{ color: C.green }}> · pago</span>}
                  </div>
                  {(d.nota || d.obs) && <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{[d.nota && `Nota: ${d.nota}`, d.obs].filter(Boolean).join(' · ')}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{brl(tot)}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                    <Btn kind="ghost" small onClick={() => editar(d)}>Editar</Btn>
                    <Btn kind="danger" small onClick={() => excluir(d.id)}>×</Btn>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
    </div>
  );
}
