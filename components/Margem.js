'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, KPI, Empty, PageTitle, TextInput } from './ui';
import { brl, num } from '../lib/util';
import { custoDaFicha } from '../lib/estoque';

// Margem por produto: cruza o CUSTO da ficha técnica com o PREÇO do cardápio,
// pra mostrar quanto cada item dá de lucro. Piores margens primeiro — é onde o
// dinheiro some sem perceber. Só leitura, não muda nada.
export default function Margem({ cardapio = [], fichas = [], estoque = [] }) {
  const [busca, setBusca] = useState('');
  const fichaPorId = useMemo(
    () => new Map(fichas.filter((f) => f && f.cardapioId).map((f) => [f.cardapioId, Array.isArray(f.itens) ? f.itens : []])),
    [fichas],
  );

  const linhas = useMemo(() => {
    const arr = [];
    for (const c of cardapio) {
      if (c.ativo === false) continue;
      const preco = num(c.preco);
      const ficha = fichaPorId.get(c.id);
      if (!ficha || !ficha.length) { arr.push({ id: c.id, nome: c.nome, preco, semFicha: true }); continue; }
      const { custo, completo } = custoDaFicha(ficha, estoque);
      const lucro = Math.round((preco - custo) * 100) / 100;
      const margem = preco > 0 ? (lucro / preco) * 100 : 0;
      arr.push({ id: c.id, nome: c.nome, preco, custo, lucro, margem, completo, temSabores: Array.isArray(c.sabores) && c.sabores.length > 0 });
    }
    return arr.sort((a, b) => {
      if (a.semFicha !== b.semFicha) return a.semFicha ? 1 : -1;
      if (a.semFicha) return (a.nome || '').localeCompare(b.nome || '');
      return a.margem - b.margem; // piores primeiro
    });
  }, [cardapio, fichaPorId, estoque]);

  const comFicha = linhas.filter((l) => !l.semFicha);
  const noPrejuizo = comFicha.filter((l) => l.lucro < -0.005).length;
  const semFicha = linhas.filter((l) => l.semFicha).length;
  const margemMedia = comFicha.length ? comFicha.reduce((s, l) => s + l.margem, 0) / comFicha.length : 0;

  const filtro = busca.trim().toLowerCase();
  const lista = filtro ? linhas.filter((l) => (l.nome || '').toLowerCase().includes(filtro)) : linhas;

  const corMargem = (m) => (m < 0 ? C.red : m < 40 ? C.amber : C.green);

  return (
    <div>
      <PageTitle sub="Quanto cada item custa de ingredientes vs. o preço de venda">Margem por produto</PageTitle>

      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
          O <b style={{ color: C.text }}>lucro de cada item</b> = preço − custo dos ingredientes (da ficha técnica). Os <b style={{ color: C.red }}>piores primeiro</b>, pra você achar onde está perdendo dinheiro. Itens <b>sem ficha</b> não dá pra calcular — ficam no fim.
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <KPI titulo="Margem média" valor={comFicha.length ? margemMedia.toFixed(0) + '%' : '—'} cor={corMargem(margemMedia)} sub={`${comFicha.length} item(ns) com ficha`} />
        <KPI titulo="No prejuízo" valor={String(noPrejuizo)} cor={noPrejuizo > 0 ? C.red : C.green} sub={noPrejuizo > 0 ? 'itens que custam mais que vendem' : 'nenhum item no vermelho'} />
      </div>

      {semFicha > 0 && (
        <div style={{ fontSize: 12, color: C.amber, marginBottom: 12 }}>⚠️ {semFicha} item(ns) sem ficha técnica — monte a ficha deles pra entrar no cálculo.</div>
      )}

      <div style={{ marginBottom: 12 }}><TextInput value={busca} onChange={setBusca} placeholder="Buscar produto…" /></div>

      {lista.length === 0 ? <Empty>Nenhum produto{filtro ? ' com esse nome' : ' no cardápio'}.</Empty> : lista.map((l) => (
        <Card key={l.id} style={{ marginBottom: 8, padding: '12px 14px', borderColor: !l.semFicha && l.lucro < -0.005 ? C.red : C.cardBorder }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{l.nome}</div>
              {l.semFicha ? (
                <div style={{ fontSize: 12, color: C.faint }}>preço {brl(l.preco)} · sem ficha técnica</div>
              ) : (
                <div style={{ fontSize: 12, color: C.faint }}>
                  preço {brl(l.preco)} · custo {brl(l.custo)}{!l.completo ? ' (parcial)' : ''}{l.temSabores ? ' · sabores variam' : ''}
                </div>
              )}
            </div>
            {!l.semFicha && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: corMargem(l.margem), lineHeight: 1 }}>{l.margem.toFixed(0)}%</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: l.lucro >= 0 ? C.green : C.red, marginTop: 2 }}>{l.lucro >= 0 ? 'lucro ' : 'prejuízo '}{brl(Math.abs(l.lucro))}</div>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
