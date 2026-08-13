'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Select, Empty, Resumo, SecTitle, PageTitle, inputStyle } from './ui';
import { brl, num, todayISO, fmtDate, uid, limparNome, CATEGORIAS_PRODUTO } from '../lib/util';

export const UNIDADES = ['un', 'cx', 'fardo', 'pct', 'grf', 'kg', 'g', 'L', 'ml', 'saco', 'lata'];
export const MOTIVOS_SAIDA = ['Consumo / uso', 'Venda', 'Perda / vencido', 'Quebra', 'Cortesia', 'Ajuste', 'Outro'];
const MAX_MOV = 50; // guarda os últimos movimentos por item, pra não inchar o banco

const igualNome = (a, b) => limparNome(a).toLowerCase() === limparNome(b).toLowerCase();

// Aplica as ENTRADAS de compra no estoque: para cada item comprado que já
// existe no catálogo de estoque (mesmo nome), soma a quantidade no saldo e
// atualiza o custo. Produtos que não estão no estoque são ignorados aqui (eles
// aparecem como "sugestão" na tela de Estoque). Retorna um novo array só se
// algo mudou; senão devolve o mesmo (pra não salvar à toa).
export function aplicarEntradasEstoque(estoque, comprasNovas) {
  if (!Array.isArray(estoque) || !estoque.length || !Array.isArray(comprasNovas) || !comprasNovas.length) return estoque;
  let mudou = false;
  const novo = estoque.map((it) => {
    const compras = comprasNovas.filter((c) => igualNome(c.produto, it.nome) && num(c.quantidade) > 0);
    if (!compras.length) return it;
    mudou = true;
    let saldo = num(it.saldo);
    let custo = num(it.custo);
    const movs = [];
    for (const c of compras) {
      const q = num(c.quantidade);
      saldo += q;
      if (num(c.valorUnit) > 0) custo = num(c.valorUnit);
      movs.push({ id: uid(), tipo: 'compra', qtd: q, saldoDepois: saldo, motivo: c.fornecedor ? `Compra · ${limparNome(c.fornecedor)}` : 'Compra', data: c.data || todayISO(), ts: Date.now() });
    }
    return { ...it, saldo, custo, atualizadoEm: todayISO(), movimentos: [...movs, ...(it.movimentos || [])].slice(0, MAX_MOV) };
  });
  return mudou ? novo : estoque;
}

const itemVazio = () => ({ nome: '', categoria: '', unidade: 'un', saldo: '', minimo: '', custo: '' });

