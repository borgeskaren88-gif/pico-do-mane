'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, Field, Select, NumInput, Empty, SecTitle, PageTitle, inputStyle } from './ui';
import { num, uid } from '../lib/util';
import { UNIDADES, podeProduzir } from '../lib/estoque';
import { CATEGORIAS_CARDAPIO } from './Cardapio';

// Modelo de fichas do Pico do Mané (extraído da ficha técnica em PDF). Só os
// ingredientes com quantidade definida — itens "a gosto" (sal, páprica, orégano,
// queijo sem gramatura) ficam de fora do controle de estoque.
const MODELO_INGREDIENTES = [
  { nome: 'Carne em tiras', categoria: 'Cozinha', unidade: 'kg' },
  { nome: 'Batata frita', categoria: 'Cozinha', unidade: 'kg' },
  { nome: 'Onion rings', categoria: 'Cozinha', unidade: 'kg' },
  { nome: 'Bacon', categoria: 'Cozinha', unidade: 'kg' },
  { nome: 'Calabresa', categoria: 'Cozinha', unidade: 'kg' },
  { nome: 'Pão de alho', categoria: 'Cozinha', unidade: 'un' },
  { nome: 'Ostras', categoria: 'Cozinha', unidade: 'un' },
  { nome: 'Polenta', categoria: 'Cozinha', unidade: 'kg' },
  { nome: 'Açaí', categoria: 'Cozinha', unidade: 'kg' },
  { nome: 'Isca de tilápia', categoria: 'Cozinha', unidade: 'kg' },
  { nome: 'Camarão', categoria: 'Cozinha', unidade: 'kg' },
  { nome: 'Bife empanado', categoria: 'Cozinha', unidade: 'un' },
];
const MODELO_FICHAS = [
  { prato: 'A Favorita', itens: [{ ingrediente: 'Carne em tiras', qtd: 300, unidade: 'g' }, { ingrediente: 'Batata frita', qtd: 200, unidade: 'g' }, { ingrediente: 'Onion rings', qtd: 200, unidade: 'g' }] },
  { prato: 'Batata Supreme', itens: [{ ingrediente: 'Batata frita', qtd: 400, unidade: 'g' }, { ingrediente: 'Bacon', qtd: 80, unidade: 'g' }] },
  { prato: 'Batata Tradicional', itens: [{ ingrediente: 'Batata frita', qtd: 400, unidade: 'g' }] },
  { prato: 'Calabresa', itens: [{ ingrediente: 'Calabresa', qtd: 300, unidade: 'g' }] },
  { prato: 'Tábua Calabresa', itens: [{ ingrediente: 'Calabresa', qtd: 300, unidade: 'g' }, { ingrediente: 'Batata frita', qtd: 300, unidade: 'g' }, { ingrediente: 'Pão de alho', qtd: 1, unidade: 'un' }] },
  { prato: 'Sol e Mar Ostra Gratinada', itens: [{ ingrediente: 'Ostras', qtd: 6, unidade: 'un' }] },
  { prato: 'Pão de Alho', itens: [{ ingrediente: 'Pão de alho', qtd: 1, unidade: 'un' }] },
  { prato: 'Polenta Frita', itens: [{ ingrediente: 'Polenta', qtd: 300, unidade: 'g' }] },
  { prato: 'Polenta ao Queijo', itens: [{ ingrediente: 'Polenta', qtd: 300, unidade: 'g' }] },
  { prato: 'Cume Supremo', itens: [{ ingrediente: 'Açaí', qtd: 500, unidade: 'g' }] },
  { prato: 'Mirante', itens: [{ ingrediente: 'Açaí', qtd: 400, unidade: 'g' }] },
  { prato: 'Isca de Tilápia', itens: [{ ingrediente: 'Isca de tilápia', qtd: 400, unidade: 'g' }, { ingrediente: 'Batata frita', qtd: 200, unidade: 'g' }] },
  { prato: 'Camarão do Pico', itens: [{ ingrediente: 'Camarão', qtd: 500, unidade: 'g' }] },
  { prato: 'Camarão do Pico meia Porção', itens: [{ ingrediente: 'Camarão', qtd: 250, unidade: 'g' }] },
  { prato: 'Parmegiana', itens: [{ ingrediente: 'Bife empanado', qtd: 1, unidade: 'un' }] },
];

