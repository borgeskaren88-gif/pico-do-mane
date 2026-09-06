'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Select, Empty, Resumo, SecTitle, PageTitle, inputStyle, QtdInput } from './ui';
import { brl, num, fmtDate, limparNome, todayISO, CATEGORIAS_PRODUTO, numQtd } from '../lib/util';
import { UNIDADES, UNIDADES_CONTEUDO, MOTIVOS_SAIDA, igualNome } from '../lib/estoque';

const itemVazio = () => ({ nome: '', categoria: '', unidade: 'un', saldo: '', minimo: '', custo: '', conteudo: '', conteudoUnid: '' });

// Mostra a quantidade no jeito brasileiro: vírgula no decimal e ponto no milhar.
// Sem isso, um saldo fracionário (ex.: barril de chopp em 1.817) parecia "1817".
const fmtQtd = (v) => Number(num(v).toFixed(3)).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

// Aba Estoque: catálogo de itens com saldo, mínimo, custo e "conteúdo por
// unidade" (pra diluir garrafa em doses). Toda mudança de saldo passa por ações
// atômicas na API (/api/estoque), pra ficar em sincronia com a baixa feita ao
// fechar as comandas — nada é sobrescrito.
export default function Estoque({ itens = [], carregado = true, onAcao, compras = [], onRepor }) {
  const [novo, setNovo] = useState(itemVazio());
  const [editId, setEditId] = useState(null);
  const [acao, setAcao] = useState(null);   // { id, tipo: 'entrada'|'saida'|'contagem' }
  const [acaoQtd, setAcaoQtd] = useState('');
  const [acaoMotivo, setAcaoMotivo] = useState(MOTIVOS_SAIDA[0]);
  const [verMov, setVerMov] = useState(null);
  const [menuMov, setMenuMov] = useState(null); // id do movimento com o menu corrigir/desfazer aberto
  const [busca, setBusca] = useState('');
  const [reposto, setReposto] = useState('');
  const [busy, setBusy] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [msgCorrige, setMsgCorrige] = useState('');
  const [catAberta, setCatAberta] = useState({}); // { [categoria]: true } — categoria expandida
  const toggleCat = (cat) => setCatAberta((m) => ({ ...m, [cat]: !m[cat] }));
  const set = (k) => (v) => setNovo((f) => ({ ...f, [k]: v }));

  const corrigirCustos = async () => {
    if (corrigindo) return;
    if (typeof window !== 'undefined' && !window.confirm('Recalcular os custos do estoque pelo preço da compra mais recente de cada item?\n\nUse para consertar valores que ficaram inflados. Itens sem compra correspondente não mudam.')) return;
    setCorrigindo(true); setMsgCorrige('');
    const j = await onAcao({ acao: 'corrigirCustos' });
    setCorrigindo(false);
    if (j && j.ok) setMsgCorrige(j.corrigidos > 0 ? `${j.corrigidos} custo(s) corrigido(s) pelas compras.` : 'Nenhum custo precisou de ajuste (ou faltam compras pra comparar).');
    else setMsgCorrige('Não consegui corrigir agora. Tente de novo.');
    setTimeout(() => setMsgCorrige(''), 6000);
  };

  const totais = useMemo(() => {
    let valor = 0, baixo = 0;
    for (const it of itens) {
      valor += num(it.saldo) * num(it.custo);
      if (num(it.minimo) > 0 && num(it.saldo) <= num(it.minimo)) baixo += 1;
    }
    return { valor, baixo };
  }, [itens]);

  const abaixoDoMin = useMemo(() => itens.filter((it) => num(it.minimo) > 0 && num(it.saldo) <= num(it.minimo)), [itens]);

  // "Para onde foi o estoque" no mês atual: junta as saídas de todos os itens e
  // separa por tipo (venda, perda/quebra, consumo da casa, outros), com o valor
  // em R$ (qtd baixada × custo do item). Lê o histórico que cada item já guarda.
  const [periodoSaidas, setPeriodoSaidas] = useState('mes'); // 'hoje' | 'mes'
  const saidasMes = useMemo(() => {
    const hoje = todayISO();
    const ym = hoje.slice(0, 7);
    const noPeriodo = (data) => (periodoSaidas === 'hoje' ? data === hoje : data.slice(0, 7) === ym);
    const cats = {
      vendas: { valor: 0, n: 0, itens: {} },
      perdas: { valor: 0, n: 0, itens: {} },
      consumo: { valor: 0, n: 0, itens: {} },
      cortesia: { valor: 0, n: 0, itens: {} },
      outros: { valor: 0, n: 0, itens: {} },
    };
    const catDe = (m) => {
      if (m.tipo === 'venda') return 'vendas';
      if (m.tipo !== 'saida') return null;
      const mo = (m.motivo || '').toLowerCase();
      if (/(perda|desperd|quebr|congel|estrag|venc)/.test(mo)) return 'perdas';
      if (/cortesia/.test(mo)) return 'cortesia';
      if (/(consumo|uso|casa)/.test(mo)) return 'consumo';
      if (/venda/.test(mo)) return 'vendas';
      return 'outros';
    };
    for (const it of itens) {
      for (const m of (it.movimentos || [])) {
        if (!m.data || !noPeriodo(m.data)) continue;
        const c = catDe(m);
        if (!c) continue;
        const val = num(m.qtd) * num(it.custo);
        cats[c].valor += val; cats[c].n += 1;
        const e = cats[c].itens[it.nome] || { valor: 0, qtd: 0, unidade: it.unidade || '' };
        e.valor += val; e.qtd += num(m.qtd);
        cats[c].itens[it.nome] = e;
      }
    }
    const total = cats.vendas.valor + cats.perdas.valor + cats.consumo.valor + cats.cortesia.valor + cats.outros.valor;
    const listaDe = (c) => Object.entries(c.itens).map(([nome, d]) => ({ nome, ...d })).sort((a, b) => b.valor - a.valor);
    return { cats, total, listaDe, temAlgo: (cats.vendas.n + cats.perdas.n + cats.consumo.n + cats.cortesia.n + cats.outros.n) > 0 };
  }, [itens, periodoSaidas]);
  const [verSaidas, setVerSaidas] = useState(false);
  const [catSaidaAberta, setCatSaidaAberta] = useState('');

  // Produtos já comprados que ainda não estão no estoque (sugestões).
  const sugestoes = useMemo(() => {
    const noEstoque = new Set(itens.map((it) => limparNome(it.nome).toLowerCase()));
    const map = new Map();
    for (const c of compras) {
      const nome = limparNome(c.produto);
      if (!nome) continue;
      const chave = nome.toLowerCase();
      if (noEstoque.has(chave)) continue;
      const anterior = map.get(chave);
      if (!anterior || (c.data || '') >= (anterior.data || '')) map.set(chave, { nome, categoria: c.categoria || '', custo: c.valorUnit || '', data: c.data || '' });
    }
    return [...map.values()].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [compras, itens]);

  const grupos = useMemo(() => {
    const filtro = busca.trim().toLowerCase();
    const ordem = [...CATEGORIAS_PRODUTO, ''];
    const map = new Map();
    for (const it of itens) {
      if (filtro && !(it.nome || '').toLowerCase().includes(filtro)) continue;
      const cat = it.categoria || '';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(it);
    }
    return [...map.entries()].sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
      .map(([cat, is]) => ({ cat: cat || 'Sem categoria', itens: is.sort((x, y) => (x.nome || '').localeCompare(y.nome || '')) }));
  }, [itens, busca]);

  const salvarItem = async () => {
    if (!novo.nome.trim() || busy) return;
    setBusy(true);
    if (editId) {
      await onAcao({ acao: 'edit', id: editId, campos: { nome: novo.nome, categoria: novo.categoria, unidade: novo.unidade || 'un', minimo: num(novo.minimo), custo: num(novo.custo), conteudo: num(novo.conteudo), conteudoUnid: novo.conteudoUnid } });
    } else {
      await onAcao({ acao: 'add', item: { nome: novo.nome, categoria: novo.categoria, unidade: novo.unidade || 'un', saldo: num(novo.saldo), minimo: num(novo.minimo), custo: num(novo.custo), conteudo: num(novo.conteudo), conteudoUnid: novo.conteudoUnid } });
    }
    setNovo(itemVazio()); setEditId(null); setBusy(false);
  };

  const editar = (it) => {
    setEditId(it.id);
    setNovo({ nome: it.nome || '', categoria: it.categoria || '', unidade: it.unidade || 'un', saldo: '', minimo: String(it.minimo ?? ''), custo: String(it.custo ?? ''), conteudo: String(it.conteudo ?? ''), conteudoUnid: it.conteudoUnid || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelar = () => { setNovo(itemVazio()); setEditId(null); };
  const excluir = async (id) => { if (!window.confirm('Excluir este item do estoque?')) return; if (id === editId) cancelar(); await onAcao({ acao: 'del', id }); };
  // "Desfazer": reverte o movimento no saldo (o que saiu volta; o que entrou
  // sai) E tira a linha. É o que usar quando o lançamento foi errado.
  const desfazerMov = async (itemId, movId) => {
    if (typeof window !== 'undefined' && !window.confirm('Desfazer este movimento?\n\nA quantidade volta ao estoque (ou sai, se era uma entrada). Use quando o lançamento foi errado.')) return;
    await onAcao({ acao: 'estornarMov', id: itemId, movId });
    setMenuMov(null);
  };
  // "Só apagar": tira a linha do histórico mas NÃO mexe no saldo — pra limpar um
  // registro antigo cujo saldo já foi acertado no Contar (ex.: some do resumo).
  const excluirMov = async (itemId, movId) => {
    if (typeof window !== 'undefined' && !window.confirm('Só apagar esta linha do histórico?\n\nO saldo de hoje NÃO muda — isso só tira o registro do resumo "Para onde foi". (Se você quer a quantidade de volta, use "Desfazer".)')) return;
    await onAcao({ acao: 'delMov', id: itemId, movId });
    setMenuMov(null);
  };

  const adicionarSugestao = async (s) => {
    if (itens.some((it) => igualNome(it.nome, s.nome)) || busy) return;
    setBusy(true);
    const j = await onAcao({ acao: 'add', item: { nome: s.nome, categoria: s.categoria, unidade: 'un', saldo: 0, custo: num(s.custo) } });
    setBusy(false);
    if (j && j.novoId) abrirAcao(j.novoId, 'contagem');
  };

  const abrirAcao = (id, tipo) => { setAcao({ id, tipo }); setAcaoQtd(''); setAcaoMotivo(MOTIVOS_SAIDA[0]); };
  const fecharAcao = () => { setAcao(null); setAcaoQtd(''); };
  const confirmarAcao = async () => {
    if (String(acaoQtd).trim() === '' || busy) return;
    const q = numQtd(acaoQtd);
    if (acao.tipo !== 'contagem' && !(q > 0)) return;
    setBusy(true);
    await onAcao({ acao: 'mov', id: acao.id, tipo: acao.tipo, qtd: q, motivo: acao.tipo === 'saida' ? acaoMotivo : undefined });
    setBusy(false); fecharAcao();
  };

  const reporNaLista = (lista) => {
    if (!onRepor) return;
    const add = onRepor(lista.map((it) => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), nome: it.nome, quantidade: '', categoria: it.categoria || '', comprado: false, criadoEm: Date.now() })));
    setReposto(add === 0 ? 'Já estavam na Lista de Compras.' : `${add} item(ns) adicionado(s) à Lista de Compras.`);
    setTimeout(() => setReposto(''), 3000);
  };

  const rotuloAcao = { entrada: 'Entrada', saida: 'Saída', contagem: 'Contagem' };

  return (
    <div>
      <Resumo items={[
        { t: 'Itens', v: itens.length },
        { t: 'Abaixo do mínimo', v: totais.baixo, c: totais.baixo ? C.red : C.faint },
        { t: 'Valor em estoque', v: brl(totais.valor), c: C.green },
      ]} />

      <PageTitle sub="Quanto você tem, o que está acabando e quanto está parado em mercadoria">Estoque</PageTitle>

      {reposto && <Card style={{ marginBottom: 12, borderColor: C.green }}><div style={{ fontSize: 14, color: C.green, fontWeight: 700 }}>{reposto}</div></Card>}

      <Card style={{ marginBottom: 12, background: C.panel2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Custos com valor estranho?</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>Recalcula o custo de cada item pelo preço da compra mais recente. Conserta valores inflados de uma vez.</div>
          </div>
          <Btn small onClick={corrigirCustos}>{corrigindo ? 'Corrigindo…' : 'Corrigir custos'}</Btn>
        </div>
        {msgCorrige && <div style={{ fontSize: 13, color: C.green, fontWeight: 700, marginTop: 8 }}>{msgCorrige}</div>}
      </Card>

      {/* Para onde foi o estoque este mês: venda x perda x consumo da casa. */}
      <Card style={{ marginBottom: 14 }}>
        <button onClick={() => setVerSaidas((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
          <span style={{ color: C.accent, fontSize: 12, fontWeight: 800, width: 12, flexShrink: 0 }}>{verSaidas ? '▾' : '▸'}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Para onde foi o estoque</span>
            <span style={{ fontSize: 12, color: C.muted, display: 'block', marginTop: 1 }}>{periodoSaidas === 'hoje' ? 'Hoje' : 'Este mês'} · saídas por venda, perda e consumo da casa</span>
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(saidasMes.total)}</span>
        </button>
        {verSaidas && (
          <div style={{ marginTop: 12, borderTop: `1px solid ${C.hair}`, paddingTop: 10 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[['hoje', 'Hoje'], ['mes', 'Este mês']].map(([v, rot]) => (
                <button key={v} onClick={() => setPeriodoSaidas(v)} style={{ border: `1px solid ${periodoSaidas === v ? C.accent : C.line}`, background: periodoSaidas === v ? C.accent : 'transparent', color: periodoSaidas === v ? '#06101F' : C.muted, borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{rot}</button>
              ))}
            </div>
            {!saidasMes.temAlgo ? (
              <div style={{ fontSize: 13, color: C.faint }}>Nenhuma saída registrada {periodoSaidas === 'hoje' ? 'hoje' : 'este mês'} ainda.</div>
            ) : (
              [
                { k: 'vendas', rot: 'Vendas', desc: 'virou prato/drink vendido', cor: C.green },
                { k: 'perdas', rot: 'Perdas e desperdício', desc: 'desperdício, vencido, quebra', cor: C.red },
                { k: 'consumo', rot: 'Consumo da casa', desc: 'consumo próprio da casa', cor: C.amber },
                { k: 'cortesia', rot: 'Cortesias', desc: 'liberadas de graça pro cliente', cor: C.accent2 },
                { k: 'outros', rot: 'Outros ajustes', desc: 'ajustes e saídas diversas', cor: C.muted },
              ].map(({ k, rot, desc, cor }) => {
                const c = saidasMes.cats[k];
                if (c.n === 0) return null;
                const aberta = catSaidaAberta === k;
                return (
                  <div key={k} style={{ borderTop: `1px solid ${C.hair}`, paddingTop: 8, marginTop: 8 }}>
                    <button onClick={() => setCatSaidaAberta(aberta ? '' : k)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: cor, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{rot}</span>
                        <span style={{ fontSize: 11, color: C.faint, display: 'block' }}>{desc} · {c.n} saída(s)</span>
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(c.valor)}</span>
                    </button>
                    {aberta && (
                      <div style={{ marginTop: 8, marginLeft: 19 }}>
                        {saidasMes.listaDe(c).map((x) => (
                          <div key={x.nome} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '3px 0', color: C.muted }}>
                            <span style={{ minWidth: 0 }}>{x.nome}</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{Number((x.qtd || 0).toFixed(3)).toLocaleString('pt-BR')} {x.unidade} · {brl(x.valor)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div style={{ fontSize: 11, color: C.faint, marginTop: 10, lineHeight: 1.4 }}>Valores estimados pelo custo de cada item. Isso não é o DRE — é só pra você ver para onde a mercadoria está indo.</div>
          </div>
        )}
      </Card>

      {abaixoDoMin.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: C.red }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.red }}>Acabando ({abaixoDoMin.length})</div>
            {onRepor && <Btn small onClick={() => reporNaLista(abaixoDoMin)}>Repor todos na lista</Btn>}
          </div>
          {abaixoDoMin.map((it) => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTop: `1px solid ${C.hair}`, padding: '7px 0', fontSize: 14 }}>
              <span>{it.nome}</span>
              <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{fmtQtd(it.saldo)} / mín. {fmtQtd(it.minimo)} {it.unidade}</span>
            </div>
          ))}
        </Card>
      )}

      {sugestoes.length > 0 && (
        <Card style={{ marginBottom: 14, background: C.panel2 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.accent, marginBottom: 4 }}>Começar a controlar ({sugestoes.length})</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.4 }}>
            Produtos que já apareceram nas Compras mas ainda não estão no estoque. Toque para começar a controlar (o app já pergunta quanto você tem hoje).
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sugestoes.slice(0, 24).map((s) => (
              <button key={s.nome} onClick={() => adicionarSugestao(s)} disabled={busy} style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text, borderRadius: 999, padding: '7px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: C.accent, fontWeight: 800 }}>+</span> {s.nome}
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{editId ? 'Editar item' : 'Novo item de estoque'}</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
          {editId ? 'Ajuste os dados. Para mudar a quantidade, use os botões Entrada / Saída / Contar.' : 'Cadastre um item pra controlar. Depois, as Compras somam sozinhas no saldo.'}
        </div>
        <Field label="Produto"><TextInput value={novo.nome} onChange={set('nome')} placeholder="Cerveja Original 600ml, Carne, Gin…" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
          <Field label="Categoria"><Select value={novo.categoria} onChange={set('categoria')} options={CATEGORIAS_PRODUTO} /></Field>
          <Field label="Unidade"><Select value={novo.unidade} onChange={set('unidade')} options={UNIDADES} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: editId ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
          {!editId && <Field label="Qtd que tem hoje"><QtdInput value={novo.saldo} onChange={set('saldo')} /></Field>}
          <Field label="Estoque mínimo"><NumInput value={novo.minimo} onChange={set('minimo')} /></Field>
          <Field label="Custo un. (R$)"><NumInput value={novo.custo} onChange={set('custo')} /></Field>
        </div>
        {/* Conteúdo por unidade: pra diluir garrafa em doses/taças. */}
        <Field label="Conteúdo por unidade (opcional)">
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}><NumInput value={novo.conteudo} onChange={set('conteudo')} placeholder="ex.: 1000" /></div>
            <div style={{ width: 90 }}><Select value={novo.conteudoUnid} onChange={set('conteudoUnid')} options={UNIDADES_CONTEUDO} placeholder="—" /></div>
          </div>
        </Field>
        <div style={{ fontSize: 11, color: C.faint, margin: '-6px 0 12px', lineHeight: 1.4 }}>
          Pra quem vende em fração ou usa parte da embalagem: garrafa de <b>1000 ml</b> → a ficha da taça usa <b>ml</b>; pacote de <b>50 un</b> (alumínio) → a ficha usa <b>1 un</b> e o estoque baixa o pacote certinho.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={salvarItem}>{editId ? 'Salvar item' : 'Adicionar ao estoque'}</Btn>
          {editId && <Btn kind="ghost" onClick={cancelar}>Cancelar</Btn>}
        </div>
      </Card>

      <SecTitle>Meu estoque ({itens.length})</SecTitle>
      {itens.length > 6 && <div style={{ marginBottom: 12 }}><TextInput value={busca} onChange={setBusca} placeholder="Buscar item…" /></div>}
      {!carregado ? <Empty>Carregando…</Empty> : itens.length === 0 ? (
        <Empty>Seu estoque está vazio.<br />Cadastre um item acima, ou use as sugestões das suas compras. 👆</Empty>
      ) : grupos.map((g) => {
        const buscando = busca.trim().length > 0;
        const aberto = buscando || !!catAberta[g.cat];
        const valorCat = g.itens.reduce((s, it) => s + num(it.saldo) * num(it.custo), 0);
        const baixoCat = g.itens.some((it) => num(it.minimo) > 0 && num(it.saldo) <= num(it.minimo));
        return (
        <div key={g.cat} style={{ marginBottom: aberto ? 14 : 8 }}>
          <button onClick={() => toggleCat(g.cat)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: C.panel, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', boxShadow: C.cardShadow }}>
            <span style={{ color: C.accent, fontSize: 12, fontWeight: 800, width: 12, flexShrink: 0 }}>{aberto ? '▾' : '▸'}</span>
            <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em', color: C.accent, fontWeight: 800, flex: 1, minWidth: 0 }}>{g.cat}</span>
            {baixoCat && <span title="Tem item acabando" style={{ width: 8, height: 8, borderRadius: 999, background: C.red, flexShrink: 0 }} />}
            <span style={{ fontSize: 12, color: C.faint, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{g.itens.length} · {brl(valorCat)}</span>
          </button>
          {aberto && <div style={{ marginTop: 8 }}>
          {g.itens.map((it) => {
            const saldo = num(it.saldo), minimo = num(it.minimo), custo = num(it.custo);
            const baixo = minimo > 0 && saldo <= minimo;
            const aberto = verMov === it.id;
            const conteudoTxt = num(it.conteudo) > 0 && it.conteudoUnid ? ` · ${num(it.conteudo)} ${it.conteudoUnid}/${it.unidade}` : '';
            return (
              <Card key={it.id} style={{ marginBottom: 8, padding: 14, borderColor: baixo ? C.red : C.cardBorder }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{it.nome}</div>
                    <div style={{ fontSize: 12, color: C.faint, marginTop: 3 }}>
                      {custo > 0 ? `${brl(custo)}/${it.unidade} · em estoque ${brl(saldo * custo)}` : `unidade: ${it.unidade}`}
                      {minimo > 0 ? ` · mín. ${fmtQtd(minimo)}` : ''}{conteudoTxt}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: baixo ? C.red : C.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fmtQtd(saldo)}</div>
                    <div style={{ fontSize: 11, color: C.faint }}>{it.unidade}{baixo ? ' · acabando' : ''}</div>
                  </div>
                </div>

                {acao && acao.id === it.id ? (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8 }}>
                      {rotuloAcao[acao.tipo]}{acao.tipo === 'contagem' ? ' — quanto tem AGORA?' : acao.tipo === 'entrada' ? ' — quanto entrou?' : ' — quanto saiu?'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ width: 110 }}><QtdInput value={acaoQtd} onChange={setAcaoQtd} placeholder={acao.tipo === 'contagem' ? String(saldo) : '0'} /></div>
                      {acao.tipo === 'saida' && <div style={{ flex: 1, minWidth: 150 }}><Select value={acaoMotivo} onChange={setAcaoMotivo} options={MOTIVOS_SAIDA} /></div>}
                    </div>
                    {/* Prévia do que o sistema entendeu. Digitar "12.992" pensando
                        em 12 kg e 992 g virava doze mil — agora dá pra ver antes. */}
                    {(() => {
                      const q = numQtd(acaoQtd);
                      if (!(q > 0)) return null;
                      const depois = acao.tipo === 'contagem' ? q : acao.tipo === 'entrada' ? saldo + q : saldo - q;
                      const absurdo = q >= 1000 && saldo > 0 && q > saldo * 50;
                      return (
                        <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.5, color: absurdo ? C.amber : C.muted }}>
                          Entendi <b style={{ color: absurdo ? C.amber : C.text }}>{fmtQtd(q)} {it.unidade}</b>
                          {acao.tipo === 'contagem' ? ` — o saldo vai de ${fmtQtd(saldo)} pra ${fmtQtd(depois)} ${it.unidade}.` : ` — o saldo fica em ${fmtQtd(depois)} ${it.unidade}.`}
                          {absurdo && <><br /><b>Confere:</b> isso é bem mais que o saldo de agora. Se são gramas, escreve com <b>vírgula</b> (12,992 = 12 kg e 992 g). Com ponto, o sistema lê 12.992 como doze mil novecentos e noventa e dois.</>}
                        </div>
                      );
                    })()}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <Btn small onClick={confirmarAcao}>Confirmar</Btn>
                      <Btn kind="ghost" small onClick={fecharAcao}>Cancelar</Btn>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                    <Btn kind="ok" small onClick={() => abrirAcao(it.id, 'entrada')}>+ Entrada</Btn>
                    <Btn kind="danger" small onClick={() => abrirAcao(it.id, 'saida')}>− Saída</Btn>
                    <Btn kind="ghost" small onClick={() => abrirAcao(it.id, 'contagem')}>Contar</Btn>
                    <Btn kind="ghost" small onClick={() => editar(it)}>Editar</Btn>
                    {(it.movimentos || []).length > 0 && (
                      <button onClick={() => setVerMov(aberto ? null : it.id)} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '7px 6px' }}>{aberto ? 'ocultar' : 'histórico'}</button>
                    )}
                    <button onClick={() => excluir(it.id)} title="Excluir" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '4px 6px', marginLeft: 'auto' }}>×</button>
                  </div>
                )}

                {aberto && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${C.hair}`, paddingTop: 8 }}>
                    {(it.movimentos || []).slice(0, 15).map((m) => {
                      const podeDesfazer = ['saida', 'venda', 'entrada', 'compra'].includes(m.tipo);
                      const menu = menuMov === m.id;
                      return (
                      <div key={m.id} style={{ padding: '3px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.muted, alignItems: 'center' }}>
                          <span style={{ minWidth: 0 }}>{fmtDate(m.data)} · {m.motivo}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span style={{ fontVariantNumeric: 'tabular-nums', color: (m.tipo === 'saida' || m.tipo === 'venda') ? C.red : m.tipo === 'contagem' ? C.muted : C.green }}>
                              {(m.tipo === 'saida' || m.tipo === 'venda') ? '−' : m.tipo === 'contagem' ? '=' : '+'}{m.tipo === 'contagem' ? m.saldoDepois : num(m.qtd)} → {m.saldoDepois}
                            </span>
                            <button onClick={() => setMenuMov(menu ? null : m.id)} title="Corrigir esta linha" style={{ background: 'none', border: 'none', color: menu ? C.accent : C.faint, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>×</button>
                          </span>
                        </div>
                        {menu && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 6, marginBottom: 4 }}>
                            {podeDesfazer && <Btn kind="ok" small onClick={() => desfazerMov(it.id, m.id)}>Desfazer (volta o estoque)</Btn>}
                            <Btn kind="ghost" small onClick={() => excluirMov(it.id, m.id)}>Só apagar do histórico</Btn>
                            <Btn kind="ghost" small onClick={() => setMenuMov(null)}>Cancelar</Btn>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
          </div>}
        </div>
        );
      })}
    </div>
  );
}
