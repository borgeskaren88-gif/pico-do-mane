'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Empty, Resumo, SecTitle } from './ui';
import { brl, num, todayISO, ymOf, fmtDate, addDays, uid, limparNome, CATEGORIAS_PRODUTO } from '../lib/util';

// Dados compartilhados da compra (valem pra todos os itens do carrinho).
const compraVazia = () => ({ data: todayISO(), fornecedor: '', formaPagto: 'À vista', pago: 'Sim', vencimento: '', nota: '' });
// Item que está sendo digitado antes de entrar no carrinho.
const itemVazio = () => ({ produto: '', categoria: '', quantidade: '', valorUnit: '' });

export default function Compras({ dados, cotacoes, despesas = [], onChange, onRegistrar }) {
  const [compra, setCompra] = useState(compraVazia());
  const [item, setItem] = useState(itemVazio());
  const [carrinho, setCarrinho] = useState([]);
  const [gerarCotacao, setGerarCotacao] = useState(true);
  const [editId, setEditId] = useState(null);
  const [filtroMes, setFiltroMes] = useState(ymOf(todayISO()));
  const [busca, setBusca] = useState('');

  const setC = (k) => (v) => setCompra((f) => ({ ...f, [k]: v }));
  const setI = (k) => (v) => setItem((f) => ({ ...f, [k]: v }));
  // Ao trocar a forma de pagamento, ajusta o "já pago?" pro padrão de cada uma:
  // à vista costuma já estar paga; a prazo vai pro A Pagar (não paga ainda).
  const setForma = (v) => setCompra((f) => ({ ...f, formaPagto: v, pago: v === 'À vista' ? 'Sim' : 'Não' }));

  // Menor cotação já registrada pro produto que está sendo digitado.
  const menorCot = useMemo(() => {
    if (!item.produto) return null;
    const regs = cotacoes.filter((c) => limparNome(c.produto).toLowerCase() === limparNome(item.produto).toLowerCase());
    if (!regs.length) return null;
    const menor = Math.min(...regs.map((r) => num(r.preco)));
    return { menor, forn: limparNome(regs.find((r) => num(r.preco) === menor)?.fornecedor) };
  }, [item.produto, cotacoes]);

  const totalItem = num(item.quantidade) * num(item.valorUnit);
  const difVsCot = menorCot ? (num(item.valorUnit) - menorCot.menor) : 0;
  const totalCarrinho = carrinho.reduce((s, it) => s + num(it.quantidade) * num(it.valorUnit), 0);

  const addItem = () => {
    if (!item.produto || !item.valorUnit) return;
    setCarrinho((c) => [...c, { ...item, id: uid() }]);
    setItem(itemVazio());
  };
  const removeItem = (id) => setCarrinho((c) => c.filter((x) => x.id !== id));

  // Salva a compra inteira: cria as linhas de compra, gera as cotações de preço
  // (se marcado) e, quando a compra já está paga, lança a despesa — tudo de uma
  // vez, pra você digitar só aqui e os dados aparecerem nos três lugares.
  const registrar = () => {
    if (!compra.fornecedor || !carrinho.length) return;
    const venc = compra.formaPagto === 'À vista' ? compra.data : (compra.vencimento || '');
    const pago = compra.pago === 'Sim' ? 'Sim' : 'Não';
    const forn = limparNome(compra.fornecedor);

    let despId = '';
    let novasDespesas = null;
    if (pago === 'Sim' && totalCarrinho > 0) {
      despId = uid();
      const desp = {
        id: despId, data: compra.data, categoria: 'Fornecedores de insumo',
        descricao: [forn, compra.nota && `Nota ${compra.nota}`].filter(Boolean).join(' · ') || 'Compra',
        valor: totalCarrinho.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        obs: `Compra ${compra.formaPagto.toLowerCase()} · ${carrinho.length} ${carrinho.length > 1 ? 'itens' : 'item'}`,
        origem: 'compra',
      };
      novasDespesas = [desp, ...despesas];
    }

    const novasCompras = carrinho.map((it) => ({
      id: uid(), data: compra.data, produto: limparNome(it.produto), fornecedor: forn,
      categoria: it.categoria, quantidade: it.quantidade || '1', valorUnit: it.valorUnit || '0',
      formaPagto: compra.formaPagto, prazoDias: '', vencimento: venc, pago,
      dataPagamento: pago === 'Sim' ? compra.data : '', obs: '', nota: compra.nota,
      despesaId: despId || undefined,
    }));

    let novasCotacoes = null;
    if (gerarCotacao) {
      const novos = carrinho.filter((it) => num(it.valorUnit) > 0).map((it) => ({
        id: uid(), data: compra.data, produto: limparNome(it.produto), fornecedor: forn,
        preco: it.valorUnit, categoria: it.categoria,
      }));
      if (novos.length) novasCotacoes = [...novos, ...cotacoes];
    }

    onRegistrar({ compras: [...novasCompras, ...dados], cotacoes: novasCotacoes, despesas: novasDespesas });
    setCompra(compraVazia()); setItem(itemVazio()); setCarrinho([]);
  };

  // Edição de uma linha existente (uma por vez, sem gerar cotação/despesa nova).
  const editar = (d) => {
    setEditId(d.id);
    setCompra({ data: d.data || todayISO(), fornecedor: d.fornecedor || '', formaPagto: d.formaPagto || 'À vista', pago: d.pago || 'Não', vencimento: d.vencimento || '', nota: d.nota || '' });
    setItem({ produto: d.produto || '', categoria: d.categoria || '', quantidade: d.quantidade || '', valorUnit: d.valorUnit || '' });
    setCarrinho([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const salvarEdicao = () => {
    if (!item.produto || !item.valorUnit) return;
    const venc = compra.formaPagto === 'À vista' ? compra.data : (compra.vencimento || '');
    onChange(dados.map((d) => d.id === editId ? {
      ...d, data: compra.data, produto: limparNome(item.produto), fornecedor: limparNome(compra.fornecedor),
      categoria: item.categoria, quantidade: item.quantidade || '1', valorUnit: item.valorUnit || '0',
      formaPagto: compra.formaPagto, vencimento: venc, pago: compra.pago,
      dataPagamento: compra.pago === 'Sim' ? (d.dataPagamento || compra.data) : '', nota: compra.nota,
    } : d));
    cancelarEdicao();
  };
  const cancelarEdicao = () => { setEditId(null); setCompra(compraVazia()); setItem(itemVazio()); };
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
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
          {editId ? 'Ajuste os dados desta linha e salve.' : 'Preencha os dados da compra, adicione os itens ao carrinho e registre. Cada preço vira cotação e, se a compra estiver paga, vira despesa — tudo automático.'}
        </div>

        {/* Dados da compra (valem pra todos os itens) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Data"><TextInput type="date" value={compra.data} onChange={setC('data')} /></Field>
          <Field label="Fornecedor"><TextInput value={compra.fornecedor} onChange={setC('fornecedor')} placeholder="Komprão, Ambev…" /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Forma de pagamento"><Select value={compra.formaPagto} onChange={setForma} options={['À vista', 'Prazo']} /></Field>
          <Field label="Já foi paga?"><Select value={compra.pago} onChange={setC('pago')} options={['Sim', 'Não']} /></Field>
        </div>
        {compra.formaPagto === 'Prazo' && (
          <Field label="Vencimento (opcional)"><TextInput type="date" value={compra.vencimento} onChange={setC('vencimento')} /></Field>
        )}
        <Field label="Nota / boleto (opcional)"><TextInput value={compra.nota} onChange={setC('nota')} placeholder="ex: NF 4567" /></Field>

        <div style={{ borderTop: `1px solid ${C.line}`, margin: '8px 0 14px' }} />

        {/* Item a adicionar */}
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', color: C.muted, fontWeight: 700, marginBottom: 8 }}>
          {editId ? 'Produto' : 'Adicionar item'}
        </div>
        <Field label="Produto"><TextInput value={item.produto} onChange={setI('produto')} placeholder="Arroz 5kg, Original 600ml…" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Field label="Categoria"><Select value={item.categoria} onChange={setI('categoria')} options={CATEGORIAS_PRODUTO} /></Field>
          <Field label="Qtd"><NumInput value={item.quantidade} onChange={setI('quantidade')} /></Field>
          <Field label="Valor un. (R$)"><NumInput value={item.valorUnit} onChange={setI('valorUnit')} /></Field>
        </div>
        {totalItem > 0 && <div style={{ fontSize: 13, color: C.text, margin: '-4px 0 8px' }}>Subtotal do item: <b>{brl(totalItem)}</b></div>}
        {menorCot && num(item.valorUnit) > 0 && (
          <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 13 }}>
            <div style={{ color: C.muted }}>Menor cotação: <b style={{ color: C.green }}>{brl(menorCot.menor)}</b>{menorCot.forn && ` (${menorCot.forn})`}</div>
            <div style={{ marginTop: 3, color: difVsCot > 0 ? C.red : C.green, fontWeight: 700 }}>
              {difVsCot > 0 ? `Pagando ${brl(difVsCot)} a mais por unidade` : difVsCot < 0 ? 'Abaixo da menor cotação' : 'No melhor preço'}
            </div>
          </div>
        )}

        {editId ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={salvarEdicao}>Salvar compra</Btn>
            <Btn kind="ghost" onClick={cancelarEdicao}>Cancelar</Btn>
          </div>
        ) : (
          <>
            <Btn kind="ghost" onClick={addItem}>+ Adicionar ao carrinho</Btn>

            {/* Carrinho */}
            {carrinho.length > 0 && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', color: C.muted, fontWeight: 700, marginBottom: 8 }}>
                  Carrinho ({carrinho.length} {carrinho.length > 1 ? 'itens' : 'item'})
                </div>
                {carrinho.map((it) => (
                  <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: `1px solid ${C.line}44` }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: C.text }}>{it.produto}</div>
                      <div style={{ fontSize: 12, color: C.faint }}>{num(it.quantidade) || 1} × {brl(num(it.valorUnit))}{it.categoria ? ` · ${it.categoria}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <b style={{ fontVariantNumeric: 'tabular-nums' }}>{brl(num(it.quantidade) * num(it.valorUnit))}</b>
                      <button onClick={() => removeItem(it.id)} title="Remover" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>×</button>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, fontSize: 15 }}>
                  <span style={{ color: C.muted }}>Total da compra</span>
                  <b style={{ fontVariantNumeric: 'tabular-nums' }}>{brl(totalCarrinho)}</b>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0', fontSize: 13, color: C.muted, cursor: 'pointer' }}>
                  <input type="checkbox" checked={gerarCotacao} onChange={(e) => setGerarCotacao(e.target.checked)} style={{ width: 16, height: 16, accentColor: C.accent }} />
                  Salvar os preços nas Cotações
                </label>
                <div style={{ fontSize: 12, color: C.faint, marginBottom: 12, lineHeight: 1.4 }}>
                  {compra.pago === 'Sim'
                    ? 'Compra paga: será lançada em Despesas automaticamente.'
                    : 'Compra em aberto: vai para A Pagar; vira despesa quando você marcar como paga.'}
                </div>
                <Btn onClick={registrar}>Registrar compra ({brl(totalCarrinho)})</Btn>
              </div>
            )}
          </>
        )}
      </Card>

      <SecTitle>Histórico de compras</SecTitle>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 120 }}><Select value={filtroMes} onChange={setFiltroMes} options={mesesDisp.length ? mesesDisp : [ymOf(todayISO())]} placeholder="Mês" /></div>
        <div style={{ flex: 1, minWidth: 120 }}><TextInput value={busca} onChange={setBusca} placeholder="Produto/fornecedor" /></div>
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
