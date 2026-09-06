'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, Btn, SecTitle, PageTitle, Empty } from './ui';
import { num, fmtDate } from '../lib/util';
import { qtdNaUnidadeDoItem } from '../lib/estoque';

// Conferência de Estoque: cruza vendas × fichas × estoque pra achar dois tipos
// de problema que fazem o sistema mostrar MAIS do que tem de verdade:
//  1) Produtos vendidos que não baixam do estoque (ficha faltando/quebrada).
//  2) Diferença entre o que o sistema espera e a contagem real (a dona digita a
//     contagem e acerta na hora), com um resumo de "pra onde foi" pelos
//     movimentos guardados de cada item.
// O teclado do celular só tem ponto, e em quantidade ponto quer dizer "os
// gramas". Troca por vírgula na hora, pra 12.992 não virar doze mil.
const paraVirgula = (v) => {
  const s = String(v == null ? '' : v).replace(/\./g, ',');
  const i = s.indexOf(',');
  return i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, '');
};

export default function ConferenciaEstoque({ estoque = [], fichas = [], cardapio = [], vendas = [], onAcao, carregado = true }) {
  const [contagem, setContagem] = useState({}); // { [itemId]: valor digitado }
  const [busy, setBusy] = useState('');

  const byId = useMemo(() => new Map(estoque.map((it) => [it.id, it])), [estoque]);
  const fichaPorCardapio = useMemo(() => {
    const m = new Map();
    for (const f of fichas) if (f && f.cardapioId && Array.isArray(f.itens) && f.itens.length) m.set(f.cardapioId, f.itens);
    return m;
  }, [fichas]);
  const nomeCardapio = useMemo(() => {
    const m = new Map();
    for (const c of cardapio) if (c && c.id) m.set(c.id, c.nome || '');
    return m;
  }, [cardapio]);

  // Uma ficha "funciona" pra baixar se tem ao menos um ingrediente que existe no
  // estoque e converte pra uma quantidade > 0.
  const fichaFunciona = (cardapioId) => {
    const itens = fichaPorCardapio.get(cardapioId);
    if (!itens || !itens.length) return false;
    return itens.some((ing) => { const it = byId.get(ing.estoqueId); return it && qtdNaUnidadeDoItem(ing.qtd, ing.unidade, it) > 0; });
  };

  // 1) Produtos vendidos que NÃO baixam do estoque. Junta a quantidade vendida
  // por produto do cardápio e marca os que não têm ficha que funcione. Itens que
  // baixam só pelo "sabor" (extras) são considerados OK por venda.
  const naoBaixam = useMemo(() => {
    const m = new Map(); // cardapioId -> { nome, qtd, vezes, temExtras }
    for (const v of vendas) {
      for (const item of (v.itens || [])) {
        const q = num(item.qtd) || 0;
        if (q <= 0 || !item.cardapioId) continue;
        const cur = m.get(item.cardapioId) || { cardapioId: item.cardapioId, nome: nomeCardapio.get(item.cardapioId) || item.nome || '—', qtd: 0, vezes: 0, temExtras: false };
        cur.qtd += q; cur.vezes += 1;
        if (Array.isArray(item.extras) && item.extras.length) cur.temExtras = true;
        m.set(item.cardapioId, cur);
      }
    }
    return [...m.values()]
      .filter((p) => !fichaFunciona(p.cardapioId) && !p.temExtras)
      .sort((a, b) => b.qtd - a.qtd);
  }, [vendas, fichaPorCardapio, byId, nomeCardapio]);

  // 2) Resumo de movimentos por item (pra onde foi), a partir do que está
  // guardado no histórico do item.
  const resumoMov = (it) => {
    let entrou = 0, venda = 0, cortesia = 0, outras = 0;
    for (const mv of (it.movimentos || [])) {
      const q = num(mv.qtd);
      const mot = String(mv.motivo || '').toLowerCase();
      if (mv.tipo === 'entrada' || mv.tipo === 'compra') entrou += q;
      else if (mv.tipo === 'venda') venda += q;
      else if (mv.tipo === 'saida') { if (mot.includes('cortesia') || mot.includes('consumo')) cortesia += q; else outras += q; }
    }
    const r = (x) => Math.round(x * 1000) / 1000;
    return { entrou: r(entrou), venda: r(venda), cortesia: r(cortesia), outras: r(outras) };
  };

  const acertar = async (it) => {
    const real = num(contagem[it.id]);
    if (!(real >= 0) || contagem[it.id] === '' || contagem[it.id] == null) return;
    setBusy(it.id);
    try {
      await onAcao({ acao: 'mov', id: it.id, tipo: 'contagem', qtd: real, motivo: 'Conferência' });
      setContagem((m) => { const n = { ...m }; delete n[it.id]; return n; });
    } finally { setBusy(''); }
  };

  const itensOrdenados = useMemo(() => [...estoque].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')), [estoque]);
  const nf = (n) => { const v = Math.round(num(n) * 1000) / 1000; return String(v).replace('.', ','); };

  return (
    <div>
      <PageTitle sub="Confere se o estoque bate com a realidade">Conferência de Estoque</PageTitle>

      {/* Bloco 1: vendas que não baixam */}
      <SecTitle>Vendas que não baixam do estoque</SecTitle>
      {naoBaixam.length === 0 ? (
        <Card style={{ marginBottom: 16, borderColor: C.green }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>Tudo certo</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Todo produto que foi vendido está descendo do estoque pela ficha técnica.</div>
        </Card>
      ) : (
        <Card style={{ marginBottom: 16, borderColor: C.amber }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.amber }}>{naoBaixam.length} produto(s) vendidos sem baixar o estoque</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
            Estes foram vendidos mas <b>não desceram do estoque</b> — falta a ficha técnica ligando o produto ao item do estoque. Por isso o estoque fica mais alto que o real. Monte a ficha em <b>Fichas técnicas</b>.
          </div>
          {naoBaixam.map((p) => (
            <div key={p.cardapioId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '7px 0', borderTop: `1px solid ${C.line}`, marginTop: 7 }}>
              <span style={{ minWidth: 0, color: C.text }}>{p.nome}</span>
              <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{nf(p.qtd)} vendida(s)</span>
            </div>
          ))}
        </Card>
      )}

      {/* Bloco 2: conferência de contagem */}
      <SecTitle>Conferir a contagem</SecTitle>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
        Digite quanto tem <b>de verdade</b> na prateleira. O sistema mostra a diferença e você acerta com um toque. O resumo mostra pra onde o item foi (pelos últimos movimentos).
      </div>
      {!carregado ? (
        <Empty>Carregando o estoque…</Empty>
      ) : itensOrdenados.length === 0 ? (
        <Empty>Nenhum item no estoque ainda.</Empty>
      ) : (
        itensOrdenados.map((it) => {
          const sistema = num(it.saldo);
          const digitado = contagem[it.id];
          const temValor = digitado !== '' && digitado != null;
          const real = num(digitado);
          const dif = temValor ? Math.round((real - sistema) * 1000) / 1000 : 0;
          const rm = resumoMov(it);
          const un = it.unidade || 'un';
          return (
            <Card key={it.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: C.text, minWidth: 0 }}>{it.nome}</span>
                <span style={{ fontSize: 12, color: C.faint, flexShrink: 0 }}>sistema: <b style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>{nf(sistema)}</b> {un}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 9 }}>
                <input
                  type="text" inputMode="decimal" placeholder="contagem real"
                  value={digitado == null ? '' : digitado}
                  onChange={(e) => setContagem((m) => ({ ...m, [it.id]: paraVirgula(e.target.value) }))}
                  style={{ flex: 1, minWidth: 0, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 9, padding: '9px 12px', color: C.text, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}
                />
                <Btn small onClick={() => { if (!temValor || busy === it.id) return; acertar(it); }}>{busy === it.id ? '…' : 'Acertar'}</Btn>
              </div>
              {temValor && dif !== 0 && (
                <div style={{ fontSize: 12.5, marginTop: 7, fontWeight: 700, color: dif < 0 ? C.red : C.green }}>
                  {dif < 0 ? `Faltam ${nf(Math.abs(dif))} ${un} (o sistema achava que tinha mais)` : `Sobram ${nf(dif)} ${un} (tem mais do que o sistema achava)`}
                </div>
              )}
              {(rm.entrou > 0 || rm.venda > 0 || rm.cortesia > 0 || rm.outras > 0) && (
                <div style={{ fontSize: 11.5, color: C.faint, marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: '2px 12px', lineHeight: 1.5 }}>
                  {rm.entrou > 0 && <span>entrou <b style={{ color: C.muted }}>{nf(rm.entrou)}</b></span>}
                  {rm.venda > 0 && <span>vendas <b style={{ color: C.muted }}>{nf(rm.venda)}</b></span>}
                  {rm.cortesia > 0 && <span>cortesia/consumo <b style={{ color: C.muted }}>{nf(rm.cortesia)}</b></span>}
                  {rm.outras > 0 && <span>perdas/saídas <b style={{ color: C.muted }}>{nf(rm.outras)}</b></span>}
                  <span style={{ opacity: 0.7 }}>· últimos movimentos</span>
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
