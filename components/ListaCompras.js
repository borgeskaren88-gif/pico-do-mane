'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Select, Empty, SecTitle, PageTitle } from './ui';
import { brl, num, todayISO, addDays, fmtDate, uid, limparNome, CATEGORIAS_PRODUTO } from '../lib/util';
import MicBtn from './MicBtn';

const itemVazio = () => ({ nome: '', quantidade: '', categoria: '' });

export default function ListaCompras({ itens = [], modelos = [], cotacoes = [], compras = [], despesas = [], onAplicar, tarefasCozinha = [], onTarefasCozinha }) {
  const [novo, setNovo] = useState(itemVazio());
  const [novaTarefaCoz, setNovaTarefaCoz] = useState('');
  const addTarefaCoz = () => { if (!novaTarefaCoz.trim() || !onTarefasCozinha) return; onTarefasCozinha([{ id: uid(), texto: novaTarefaCoz.trim() }, ...tarefasCozinha]); setNovaTarefaCoz(''); };
  const removerTarefaCoz = (id) => onTarefasCozinha && onTarefasCozinha(tarefasCozinha.filter((t) => t.id !== id));
  const [editId, setEditId] = useState(null);
  const [marcandoId, setMarcandoId] = useState(null);
  const [lancForm, setLancForm] = useState({ valor: '', fornecedor: '', forma: 'À vista', vencimento: '' });
  const [nomeModelo, setNomeModelo] = useState('');
  const [verComprados, setVerComprados] = useState(false);
  const set = (k) => (v) => setNovo((f) => ({ ...f, [k]: v }));
  const setLanc = (k) => (v) => setLancForm((f) => ({ ...f, [k]: v }));

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
    const valor = lancForm.valor || '0';
    const forn = lancForm.fornecedor.trim();
    const despId = aVista ? uid() : '';
    const compraEntry = {
      id: uid(), data: hoje, produto: it.nome, fornecedor: forn, categoria: it.categoria || '',
      quantidade: '1', valorUnit: valor, formaPagto: aVista ? 'À vista' : 'Prazo', prazoDias: '',
      vencimento: aVista ? '' : (lancForm.vencimento || ''), pago: aVista ? 'Sim' : 'Não',
      dataPagamento: aVista ? hoje : '', despesaId: despId, obs: 'Lista de compras',
    };
    const payload = {
      listaCompras: itens.map((x) => (x.id === it.id ? { ...x, comprado: true, lancado: true, compradoEm: Date.now() } : x)),
      compras: [compraEntry, ...compras],
    };
    if (aVista) payload.despesas = [{ id: despId, data: hoje, categoria: 'Fornecedores de insumo', descricao: [forn, it.nome].filter(Boolean).join(' · ') || it.nome, valor, obs: 'Compra à vista (lista de compras)', origem: 'lista-compras' }, ...despesas];
    if (num(valor) > 0 && forn) payload.cotacoes = [{ id: uid(), data: hoje, produto: it.nome, fornecedor: forn, preco: valor, categoria: it.categoria || '' }, ...cotacoes];
    onAplicar(payload);
    setMarcandoId(null);
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
      <PageTitle sub="O que falta repor no bar">Lista de Compras</PageTitle>

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
            {g.itens.map((it) => (
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
                      <Field label="Valor (R$)"><NumInput value={lancForm.valor} onChange={setLanc('valor')} /></Field>
                      <Field label="Fornecedor"><TextInput value={lancForm.fornecedor} onChange={setLanc('fornecedor')} placeholder="Ambev…" /></Field>
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

      <div style={{ marginTop: 22 }}>
        <SecTitle>Tarefas para a cozinha</SecTitle>
        <Card style={{ padding: 14 }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Recados e tarefas que aparecem no acesso da cozinha (ela vê, não edita).</div>
          {tarefasCozinha.length === 0 ? <div style={{ fontSize: 13, color: C.faint, marginBottom: 12 }}>Nenhuma tarefa para a cozinha ainda.</div> :
            tarefasCozinha.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${C.line}`, padding: '9px 0' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.accent, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{t.texto}</div>
                <button onClick={() => removerTarefaCoz(t.id)} title="Remover" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>×</button>
              </div>
            ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}><TextInput value={novaTarefaCoz} onChange={setNovaTarefaCoz} placeholder="Ex.: Descongelar o frango pra amanhã" /></div>
            <Btn small onClick={addTarefaCoz}>Adicionar</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}
