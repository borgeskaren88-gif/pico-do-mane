'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Select, Empty, Resumo, SecTitle, PageTitle, inputStyle } from './ui';
import { brl, num, fmtDate, limparNome, CATEGORIAS_PRODUTO } from '../lib/util';
import { UNIDADES, UNIDADES_CONTEUDO, MOTIVOS_SAIDA, igualNome } from '../lib/estoque';

const itemVazio = () => ({ nome: '', categoria: '', unidade: 'un', saldo: '', minimo: '', custo: '', conteudo: '', conteudoUnid: '' });

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
    const q = num(acaoQtd);
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

      {abaixoDoMin.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: C.red }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.red }}>Acabando ({abaixoDoMin.length})</div>
            {onRepor && <Btn small onClick={() => reporNaLista(abaixoDoMin)}>Repor todos na lista</Btn>}
          </div>
          {abaixoDoMin.map((it) => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTop: `1px solid ${C.hair}`, padding: '7px 0', fontSize: 14 }}>
              <span>{it.nome}</span>
              <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{num(it.saldo)} / mín. {num(it.minimo)} {it.unidade}</span>
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
          {!editId && <Field label="Qtd que tem hoje"><NumInput value={novo.saldo} onChange={set('saldo')} /></Field>}
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
          Só pra quem vende em fração: garrafa de <b>1000 ml</b> → a ficha da taça usa <b>ml</b> e o estoque baixa a garrafa certinho.
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
                      {minimo > 0 ? ` · mín. ${minimo}` : ''}{conteudoTxt}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: baixo ? C.red : C.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{saldo}</div>
                    <div style={{ fontSize: 11, color: C.faint }}>{it.unidade}{baixo ? ' · acabando' : ''}</div>
                  </div>
                </div>

                {acao && acao.id === it.id ? (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8 }}>
                      {rotuloAcao[acao.tipo]}{acao.tipo === 'contagem' ? ' — quanto tem AGORA?' : acao.tipo === 'entrada' ? ' — quanto entrou?' : ' — quanto saiu?'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ width: 110 }}><NumInput value={acaoQtd} onChange={setAcaoQtd} placeholder={acao.tipo === 'contagem' ? String(saldo) : '0'} /></div>
                      {acao.tipo === 'saida' && <div style={{ flex: 1, minWidth: 150 }}><Select value={acaoMotivo} onChange={setAcaoMotivo} options={MOTIVOS_SAIDA} /></div>}
                    </div>
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
                    {(it.movimentos || []).slice(0, 15).map((m) => (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.muted, padding: '3px 0' }}>
                        <span>{fmtDate(m.data)} · {m.motivo}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: (m.tipo === 'saida' || m.tipo === 'venda') ? C.red : m.tipo === 'contagem' ? C.muted : C.green }}>
                          {(m.tipo === 'saida' || m.tipo === 'venda') ? '−' : m.tipo === 'contagem' ? '=' : '+'}{m.tipo === 'contagem' ? m.saldoDepois : num(m.qtd)} → {m.saldoDepois}
                        </span>
                      </div>
                    ))}
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