// Editor das fichas técnicas: liga cada item do CARDÁPIO aos ingredientes do
// ESTOQUE (com quantidade e unidade). É isso que faz a venda de um prato baixar
// os insumos sozinha. `fichas` é uma lista de { cardapioId, itens:[{estoqueId,
// qtd, unidade}] }.
export default function FichasTecnicas({ cardapio = [], estoque = [], fichas = [], onAcao }) {
  const [importando, setImportando] = useState(false);
  const [report, setReport] = useState(null);

  const importarModelo = async () => {
    if (importando) return;
    if (typeof window !== 'undefined' && !window.confirm('Importar o modelo de fichas do Pico do Mané?\n\nVou criar os ingredientes que faltam no estoque e montar as fichas dos pratos que já estiverem no seu cardápio.')) return;
    setImportando(true); setReport(null);
    const j = await onAcao({ acao: 'importarModelo', ingredientes: MODELO_INGREDIENTES, fichas: MODELO_FICHAS });
    setImportando(false);
    if (j && j.report) setReport(j.report);
    else setReport({ erro: true });
  };
  const [abertoId, setAbertoId] = useState(null); // cardapioId com a ficha em edição
  const [ing, setIng] = useState({ estoqueId: '', qtd: '', unidade: '' });

  const fichaDe = (cardapioId) => (fichas.find((f) => f.cardapioId === cardapioId)?.itens) || [];
  const estoqueById = useMemo(() => new Map(estoque.map((e) => [e.id, e])), [estoque]);

  // Salva a lista de ingredientes de um item do cardápio.
  const setFicha = (cardapioId, itens) => {
    const outras = fichas.filter((f) => f.cardapioId !== cardapioId);
    const nova = itens.length ? [...outras, { cardapioId, itens }] : outras;
    onAcao({ acao: 'fichas', fichas: nova });
  };

  const addIngrediente = (cardapioId) => {
    if (!ing.estoqueId || !(num(ing.qtd) > 0)) return;
    const it = estoqueById.get(ing.estoqueId);
    const unidade = ing.unidade || (it ? it.unidade : 'un');
    const atual = fichaDe(cardapioId);
    // Se o ingrediente já está na ficha, substitui a quantidade.
    const semEle = atual.filter((x) => x.estoqueId !== ing.estoqueId);
    setFicha(cardapioId, [...semEle, { estoqueId: ing.estoqueId, qtd: String(ing.qtd), unidade }]);
    setIng({ estoqueId: '', qtd: '', unidade: '' });
  };
  const removerIngrediente = (cardapioId, estoqueId) => {
    setFicha(cardapioId, fichaDe(cardapioId).filter((x) => x.estoqueId !== estoqueId));
  };

  const abrir = (id) => { setAbertoId(id === abertoId ? null : id); setIng({ estoqueId: '', qtd: '', unidade: '' }); };

  const comFicha = cardapio.filter((c) => fichaDe(c.id).length > 0).length;
  const opcoesEstoque = estoque.map((e) => e.nome);
  const nomeEstoquePorId = (id) => estoqueById.get(id)?.nome || '(item removido)';

  // Agrupa os itens do cardápio por categoria (mesma ordem do cardápio), pra
  // não virar uma lista gigante e confusa. Cada categoria abre/fecha.
  const [catAberta, setCatAberta] = useState({});
  const toggleCat = (cat) => setCatAberta((m) => ({ ...m, [cat]: !m[cat] }));
  const gruposCardapio = useMemo(() => {
    const ordem = [...CATEGORIAS_CARDAPIO, ''];
    const map = new Map();
    for (const c of cardapio) { const cat = c.categoria || ''; if (!map.has(cat)) map.set(cat, []); map.get(cat).push(c); }
    return [...map.entries()].sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
      .map(([cat, itens]) => ({ cat: cat || 'Sem categoria', itens: itens.sort((x, y) => (x.nome || '').localeCompare(y.nome || '')) }));
  }, [cardapio]);

  return (
    <div>
      <PageTitle sub="A receita de cada prato — é isso que faz a venda baixar os insumos sozinha">Fichas Técnicas</PageTitle>

      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
          Para cada item do cardápio, diga os ingredientes do <b style={{ color: C.text }}>estoque</b> e quanto usa (ex.: Favorita = 300 g de carne + 200 g de batata). Quando a comanda com esse item fechar, o estoque baixa automático. Compra em kg e receita em g? O app converte sozinho.
        </div>
      </Card>

      {/* Importar o modelo pronto (fichas do PDF do Pico do Mané) */}
      <Card style={{ marginBottom: 14, borderColor: C.accent }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Importar fichas do Pico do Mané</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
          Cria os ingredientes que faltam no estoque e monta as fichas dos pratos (A Favorita, Batata Supreme, Calabresa, Ostras, Polenta, Tábua, Camarão, Parmegiana…). Liga cada ficha ao prato com o mesmo nome no seu <b style={{ color: C.text }}>cardápio</b>. Itens “a gosto” (sal, páprica, queijo sem peso) não entram.
        </div>
        <Btn small onClick={importarModelo}>{importando ? 'Importando…' : 'Importar modelo agora'}</Btn>
        {report && (
          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.5 }}>
            {report.erro ? (
              <div style={{ color: C.red, fontWeight: 700 }}>Não consegui importar. Tente de novo.</div>
            ) : (
              <>
                <div style={{ color: C.green, fontWeight: 700 }}>✓ {report.fichasCriadas} ficha(s) montada(s) · {report.criados} ingrediente(s) criado(s) no estoque.</div>
                {report.cardapioVazio && <div style={{ color: C.amber, marginTop: 6 }}>Seu cardápio está vazio — cadastre os pratos em Central de Operações → Cardápio e importe de novo.</div>}
                {report.naoEncontrados && report.naoEncontrados.length > 0 && (
                  <div style={{ color: C.amber, marginTop: 6 }}>
                    Não achei estes pratos no cardápio (cadastre com esse nome exato e reimporte, ou monte a ficha manualmente abaixo): <b>{report.naoEncontrados.join(', ')}</b>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      {estoque.length === 0 && (
        <Card style={{ marginBottom: 14, borderColor: C.amber }}>
          <div style={{ fontSize: 14, color: C.amber, fontWeight: 700 }}>Cadastre primeiro os ingredientes na aba Estoque</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>As fichas usam os itens do seu estoque (carne, batata, cebola…). Sem eles, não há o que escolher aqui.</div>
        </Card>
      )}

      <SecTitle>Itens do cardápio ({comFicha}/{cardapio.length} com ficha)</SecTitle>
      {cardapio.length === 0 ? (
        <Empty>Seu cardápio está vazio.<br />Cadastre os itens em Central de Operações → Cardápio primeiro.</Empty>
      ) : gruposCardapio.map((g) => {
        const abertaCat = !!catAberta[g.cat];
        const comFichaCat = g.itens.filter((c) => fichaDe(c.id).length > 0).length;
        return (
        <div key={g.cat} style={{ marginBottom: abertaCat ? 14 : 8 }}>
          <button onClick={() => toggleCat(g.cat)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: C.panel, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', boxShadow: C.cardShadow }}>
            <span style={{ color: C.accent, fontSize: 12, fontWeight: 800, width: 12, flexShrink: 0 }}>{abertaCat ? '▾' : '▸'}</span>
            <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em', color: C.accent, fontWeight: 800, flex: 1, minWidth: 0 }}>{g.cat}</span>
            <span style={{ fontSize: 12, color: comFichaCat === g.itens.length ? C.green : C.faint, flexShrink: 0 }}>{comFichaCat}/{g.itens.length} com ficha</span>
          </button>
          {abertaCat && <div style={{ marginTop: 8 }}>
          {g.itens.map((c) => {
            const itens = fichaDe(c.id);
            const aberto = abertoId === c.id;
            const rende = itens.length ? podeProduzir(itens, estoque) : null;
            return (
          <Card key={c.id} style={{ marginBottom: 8, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.nome}</div>
                <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>
                  {itens.length === 0 ? 'Sem ficha ainda' : `${itens.length} ingrediente(s)`}
                  {rende != null && itens.length > 0 && <span style={{ color: rende > 0 ? C.green : C.red }}> · rende ~{rende}</span>}
                </div>
              </div>
              <Btn kind="ghost" small onClick={() => abrir(c.id)}>{aberto ? 'Fechar' : itens.length ? 'Editar' : 'Criar ficha'}</Btn>
            </div>

            {/* Ingredientes já na ficha */}
            {itens.length > 0 && (
              <div style={{ marginTop: 10, borderTop: `1px solid ${C.hair}`, paddingTop: 8 }}>
                {itens.map((x) => (
                  <div key={x.estoqueId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 14 }}>
                    <span>{nomeEstoquePorId(x.estoqueId)}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <b style={{ fontVariantNumeric: 'tabular-nums' }}>{num(x.qtd)} {x.unidade}</b>
                      {aberto && <button onClick={() => removerIngrediente(c.id, x.estoqueId)} title="Remover" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Adicionar ingrediente */}
            {aberto && estoque.length > 0 && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', color: C.muted, fontWeight: 700, marginBottom: 8 }}>Adicionar ingrediente</div>
                <Field label="Ingrediente (do estoque)">
                  <select value={ing.estoqueId} onChange={(e) => {
                    const it = estoque.find((x) => x.id === e.target.value);
                    setIng((f) => ({ ...f, estoqueId: e.target.value, unidade: f.unidade || (it ? it.unidade : '') }));
                  }} style={{ ...inputStyle, appearance: 'none' }}>
                    <option value="">Selecione…</option>
                    {estoque.map((e) => <option key={e.id} value={e.id}>{e.nome} ({e.unidade})</option>)}
                  </select>
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Quantidade por unidade"><NumInput value={ing.qtd} onChange={(v) => setIng((f) => ({ ...f, qtd: v }))} /></Field>
                  <Field label="Unidade"><Select value={ing.unidade} onChange={(v) => setIng((f) => ({ ...f, unidade: v }))} options={UNIDADES} /></Field>
                </div>
                <Btn small onClick={() => addIngrediente(c.id)}>+ Adicionar à ficha</Btn>
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