export default function Estoque({ dados = [], onChange, compras = [], onRepor }) {
  const [novo, setNovo] = useState(itemVazio());
  const [editId, setEditId] = useState(null);
  const [acao, setAcao] = useState(null);   // { id, tipo: 'entrada'|'saida'|'contagem' }
  const [acaoQtd, setAcaoQtd] = useState('');
  const [acaoMotivo, setAcaoMotivo] = useState(MOTIVOS_SAIDA[0]);
  const [verMov, setVerMov] = useState(null); // id do item com histórico aberto
  const [busca, setBusca] = useState('');
  const [reposto, setReposto] = useState('');
  const set = (k) => (v) => setNovo((f) => ({ ...f, [k]: v }));

  // Resumo geral
  const totais = useMemo(() => {
    let valor = 0, baixo = 0;
    for (const it of dados) {
      valor += num(it.saldo) * num(it.custo);
      if (num(it.minimo) > 0 && num(it.saldo) <= num(it.minimo)) baixo += 1;
    }
    return { valor, baixo };
  }, [dados]);

  const abaixoDoMin = useMemo(
    () => dados.filter((it) => num(it.minimo) > 0 && num(it.saldo) <= num(it.minimo)),
    [dados]
  );

  // Produtos que já foram comprados mas ainda NÃO estão no estoque (sugestões
  // pra começar a controlar com um toque). Traz o último custo conhecido.
  const sugestoes = useMemo(() => {
    const noEstoque = new Set(dados.map((it) => limparNome(it.nome).toLowerCase()));
    const map = new Map();
    for (const c of compras) {
      const nome = limparNome(c.produto);
      if (!nome) continue;
      const chave = nome.toLowerCase();
      if (noEstoque.has(chave)) continue;
      const anterior = map.get(chave);
      // Mantém a compra mais recente (pra pegar o custo e a categoria atuais).
      if (!anterior || (c.data || '') >= (anterior.data || '')) {
        map.set(chave, { nome, categoria: c.categoria || '', custo: c.valorUnit || '', data: c.data || '' });
      }
    }
    return [...map.values()].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [compras, dados]);

  // Agrupa o estoque por categoria pra listar organizado.
  const grupos = useMemo(() => {
    const filtro = busca.trim().toLowerCase();
    const ordem = [...CATEGORIAS_PRODUTO, ''];
    const map = new Map();
    for (const it of dados) {
      if (filtro && !(it.nome || '').toLowerCase().includes(filtro)) continue;
      const cat = it.categoria || '';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(it);
    }
    return [...map.entries()]
      .sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
      .map(([cat, itens]) => ({ cat: cat || 'Sem categoria', itens: itens.sort((x, y) => (x.nome || '').localeCompare(y.nome || '')) }));
  }, [dados, busca]);

  const salvarItem = () => {
    if (!novo.nome.trim()) return;
    const base = {
      nome: limparNome(novo.nome), categoria: novo.categoria, unidade: novo.unidade || 'un',
      saldo: num(novo.saldo), minimo: num(novo.minimo), custo: num(novo.custo), atualizadoEm: todayISO(),
    };
    if (editId) {
      onChange(dados.map((it) => it.id === editId ? { ...it, ...base } : it));
    } else {
      // Evita duplicar: se já existe item com o mesmo nome, não cria outro.
      if (dados.some((it) => igualNome(it.nome, base.nome))) { setNovo(itemVazio()); return; }
      const mov = num(novo.saldo) > 0
        ? [{ id: uid(), tipo: 'contagem', qtd: num(novo.saldo), saldoDepois: num(novo.saldo), motivo: 'Saldo inicial', data: todayISO(), ts: Date.now() }]
        : [];
      onChange([{ id: uid(), ...base, movimentos: mov }, ...dados]);
    }
    setNovo(itemVazio()); setEditId(null);
  };

  const editar = (it) => {
    setEditId(it.id);
    setNovo({ nome: it.nome || '', categoria: it.categoria || '', unidade: it.unidade || 'un', saldo: String(it.saldo ?? ''), minimo: String(it.minimo ?? ''), custo: String(it.custo ?? '') });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelar = () => { setNovo(itemVazio()); setEditId(null); };
  const excluir = (id) => { if (!window.confirm('Excluir este item do estoque?')) return; if (id === editId) cancelar(); onChange(dados.filter((it) => it.id !== id)); };

  const adicionarSugestao = (s) => {
    if (dados.some((it) => igualNome(it.nome, s.nome))) return;
    const item = { id: uid(), nome: s.nome, categoria: s.categoria, unidade: 'un', saldo: 0, minimo: 0, custo: num(s.custo), atualizadoEm: todayISO(), movimentos: [] };
    onChange([item, ...dados]);
    // Já abre a contagem pra pessoa dizer quanto tem hoje.
    abrirAcao(item.id, 'contagem');
  };

  const abrirAcao = (id, tipo) => { setAcao({ id, tipo }); setAcaoQtd(''); setAcaoMotivo(MOTIVOS_SAIDA[0]); };
  const fecharAcao = () => { setAcao(null); setAcaoQtd(''); };

  const confirmarAcao = () => {
    if (String(acaoQtd).trim() === '') return; // exige um número digitado (evita zerar sem querer)
    const q = num(acaoQtd);
    if (acao.tipo !== 'contagem' && !(q > 0)) return;
    onChange(dados.map((it) => {
      if (it.id !== acao.id) return it;
      const saldoAtual = num(it.saldo);
      let saldoNovo = saldoAtual, mov;
      if (acao.tipo === 'entrada') {
        saldoNovo = saldoAtual + q;
        mov = { tipo: 'entrada', qtd: q, motivo: 'Entrada manual' };
      } else if (acao.tipo === 'saida') {
        saldoNovo = Math.max(0, saldoAtual - q);
        mov = { tipo: 'saida', qtd: q, motivo: acaoMotivo };
      } else { // contagem
        saldoNovo = q;
        const dif = q - saldoAtual;
        mov = { tipo: 'contagem', qtd: q, motivo: `Contagem${dif !== 0 ? ` (${dif > 0 ? '+' : ''}${(Math.round(dif * 100) / 100)})` : ''}` };
      }
      const movimento = { id: uid(), ...mov, saldoDepois: saldoNovo, data: todayISO(), ts: Date.now() };
      return { ...it, saldo: saldoNovo, atualizadoEm: todayISO(), movimentos: [movimento, ...(it.movimentos || [])].slice(0, MAX_MOV) };
    }));
    fecharAcao();
  };

  const reporNaLista = (itens) => {
    if (!onRepor) return;
    const add = onRepor(itens.map((it) => ({ id: uid(), nome: it.nome, quantidade: '', categoria: it.categoria || '', comprado: false, criadoEm: Date.now() })));
    setReposto(add === 0 ? 'Já estavam na Lista de Compras.' : `${add} item(ns) adicionado(s) à Lista de Compras.`);
    setTimeout(() => setReposto(''), 3000);
  };

  const itemAcao = acao ? dados.find((it) => it.id === acao.id) : null;
  const rotuloAcao = { entrada: 'Entrada', saida: 'Saída', contagem: 'Contagem' };

  return (
    <div>
      <Resumo items={[
        { t: 'Itens', v: dados.length },
        { t: 'Abaixo do mínimo', v: totais.baixo, c: totais.baixo ? C.red : C.faint },
        { t: 'Valor em estoque', v: brl(totais.valor), c: C.green },
      ]} />

      <PageTitle sub="Quanto você tem, o que está acabando e quanto está parado em mercadoria">Estoque</PageTitle>

      {reposto && <Card style={{ marginBottom: 12, borderColor: C.green }}><div style={{ fontSize: 14, color: C.green, fontWeight: 700 }}>{reposto}</div></Card>}

      {/* Alertas de estoque baixo */}
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

      {/* Sugestões: produtos comprados que ainda não estão no estoque */}
      {sugestoes.length > 0 && (
        <Card style={{ marginBottom: 14, background: C.panel2 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.accent, marginBottom: 4 }}>Começar a controlar ({sugestoes.length})</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.4 }}>
            Estes produtos já apareceram nas suas Compras mas ainda não estão no estoque. Toque para começar a controlar (o app já pergunta quanto você tem hoje).
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sugestoes.slice(0, 24).map((s) => (
              <button key={s.nome} onClick={() => adicionarSugestao(s)} style={{
                border: `1px solid ${C.line}`, background: C.panel, color: C.text, borderRadius: 999,
                padding: '7px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ color: C.accent, fontWeight: 800 }}>+</span> {s.nome}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Formulário de item */}
      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{editId ? 'Editar item' : 'Novo item de estoque'}</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
          {editId ? 'Ajuste os dados deste item.' : 'Cadastre um item pra controlar. Depois, as Compras já somam sozinhas no saldo.'}
        </div>
        <Field label="Produto"><TextInput value={novo.nome} onChange={set('nome')} placeholder="Cerveja Original 600ml, Arroz 5kg…" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
          <Field label="Categoria"><Select value={novo.categoria} onChange={set('categoria')} options={CATEGORIAS_PRODUTO} /></Field>
          <Field label="Unidade"><Select value={novo.unidade} onChange={set('unidade')} options={UNIDADES} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Field label={editId ? 'Saldo atual' : 'Qtd que tem hoje'}><NumInput value={novo.saldo} onChange={set('saldo')} /></Field>
          <Field label="Estoque mínimo"><NumInput value={novo.minimo} onChange={set('minimo')} /></Field>
          <Field label="Custo un. (R$)"><NumInput value={novo.custo} onChange={set('custo')} /></Field>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={salvarItem}>{editId ? 'Salvar item' : 'Adicionar ao estoque'}</Btn>
          {editId && <Btn kind="ghost" onClick={cancelar}>Cancelar</Btn>}
        </div>
      </Card>

      {/* Lista do estoque */}
      <SecTitle>Meu estoque ({dados.length})</SecTitle>
      {dados.length > 6 && (
        <div style={{ marginBottom: 12 }}><TextInput value={busca} onChange={setBusca} placeholder="Buscar item…" /></div>
      )}
      {dados.length === 0 ? (
        <Empty>Seu estoque está vazio.<br />Cadastre um item acima, ou use as sugestões das suas compras. 👆</Empty>
      ) : grupos.map((g) => (
        <div key={g.cat} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', color: C.accent, fontWeight: 700, margin: '0 0 8px 2px' }}>{g.cat}</div>
          {g.itens.map((it) => {
            const saldo = num(it.saldo), minimo = num(it.minimo), custo = num(it.custo);
            const baixo = minimo > 0 && saldo <= minimo;
            const aberto = verMov === it.id;
            return (
              <Card key={it.id} style={{ marginBottom: 8, padding: 14, borderColor: baixo ? C.red : C.cardBorder }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{it.nome}</div>
                    <div style={{ fontSize: 12, color: C.faint, marginTop: 3 }}>
                      {custo > 0 ? `${brl(custo)}/${it.unidade} · em estoque ${brl(saldo * custo)}` : `unidade: ${it.unidade}`}
                      {minimo > 0 ? ` · mín. ${minimo}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: baixo ? C.red : C.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{saldo}</div>
                    <div style={{ fontSize: 11, color: C.faint }}>{it.unidade}{baixo ? ' · acabando' : ''}</div>
                  </div>
                </div>

                {/* Ações rápidas */}
                {acao && acao.id === it.id ? (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8 }}>
                      {rotuloAcao[acao.tipo]}{acao.tipo === 'contagem' ? ' — quanto tem AGORA?' : acao.tipo === 'entrada' ? ' — quanto entrou?' : ' — quanto saiu?'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ width: 110 }}><NumInput value={acaoQtd} onChange={setAcaoQtd} placeholder={acao.tipo === 'contagem' ? String(saldo) : '0'} /></div>
                      {acao.tipo === 'saida' && (
                        <div style={{ flex: 1, minWidth: 150 }}><Select value={acaoMotivo} onChange={setAcaoMotivo} options={MOTIVOS_SAIDA} /></div>
                      )}
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
                      <button onClick={() => setVerMov(aberto ? null : it.id)} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '7px 6px' }}>
                        {aberto ? 'ocultar' : 'histórico'}
                      </button>
                    )}
                    <button onClick={() => excluir(it.id)} title="Excluir" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '4px 6px', marginLeft: 'auto' }}>×</button>
                  </div>
                )}

                {/* Histórico de movimentos */}
                {aberto && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${C.hair}`, paddingTop: 8 }}>
                    {(it.movimentos || []).slice(0, 15).map((m) => (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.muted, padding: '3px 0' }}>
                        <span>{fmtDate(m.data)} · {m.motivo}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: m.tipo === 'saida' ? C.red : m.tipo === 'contagem' ? C.muted : C.green }}>
                          {m.tipo === 'saida' ? '−' : m.tipo === 'contagem' ? '=' : '+'}{m.tipo === 'contagem' ? m.saldoDepois : num(m.qtd)} → {m.saldoDepois}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}
