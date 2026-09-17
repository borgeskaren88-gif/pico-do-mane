'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Empty, Resumo, SecTitle, PageTitle, Sugestoes } from './ui';
import { brl, num, numQtd, todayISO, ymOf, fmtDate, addDays, uid, limparNome, CATEGORIAS_PRODUTO } from '../lib/util';
import { resolverCompraNoEstoque, entradaDaCompra, comprasPendentesDeEstoque, UNIDADES } from '../lib/estoque';

// Dados compartilhados da compra (valem pra todos os itens do carrinho).
const compraVazia = () => ({ data: todayISO(), fornecedor: '', formaPagto: 'À vista', pago: 'Sim', vencimento: '', nota: '' });
// Item que está sendo digitado antes de entrar no carrinho.
// estoqueId: em qual item do estoque esta compra vai somar. Vazio = o sistema
// descobre pelo nome; 'nenhum' = ela disse que não controla isso no estoque.
// conteudo/conteudoUnid: o que vem DENTRO de cada um. "3 × Polenta 2kg" são 3
// na nota e 6 kg na prateleira. Vazio = 1 comprado vira 1 no estoque.
const itemVazio = () => ({ produto: '', categoria: '', quantidade: '', valorUnit: '', estoqueId: '', conteudo: '', conteudoUnid: '' });

// Mostra, ANTES de registrar, onde a compra vai cair no estoque.
//
// Era esse o buraco: a compra ia pra despesa e pra contas a pagar na hora, mas
// o saldo do estoque só subia se o nome batesse com um item cadastrado. Quando
// não batia, não acontecia nada e nada dizia nada. Agora o destino aparece na
// tela enquanto ela digita, e dá pra corrigir ali mesmo.
function DestinoEstoque({ item: linha, estoque, onLigar, compacto }) {
  const { produto, estoqueId } = linha;
  if (!produto) return null;
  const alvo = resolverCompraNoEstoque(linha, estoque);
  const entrada = alvo ? entradaDaCompra(linha, alvo.item) : null;
  const q = entrada ? entrada.qtd : (numQtd(linha.quantidade) || 0);
  const desligado = estoqueId === 'nenhum';
  const cor = alvo ? (entrada && entrada.erro ? C.amber : C.green) : desligado ? C.faint : C.amber;
  const base = { fontSize: compacto ? 11.5 : 12.5, color: cor, lineHeight: 1.45 };
  if (compacto) {
    const somaria = q > 0 ? ` (+${[q, alvo && alvo.item.unidade].filter(Boolean).join(' ')})` : '';
    return (
      <div style={base}>
        {alvo ? `→ estoque: ${alvo.item.nome}${somaria}`
          : desligado ? '→ fora do estoque' : '⚠️ não vai entrar no estoque'}
      </div>
    );
  }
  return (
    <div style={{ background: C.panel2, border: `1px solid ${cor}55`, borderRadius: 10, padding: 10, margin: '-4px 0 12px' }}>
      <div style={base}>
        {alvo ? (
          <>
            Vai somar no estoque em <b style={{ color: C.text }}>{alvo.item.nome}</b>
            {q > 0 && <> — <b style={{ color: C.text }}>+{q} {alvo.item.unidade || ''}</b></>}
            {entrada && entrada.convertido && entrada.custo > 0 && (
              <span style={{ color: C.muted }}> · custo {brl(entrada.custo)} por {alvo.item.unidade || 'un'}</span>
            )}
            {alvo.como === 'parecido' && <span style={{ color: C.muted }}> (casou pelo nome parecido — confere)</span>}
            {entrada && entrada.erro && <div style={{ color: C.amber, marginTop: 4 }}>⚠️ {entrada.erro} — vai entrar como {q} {alvo.item.unidade || 'un'}.</div>}
          </>
        ) : desligado ? (
          'Este produto não entra no estoque. Vai só pra despesa e pras contas.'
        ) : (
          <>Este produto <b>não está no estoque</b>, então esta compra não vai aumentar saldo nenhum — só vira despesa e conta a pagar. Liga ele a um item aqui embaixo, ou cadastra o produto em Abastecimento → Estoque.</>
        )}
      </div>
      <select
        value={estoqueId || (alvo ? alvo.item.id : '')}
        onChange={(e) => onLigar(e.target.value)}
        style={{ marginTop: 8, width: '100%', padding: '7px 9px', borderRadius: 9, fontSize: 12.5, background: C.panel, color: C.text, border: `1px solid ${C.line}` }}
      >
        <option value="">Descobrir pelo nome</option>
        {(estoque || []).map((it) => <option key={it.id} value={it.id}>{it.nome}{it.unidade ? ` (${it.unidade})` : ''}</option>)}
        <option value="nenhum">Não controlo isso no estoque</option>
      </select>
    </div>
  );
}

