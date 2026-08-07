'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Select, Empty, SecTitle, PageTitle } from './ui';
import { brl, num, todayISO, addDays, fmtDate, uid, limparNome, CATEGORIAS_PRODUTO } from '../lib/util';
import MicBtn from './MicBtn';

const itemVazio = () => ({ nome: '', quantidade: '', categoria: '' });

// Formata quando a cozinha deu OK numa tarefa (aceita ISO ou timestamp).
const fmtQuando = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dia} às ${hora}`;
};

export default function ListaCompras({ itens = [], modelos = [], cotacoes = [], compras = [], despesas = [], onAplicar, tarefasCozinha = [], onTarefasCozinha, subtitulo, mostrarTarefasCozinha = false }) {
  const [novo, setNovo] = useState(itemVazio());
  const [novaTarefaCoz, setNovaTarefaCoz] = useState('');
  const addTarefaCoz = () => { if (!novaTarefaCoz.trim() || !onTarefasCozinha) return; onTarefasCozinha([{ id: uid(), texto: novaTarefaCoz.trim() }, ...tarefasCozinha]); setNovaTarefaCoz(''); };
  const removerTarefaCoz = (id) => onTarefasCozinha && onTarefasCozinha(tarefasCozinha.filter((t) => t.id !== id));
  const [editId, setEditId] = useState(null);
  const [marcandoId, setMarcandoId] = useState(null);
  const [lancForm, setLancForm] = useState({ quantidade: '1', valor: '', fornecedor: '', forma: 'À vista', vencimento: '' });
  const [nomeModelo, setNomeModelo] = useState('');
  const [verComprados, setVerComprados] = useState(false);
  // Lançamento em lote: vários itens do mesmo fornecedor num boleto só.
  const [selForn, setSelForn] = useState(null);
  const [selItens, setSelItens] = useState({});
  const [boleto, setBoleto] = useState({ fornecedor: '', forma: 'A prazo', vencimento: '', nota: '' });
  const set = (k) => (v) => setNovo((f) => ({ ...f, [k]: v }));
  const setLanc = (k) => (v) => setLancForm((f) => ({ ...f, [k]: v }));
  const setBol = (k) => (v) => setBoleto((f) => ({ ...f, [k]: v }));
  const setSelItem = (id, k) => (v) => setSelItens((m) => ({ ...m, [id]: { ...m[id], [k]: v } }));
  const toggleSel = (id) => setSelItens((m) => ({ ...m, [id]: { ...m[id], sel: !m[id]?.sel } }));

  // Melhor preço já cotado para um produto (menor preço entre os fornecedores).
  const melhorCotacao = (nome) => {
    const key = limparNome(nome || '').toLowerCase();
    if (!key) return null;
    const matches = cotacoes.filter((c) => limparNome(c.produto || '').toLowerCase() === key && num(c.preco) > 0);
    if (!matches.length) return null;
    const best = matches.reduce((a, b) => (num(a.preco) <= num(b.preco) ? a : b));
    return { preco: num(best.preco), fornecedor: limparNome(best.fornecedor || '') };
  };

  const ativos = itens.filter((i) => !i.comprado);
  const comprados = itens.filter((i) => i.comprado);

  // Agrupa os itens em aberto por fornecedor (o do item, ou o do melhor preço
  // cotado), virando um "pedido" por fornecedor.
  const grupos = useMemo(() => {
    const map = new Map();
    for (const it of ativos) {
      const best = melhorCotacao(it.nome);
      const forn = (it.fornecedor && it.fornecedor.trim()) || best?.fornecedor || 'A definir';
      let g = map.get(forn);
      if (!g) { g = { fornecedor: forn, itens: [], estimativa: 0, temPreco: false }; map.set(forn, g); }
      g.itens.push({ ...it, best });
      if (best) { g.estimativa += (num(it.quantidade) || 1) * best.preco; g.temPreco = true; }
    }
    return [...map.values()].sort((a, b) => (a.fornecedor === 'A definir' ? 1 : b.fornecedor === 'A definir' ? -1 : a.fornecedor.localeCompare(b.fornecedor)));
  }, [itens, cotacoes]);

  const salvarItem = () => {
    if (!novo.nome.trim()) return;
    const limpo = { nome: novo.nome.trim(), quantidade: novo.quantidade.trim(), categoria: novo.categoria };
    if (editId) onAplicar({ listaCompras: itens.map((i) => (i.id === editId ? { ...i, ...limpo } : i)) });
    else onAplicar({ listaCompras: [{ id: uid(), ...limpo, comprado: false, criadoEm: Date.now() }, ...itens] });
    setNovo(itemVazio()); setEditId(null);
  };
  const editarItem = (it) => { setNovo({ nome: it.nome || '', quantidade: it.quantidade || '', categoria: it.categoria || '' }); setEditId(it.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const excluirItem = (id) => { if (id === editId) { setNovo(itemVazio()); setEditId(null); } if (id === marcandoId) setMarcandoId(null); onAplicar({ listaCompras: itens.filter((i) => i.id !== id) }); };

  const abrirLancar = (it) => {
    const best = melhorCotacao(it.nome);
    setMarcandoId(it.id);
    setLancForm({
      quantidade: num(it.quantidade) > 0 ? String(num(it.quantidade)).replace('.', ',') : '1',
      valor: best ? best.preco.toFixed(2).replace('.', ',') : '',
      fornecedor: (it.fornecedor && it.fornecedor.trim()) || best?.fornecedor || '',
      forma: 'À vista', vencimento: addDays(todayISO(), 7),
    });
  };
  const soMarcar = (it) => { onAplicar({ listaCompras: itens.map((x) => (x.id === it.id ? { ...x, comprado: true, compradoEm: Date.now() } : x)) }); setMarcandoId(null); };
  const desmarcar = (it) => onAplicar({ listaCompras: itens.map((x) => (x.id === it.id ? { ...x, comprado: false, lancado: false } : x)) });

  const lancar = (it) => {
    const hoje = todayISO();
    const aVista = lancForm.forma === 'À vista';
    const unit = lancForm.valor || '0';
    const qtd = num(lancForm.quantidade) > 0 ? num(lancForm.quantidade) : 1;
    const total = qtd * num(unit);
    const totalStr = total.toFixed(2).replace('.', ',');
    const forn = lancForm.fornecedor.trim();
    const despId = aVista ? uid() : '';
    const compraEntry = {
      id: uid(), data: hoje, produto: it.nome, fornecedor: forn, categoria: it.categoria || '',
      quantidade: String(qtd), valorUnit: unit, formaPagto: aVista ? 'À vista' : 'Prazo', prazoDias: '',
      vencimento: aVista ? '' : (lancForm.vencimento || ''), pago: aVista ? 'Sim' : 'Não',
      dataPagamento: aVista ? hoje : '', despesaId: despId, obs: 'Lista de compras',
    };
    const payload = {
      listaCompras: itens.map((x) => (x.id === it.id ? { ...x, comprado: true, lancado: true, compradoEm: Date.now() } : x)),
      compras: [compraEntry, ...compras],
    };
    if (aVista) payload.despesas = [{ id: despId, data: hoje, categoria: 'Fornecedores de insumo', descricao: [forn, it.nome].filter(Boolean).join(' · ') || it.nome, valor: totalStr, obs: 'Compra à vista (lista de compras)', origem: 'lista-compras' }, ...despesas];
    if (num(unit) > 0 && forn) payload.cotacoes = [{ id: uid(), data: hoje, produto: it.nome, fornecedor: forn, preco: unit, categoria: it.categoria || '' }, ...cotacoes];
    onAplicar(payload);
    setMarcandoId(null);
  };

  // --- Lançar vários itens num boleto só (mesmo fornecedor) ---
  const abrirBoleto = (g) => {
    const map = {};
    for (const it of g.itens) {
      map[it.id] = {
        sel: true,
        quantidade: num(it.quantidade) > 0 ? String(num(it.quantidade)).replace('.', ',') : '1',
        valor: it.best ? it.best.preco.toFixed(2).replace('.', ',') : '',
      };
    }
    setSelItens(map);
    setBoleto({ fornecedor: g.fornecedor && g.fornecedor !== 'A definir' ? g.fornecedor : '', forma: 'A prazo', vencimento: addDays(todayISO(), 7), nota: '' });
    setSelForn(g.fornecedor);
    setMarcandoId(null);
  };
  const cancelarBoleto = () => { setSelForn(null); setSelItens({}); };

  const lancarBoleto = (g) => {
    const hoje = todayISO();
    const aVista = boleto.forma === 'À vista';
    const selecionados = g.itens.filter((it) => selItens[it.id]?.sel);
    if (!selecionados.length) return;
    const forn = boleto.fornecedor.trim();
    // Uma "nota" compartilhada faz os itens virarem UM boleto só em Contas a Pagar.
    const nota = aVista ? '' : (boleto.nota.trim() || `LC-${Date.now().toString(36).slice(-5).toUpperCase()}`);
    const despId = aVista ? uid() : '';
    let total = 0;
    const novasCompras = [];
    const novasCotacoes = [];
    const idsSel = new Set(selecionados.map((it) => it.id));
    for (const it of selecionados) {
      const f = selItens[it.id];
      const unit = f.valor || '0';
      const qtd = num(f.quantidade) > 0 ? num(f.quantidade) : 1;
      total += qtd * num(unit);
      novasCompras.push({
        id: uid(), data: hoje, produto: it.nome, fornecedor: forn, categoria: it.categoria || '',
        quantidade: String(qtd), valorUnit: unit, formaPagto: aVista ? 'À vista' : 'Prazo', prazoDias: '',
        vencimento: aVista ? '' : (boleto.vencimento || ''), pago: aVista ? 'Sim' : 'Não',
        dataPagamento: aVista ? hoje : '', despesaId: despId, nota, obs: 'Lista de compras',
      });
      if (num(unit) > 0 && forn) novasCotacoes.push({ id: uid(), data: hoje, produto: it.nome, fornecedor: forn, preco: unit, categoria: it.categoria || '' });
    }
    const payload = {
      listaCompras: itens.map((x) => (idsSel.has(x.id) ? { ...x, comprado: true, lancado: true, compradoEm: Date.now() } : x)),
      compras: [...novasCompras, ...compras],
    };
    if (novasCotacoes.length) payload.cotacoes = [...novasCotacoes, ...cotacoes];
    if (aVista) {
      const nomes = selecionados.map((it) => it.nome).slice(0, 3).join(', ') + (selecionados.length > 3 ? '…' : '');
      payload.despesas = [{ id: despId, data: hoje, categoria: 'Fornecedores de insumo', descricao: [forn, nomes].filter(Boolean).join(' · ') || nomes, valor: total.toFixed(2).replace('.', ','), obs: `Compra à vista (lista de compras · ${selecionados.length} itens)`, origem: 'lista-compras' }, ...despesas];
    }
    onAplicar(payload);
    cancelarBoleto();
  };

  const limparComprados = () => onAplicar({ listaCompras: itens.filter((i) => !i.comprado) });

  // Modelos (listas recorrentes).
  const salvarModelo = () => {
    if (!nomeModelo.trim() || ativos.length === 0) return;
    const modelo = { id: uid(), nome: nomeModelo.trim(), itens: ativos.map((i) => ({ nome: i.nome, quantidade: i.quantidade || '', categoria: i.categoria || '' })) };
    onAplicar({ listasModelo: [modelo, ...modelos] });
    setNomeModelo('');
  };
  const carregarModelo = (modelo) => {
    const novos = modelo.itens.map((i) => ({ id: uid(), nome: i.nome, quantidade: i.quantidade || '', categoria: i.categoria || '', comprado: false, criadoEm: Date.now() }));
    onAplicar({ listaCompras: [...novos, ...itens] });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const excluirModelo = (id) => onAplicar({ listasModelo: modelos.filter((m) => m.id !== id) });

  const Check = ({ marcado, onClick }) => (
    <button onClick={onClick} aria-label={marcado ? 'Desmarcar' : 'Marcar como comprado'}
      style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, cursor: 'pointer', border: `2px solid ${marcado ? C.green : C.line}`, background: marcado ? C.green : 'transparent' }} />
  );

  return (
    <div>
      <PageTitle sub={subtitulo || 'O que falta repor no bar'}>Lista de Compras</PageTitle>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>{editId ? 'Editar item' : 'Adicionar item'}</div>
        <Field label="O que falta?">
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}><TextInput value={novo.nome} onChange={set('nome')} placeholder="Gelo, limão, Skol 269…" /></div>
            <MicBtn value={novo.nome} onChange={set('nome')} />
          </div>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Quantidade"><TextInput value={novo.quantidade} onChange={set('quantidade')} placeholder="2 fardos, 5kg…" /></Field>
          <Field label="Categoria"><Select value={novo.categoria} onChange={set('categoria')} options={CATEGORIAS_PRODUTO} /></Field>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={salvarItem}>{editId ? 'Salvar' : 'Adicionar'}</Btn>
          {editId && <Btn kind="ghost" onClick={() => { setNovo(itemVazio()); setEditId(null); }}>Cancelar</Btn>}
        </div>
      </Card>

      <SecTitle>A comprar ({ativos.length})</SecTitle>
      {ativos.length === 0 ? <Empty>Lista vazia.<br />Anote o que está faltando no bar — ou carregue uma lista-modelo abaixo.</Empty> :
        grupos.map((g) => (
          <Card key={g.fornecedor} style={{ marginBottom: 10, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{g.fornecedor}<span style={{ fontSize: 12, color: C.faint, fontWeight: 400 }}> · {g.itens.length} item{g.itens.length > 1 ? 's' : ''}</span></div>
              {g.temPreco && <div style={{ fontSize: 12, color: C.muted }}>~ <b style={{ color: C.text }}>{brl(g.estimativa)}</b></div>}
            </div>
            {g.itens.length > 1 && selForn !== g.fornecedor && (
              <button onClick={() => abrirBoleto(g)} style={{ background: 'none', border: `1px solid ${C.accent}`, color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, borderRadius: 8, padding: '5px 10px', marginBottom: 2 }}>
                Comprei vários — lançar num boleto só
              </button>
            )}
            {selForn === g.fornecedor ? (() => {
              const totalBoleto = g.itens.reduce((s, it) => { const f = selItens[it.id]; if (!f?.sel) return s; const q = num(f.quantidade) > 0 ? num(f.quantidade) : 1; return s + q * num(f.valor); }, 0);
              const qtdeSel = g.itens.filter((it) => selItens[it.id]?.sel).length;
              const aVista = boleto.forma === 'À vista';
              return (
                <div style={{ background: C.panel2, border: `1px solid ${C.accent}`, borderRadius: 10, padding: 12, marginTop: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Boleto único — marque os itens deste fornecedor</div>
                  <div style={{ fontSize: 11, color: C.faint, marginBottom: 10 }}>Confira quantidade e valor unitário de cada um. Tudo vira {aVista ? 'uma despesa' : 'uma conta a pagar'} só.</div>
                  {g.itens.map((it) => {
                    const f = selItens[it.id] || {};
                    return (
                      <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${C.line}`, paddingTop: 8, marginTop: 8, opacity: f.sel ? 1 : 0.45 }}>
                        <button onClick={() => toggleSel(it.id)} aria-label={f.sel ? 'Tirar do boleto' : 'Pôr no boleto'}
                          style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: 'pointer', border: `2px solid ${f.sel ? C.accent : C.line}`, background: f.sel ? C.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {f.sel && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>}
                        </button>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600 }}>{it.nome}</div>
                        <div style={{ width: 56, flexShrink: 0 }}><NumInput value={f.quantidade || ''} onChange={setSelItem(it.id, 'quantidade')} /></div>
                        <span style={{ fontSize: 12, color: C.faint }}>×</span>
                        <div style={{ width: 82, flexShrink: 0 }}><NumInput value={f.valor || ''} onChange={setSelItem(it.id, 'valor')} /></div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                    <Field label="Fornecedor"><TextInput value={boleto.fornecedor} onChange={setBol('fornecedor')} placeholder="Ambev…" /></Field>
                    <div style={{ display: 'grid', gridTemplateColumns: aVista ? '1fr' : '1fr 1fr', gap: 10 }}>
                      <Field label="Pagamento"><Select value={boleto.forma} onChange={setBol('forma')} options={['À vista', 'A prazo']} /></Field>
                      {!aVista && <Field label="Vencimento"><TextInput type="date" value={boleto.vencimento} onChange={setBol('vencimento')} /></Field>}
                    </div>
                    {!aVista && <Field label="Nº do boleto / nota (opcional)"><TextInput value={boleto.nota} onChange={setBol('nota')} placeholder="Deixe em branco se não tiver" /></Field>}
                  </div>
                  <div style={{ fontSize: 14, margin: '2px 0 10px' }}>
                    Total do boleto: <b style={{ color: C.text }}>{brl(totalBoleto)}</b>
                    <span style={{ fontSize: 12, color: C.faint }}> · {qtdeSel} item{qtdeSel !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.faint, marginBottom: 10 }}>
                    {aVista ? 'Vira uma despesa paga hoje.' : 'Vira uma conta a pagar única (todos os itens juntos) com esse vencimento.'} Os preços também entram nas Cotações.
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn small onClick={() => lancarBoleto(g)}>Lançar boleto</Btn>
                    <Btn kind="ghost" small onClick={cancelarBoleto}>Cancelar</Btn>
                  </div>
                </div>
              );
            })() : g.itens.map((it) => (
              <div key={it.id} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 9, marginTop: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Check marcado={false} onClick={() => abrirLancar(it)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{it.nome}{it.quantidade && <span style={{ color: C.muted, fontWeight: 400 }}> · {it.quantidade}</span>}</div>
                    <div style={{ fontSize: 12, color: C.faint, marginTop: 1 }}>
                      {it.best ? <span style={{ color: C.green }}>melhor: {brl(it.best.preco)} · {it.best.fornecedor}</span> : (it.categoria || 'sem preço cotado')}
                    </div>
                  </div>
                  <button onClick={() => editarItem(it)} title="Editar" style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 4 }}>Editar</button>
                  <button onClick={() => excluirItem(it.id)} title="Excluir" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>×</button>
                </div>

                {marcandoId === it.id && (
                  <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginTop: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Comprou! Quer lançar em Compras / Contas a Pagar?</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Field label="Qtd"><NumInput value={lancForm.quantidade} onChange={setLanc('quantidade')} /></Field>
                      <Field label="Valor unitário (R$)"><NumInput value={lancForm.valor} onChange={setLanc('valor')} /></Field>
                    </div>
                    <Field label="Fornecedor"><TextInput value={lancForm.fornecedor} onChange={setLanc('fornecedor')} placeholder="Ambev…" /></Field>
                    <div style={{ fontSize: 12, color: C.muted, margin: '-4px 0 10px' }}>
                      Total: <b style={{ color: C.text }}>{brl((num(lancForm.quantidade) > 0 ? num(lancForm.quantidade) : 1) * num(lancForm.valor))}</b>
                      {num(lancForm.quantidade) > 1 && <span style={{ color: C.faint }}> ({num(lancForm.quantidade)} × {brl(num(lancForm.valor))})</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: lancForm.forma === 'À vista' ? '1fr' : '1fr 1fr', gap: 10 }}>
                      <Field label="Pagamento"><Select value={lancForm.forma} onChange={setLanc('forma')} options={['À vista', 'A prazo']} /></Field>
                      {lancForm.forma === 'A prazo' && <Field label="Vencimento"><TextInput type="date" value={lancForm.vencimento} onChange={setLanc('vencimento')} /></Field>}
                    </div>
                    <div style={{ fontSize: 11, color: C.faint, margin: '-4px 0 10px' }}>
                      {lancForm.forma === 'À vista' ? 'Vira uma despesa paga hoje.' : 'Vira uma conta a pagar com esse vencimento.'} O preço também entra nas Cotações.
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Btn small onClick={() => lancar(it)}>Lançar</Btn>
                      <Btn kind="ghost" small onClick={() => soMarcar(it)}>Só marcar comprado</Btn>
                      <Btn kind="ghost" small onClick={() => setMarcandoId(null)}>Cancelar</Btn>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </Card>
        ))}

      {comprados.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 2px 10px' }}>
            <button onClick={() => setVerComprados((v) => !v)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0 }}>
              {verComprados ? '▾' : '▸'} Comprados ({comprados.length})
            </button>
            <button onClick={limparComprados} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}>limpar comprados</button>
          </div>
          {verComprados && comprados.map((it) => (
            <Card key={it.id} style={{ marginBottom: 6, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Check marcado onClick={() => desmarcar(it)} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.faint, textDecoration: 'line-through' }}>{it.nome}{it.quantidade && ` · ${it.quantidade}`}</div>
                {it.lancado && <span style={{ fontSize: 11, fontWeight: 700, color: C.green, background: `${C.hair}`, borderRadius: 999, padding: '2px 8px' }}>lançado</span>}
                <button onClick={() => excluirItem(it.id)} title="Excluir" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>×</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <SecTitle>Listas-modelo</SecTitle>
        <Card style={{ padding: 14 }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Salve listas que se repetem (ex.: “Reposição semanal de bebidas”) e recarregue num toque.</div>
          {modelos.length === 0 ? <div style={{ fontSize: 13, color: C.faint, marginBottom: 12 }}>Nenhum modelo salvo ainda.</div> :
            modelos.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${C.line}`, padding: '9px 0' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{m.nome}</div>
                  <div style={{ fontSize: 12, color: C.faint }}>{m.itens.length} item{m.itens.length > 1 ? 's' : ''}: {m.itens.map((i) => i.nome).slice(0, 4).join(', ')}{m.itens.length > 4 ? '…' : ''}</div>
                </div>
                <Btn kind="ghost" small onClick={() => carregarModelo(m)}>Carregar</Btn>
                <button onClick={() => excluirModelo(m.id)} title="Excluir modelo" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>×</button>
              </div>
            ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}><TextInput value={nomeModelo} onChange={setNomeModelo} placeholder="Nome do modelo (ex.: Reposição semanal)" /></div>
            <Btn small onClick={salvarModelo}>Salvar lista atual</Btn>
          </div>
          {ativos.length === 0 && <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>Adicione itens acima para salvar como modelo.</div>}
        </Card>
      </div>

      {mostrarTarefasCozinha && (
      <div style={{ marginTop: 22 }}>
        <SecTitle>Tarefas para a cozinha</SecTitle>
        <Card style={{ padding: 14 }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Recados e tarefas que aparecem no acesso da cozinha (ela vê, não edita).</div>
          {tarefasCozinha.length === 0 ? <div style={{ fontSize: 13, color: C.faint, marginBottom: 12 }}>Nenhuma tarefa para a cozinha ainda.</div> :
            tarefasCozinha.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${C.line}`, padding: '9px 0' }}>
                <span style={{ width: 18, height: 18, borderRadius: 6, flexShrink: 0, border: `2px solid ${t.feito ? C.green : C.line}`, background: t.feito ? C.green : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {t.feito && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06101F" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>}
                </span>
                <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: t.feito ? C.faint : C.text, textDecoration: t.feito ? 'line-through' : 'none' }}>{t.texto}</div>
                {t.feito && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.green }}>feita</div>
                    {t.feitoEm && <div style={{ fontSize: 10, color: C.faint, whiteSpace: 'nowrap' }}>{fmtQuando(t.feitoEm)}</div>}
                  </div>
                )}
                <button onClick={() => removerTarefaCoz(t.id)} title="Remover" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>×</button>
              </div>
            ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}><TextInput value={novaTarefaCoz} onChange={setNovaTarefaCoz} placeholder="Ex.: Descongelar o frango pra amanhã" /></div>
            <Btn small onClick={addTarefaCoz}>Adicionar</Btn>
          </div>
        </Card>
      </div>
      )}
    </div>
  );
}