// Compras já registradas que nunca viraram saldo. Em vez de mandar ela digitar
// a nota de novo, lança com um toque — a conta já existe, falta só a prateleira.
// Fechado por padrão: é um aviso, não o assunto da tela. Aberto, vira a lista
// com os botões. Uma parede de 20 linhas com botão azul em cada uma estava
// tapando a tela de Compras, que é onde ela vem pra trabalhar.
function FaltouNoEstoque({ pendentes, onLancar, onDispensar, ocupado }) {
  const [aberto, setAberto] = useState(false);
  if (!pendentes.length) return null;
  const ids = pendentes.map((x) => x.compra.id);

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          background: 'transparent', border: `1px solid ${C.amber}55`, borderRadius: 10,
          padding: '9px 12px', marginBottom: 14, cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 12.5, color: C.amber, lineHeight: 1.4 }}>
          {pendentes.length} compra{pendentes.length > 1 ? 's' : ''} não somou saldo no estoque
        </span>
        <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>ver</span>
      </button>
    );
  }

  return (
    <Card style={{ marginBottom: 14, borderColor: `${C.amber}55` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.amber }}>Não somou no estoque ({pendentes.length})</div>
        <button onClick={() => setAberto(false)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer', padding: 2 }}>fechar</button>
      </div>
      <div style={{ fontSize: 12, color: C.muted, margin: '4px 0 10px', lineHeight: 1.5 }}>
        Já estão no financeiro, só não somaram saldo. Se tu já deu entrada na mão lá atrás, usa <b>Dispensar</b> — senão
        entra duas vezes.
      </div>
      <div style={{ maxHeight: 260, overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>
        {pendentes.map(({ compra: c, item, entrada }) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: `1px solid ${C.hair}` }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: C.text }}>{limparNome(c.produto)}</div>
              <div style={{ fontSize: 11.5, color: C.faint }}>
                {fmtDate(c.data)} · <b style={{ color: C.green }}>+{entrada.qtd} {item.unidade || 'un'}</b> em {item.nome}
                {entrada.convertido && entrada.custo > 0 ? ` · ${brl(entrada.custo)}/${item.unidade || 'un'}` : ''}
              </div>
            </div>
            <Btn small kind="ghost" onClick={() => onLancar([c.id])}>Entrar</Btn>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Btn small onClick={() => onLancar(ids)}>{ocupado ? 'Lançando…' : `Lançar todas (${pendentes.length})`}</Btn>
        <Btn small kind="ghost" onClick={() => onDispensar(ids)}>Dispensar todas</Btn>
      </div>
    </Card>
  );
}

export default function Compras({ dados, cotacoes, despesas = [], estoque = [], onChange, onRegistrar, onEstoque }) {
  // Sugestões de produto: os itens do ESTOQUE primeiro (esses fazem a compra
  // entrar automático), mais o que já foi comprado/cotado. Digitar e escolher a
  // sugestão garante o nome IGUAL — sem precisar decorar.
  const sugestoesProdutos = useMemo(() => [
    ...estoque.map((e) => e && e.nome),
    ...(Array.isArray(dados) ? dados : []).map((d) => d && d.produto),
    ...(Array.isArray(cotacoes) ? cotacoes : []).map((c) => c && c.produto),
  ].filter(Boolean), [estoque, dados, cotacoes]);
  const [compra, setCompra] = useState(compraVazia());
  const [item, setItem] = useState(itemVazio());
  const [carrinho, setCarrinho] = useState([]);
  const [gerarCotacao, setGerarCotacao] = useState(true);
  const [editId, setEditId] = useState(null);
  const [filtroMes, setFiltroMes] = useState(ymOf(todayISO()));
  const [busca, setBusca] = useState('');
  const [lancando, setLancando] = useState(false);
  const [msgLanc, setMsgLanc] = useState('');

  // Compras registradas que não viraram saldo. O servidor refaz esta conta antes
  // de gravar, então tocar duas vezes não soma duas vezes.
  const pendentes = useMemo(
    () => (onEstoque ? comprasPendentesDeEstoque(dados, estoque) : []),
    [dados, estoque, onEstoque],
  );

  const lancarNoEstoque = async (ids) => {
    if (lancando || !onEstoque) return;
    setLancando(true); setMsgLanc('');
    const j = await onEstoque({ acao: 'lancarCompras', ids });
    setLancando(false);
    if (j && j.ok) {
      setMsgLanc(j.lancadas
        ? `${j.lancadas} compra(s) no estoque: ${(j.resumo || []).map((r) => `${r.item} +${r.qtd} ${r.unidade}`).join(', ')}.`
        : 'Essas já estavam no estoque — não somei de novo.');
    } else setMsgLanc('Não consegui lançar agora. Tenta de novo.');
    setTimeout(() => setMsgLanc(''), 12000);
  };

  // Dispensar: marca como resolvida SEM mexer no saldo. É pra compra velha que
  // ela já deu entrada na mão — o aviso some e o estoque não é tocado.
  const dispensar = async (ids) => {
    if (lancando || !onEstoque) return;
    if (typeof window !== 'undefined' && !window.confirm(
      `Dispensar ${ids.length} compra(s)?\n\nO aviso some e o estoque NÃO muda. Usa isso quando tu já deu entrada nelas na mão.`,
    )) return;
    setLancando(true); setMsgLanc('');
    const j = await onEstoque({ acao: 'dispensarCompras', ids });
    setLancando(false);
    setMsgLanc(j && j.ok ? `${j.dispensadas} compra(s) dispensada(s). O estoque não mudou.` : 'Não consegui agora. Tenta de novo.');
    setTimeout(() => setMsgLanc(''), 10000);
  };

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
    let despesaNova = null;
    if (pago === 'Sim' && totalCarrinho > 0) {
      despId = uid();
      despesaNova = {
        id: despId, data: compra.data, categoria: 'Fornecedores de insumo',
        descricao: [forn, compra.nota && `Nota ${compra.nota}`].filter(Boolean).join(' · ') || 'Compra',
        valor: totalCarrinho.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        obs: `Compra ${compra.formaPagto.toLowerCase()} · ${carrinho.length} ${carrinho.length > 1 ? 'itens' : 'item'}`,
        origem: 'compra',
      };
    }

    const novasCompras = carrinho.map((it) => ({
      id: uid(), data: compra.data, produto: limparNome(it.produto), fornecedor: forn,
      categoria: it.categoria, quantidade: it.quantidade || '1', valorUnit: it.valorUnit || '0',
      formaPagto: compra.formaPagto, prazoDias: '', vencimento: venc, pago,
      dataPagamento: pago === 'Sim' ? compra.data : '', obs: '', nota: compra.nota,
      despesaId: despId || undefined,
      // Onde isto soma no estoque. Fica gravado na linha da compra pra que
      // conferir depois (e reaplicar) use a mesma ligação que ela viu na tela.
      estoqueId: it.estoqueId || '',
      conteudo: it.conteudo || '', conteudoUnid: it.conteudoUnid || '',
    }));

    let cotacoesNovas = null;
    if (gerarCotacao) {
      const novos = carrinho.filter((it) => num(it.valorUnit) > 0).map((it) => ({
        id: uid(), data: compra.data, produto: limparNome(it.produto), fornecedor: forn,
        preco: it.valorUnit, categoria: it.categoria,
      }));
      if (novos.length) cotacoesNovas = novos;
    }

    // Envia SÓ os itens novos (deltas). O pai junta ao que já existe usando o
    // estado mais recente — assim registrar uma compra logo depois de outra
    // nunca apaga a despesa/compra da anterior.
    onRegistrar({ comprasNovas: novasCompras, despesaNova, cotacoesNovas });
    setCompra(compraVazia()); setItem(itemVazio()); setCarrinho([]);
  };

  // Edição de uma linha existente (uma por vez, sem gerar cotação/despesa nova).
  const editar = (d) => {
    setEditId(d.id);
    setCompra({ data: d.data || todayISO(), fornecedor: d.fornecedor || '', formaPagto: d.formaPagto || 'À vista', pago: d.pago || 'Não', vencimento: d.vencimento || '', nota: d.nota || '' });
    setItem({ produto: d.produto || '', categoria: d.categoria || '', quantidade: d.quantidade || '', valorUnit: d.valorUnit || '', estoqueId: d.estoqueId || '', conteudo: d.conteudo || '', conteudoUnid: d.conteudoUnid || '' });
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
      estoqueId: item.estoqueId || '',
      conteudo: item.conteudo || '', conteudoUnid: item.conteudoUnid || '',
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
      <PageTitle sub="Itens comprados, com preço e fornecedor">Compras</PageTitle>
      <Resumo items={[
        { t: 'Compras', v: dados.length },
        { t: 'Total gasto', v: brl(gastoGeral), c: C.red },
        { t: 'Em aberto', v: emAberto, c: emAberto ? C.amber : C.faint },
      ]} />

      {msgLanc && <div style={{ fontSize: 13, color: C.green, fontWeight: 700, marginBottom: 12, lineHeight: 1.5 }}>{msgLanc}</div>}
      <FaltouNoEstoque pendentes={pendentes} onLancar={lancarNoEstoque} onDispensar={dispensar} ocupado={lancando} />

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
        <Field label="Produto"><TextInput value={item.produto} onChange={setI('produto')} placeholder="Comece a digitar — sugere o que já existe" list="compras-produtos" /></Field>
        <Sugestoes id="compras-produtos" itens={sugestoesProdutos} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Field label="Categoria"><Select value={item.categoria} onChange={setI('categoria')} options={CATEGORIAS_PRODUTO} /></Field>
          <Field label="Qtd"><NumInput value={item.quantidade} onChange={setI('quantidade')} /></Field>
          <Field label="Valor un. (R$)"><NumInput value={item.valorUnit} onChange={setI('valorUnit')} /></Field>
        </div>
        <DestinoEstoque item={item} estoque={estoque} onLigar={setI('estoqueId')} />
        {/* O que vem DENTRO de cada um. Sem isso, "3 x Polenta 2kg" soma 3 no
            estoque em vez de 6 kg, e grava o custo do pacote como se fosse o do
            quilo — o dobro em cada prato que usa polenta. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Cada um tem (opcional)"><NumInput value={item.conteudo} onChange={setI('conteudo')} placeholder="ex: 2" /></Field>
          <Field label="De quê"><Select value={item.conteudoUnid} onChange={setI('conteudoUnid')} options={UNIDADES} placeholder="kg, g, L, ml…" /></Field>
        </div>
        <div style={{ fontSize: 11.5, color: C.faint, margin: '-4px 0 10px', lineHeight: 1.45 }}>
          Só preenche quando a embalagem tem mais de uma unidade de uso dentro: pacote de 2 kg, fardo de 12, garrafa de 1 L.
          Aí o estoque soma o conteúdo, e não o número de pacotes.
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
                  <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: `1px solid ${C.hair}` }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: C.text }}>{it.produto}</div>
                      <div style={{ fontSize: 12, color: C.faint }}>{num(it.quantidade) || 1} × {brl(num(it.valorUnit))}{it.categoria ? ` · ${it.categoria}` : ''}</div>
                      <DestinoEstoque compacto item={it} estoque={estoque} onLigar={() => {}} />
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
                    : 'Compra em aberto: vai para Contas a Pagar; vira despesa quando você marcar como paga.'}
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
                  {/* Sem item de estoque com esse nome, esta linha nunca somou
                      saldo nenhum — e antes isso não aparecia em lugar nenhum. */}
                  {estoque.length > 0 && d.estoqueId !== 'nenhum' && !resolverCompraNoEstoque(d, estoque) && (
                    <div style={{ fontSize: 11.5, color: C.amber, marginTop: 3, lineHeight: 1.4 }}>
                      ⚠️ Sem item no estoque com esse nome — esta compra não somou saldo.
                    </div>
                  )}
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
