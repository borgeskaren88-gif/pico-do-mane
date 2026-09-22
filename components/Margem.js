'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, KPI, Empty, PageTitle, TextInput } from './ui';
import { brl, num, diaOperacional, ymOf, mesLabel } from '../lib/util';
import { norm } from '../lib/darci';
import { custoDaFicha, custoDosSabores } from '../lib/estoque';
import { cmvDoMes, lerCMV } from '../lib/cmv';
import { CATEGORIAS_CARDAPIO } from './Cardapio';

// Margem por produto: cruza o CUSTO da ficha técnica (+ fruta do sabor) com o
// PREÇO do cardápio, pra mostrar quanto cada item dá de lucro. Agrupado por
// categoria; com busca por nome. Só leitura, não muda nada.
export default function Margem({ cardapio = [], fichas = [], estoque = [], vendas = [] }) {
  const [busca, setBusca] = useState('');
  // Por onde olhar a lista. Margem % e lucro em R$ contam histórias
  // diferentes: a polenta tem 79% e dá R$ 13; o camarão tem 67% e dá R$ 70.
  // E o que paga as contas mesmo é lucro × quanto sai.
  const [ordem, setOrdem] = useState('margem'); // 'margem' | 'lucro' | 'mes'
  // Mês de calendário, igual Finanças e Relatórios. Era uma janela de 30 dias
  // corridos, que dava amostra do mesmo tamanho sempre — mas misturava dois
  // meses e não servia pra fechar o mês, que é o que ela usa pra decidir.
  const [mes, setMes] = useState(() => ymOf(diaOperacional()));

  // Quantas unidades de cada produto saíram NO MÊS ESCOLHIDO, pelo nome do item
  // na comanda. É aproximado — casa pelo nome, que é o que a venda guarda.
  const vendido = useMemo(() => {
    const m = new Map();
    for (const v of (vendas || [])) {
      const d = (v && v.data) || '';
      if (ymOf(d) !== mes) continue;
      for (const it of ((v && v.itens) || [])) {
        const q = num(it.qtd);
        if (q <= 0) continue;
        const k = norm(it.nome || '');
        if (!k) continue;
        m.set(k, (m.get(k) || 0) + q);
      }
    }
    return m;
  }, [vendas, mes]);
  // Os meses que têm venda, pra ela poder olhar um mês já fechado — que é o
  // caso de uso de "avaliar o mês": o mês corrente só fica completo no fim.
  const mesesDisp = useMemo(() => {
    const set = new Set((vendas || []).map((v) => ymOf(v && v.data)).filter(Boolean));
    set.add(ymOf(diaOperacional()));
    return [...set].sort().reverse().slice(0, 12);
  }, [vendas]);

  const fichaPorId = useMemo(
    () => new Map(fichas.filter((f) => f && f.cardapioId).map((f) => [f.cardapioId, Array.isArray(f.itens) ? f.itens : []])),
    [fichas],
  );

  const linhas = useMemo(() => {
    const arr = [];
    for (const c of cardapio) {
      if (c.ativo === false) continue;
      const preco = num(c.preco);
      const categoria = c.categoria || '';
      const ficha = fichaPorId.get(c.id);
      if (!ficha || !ficha.length) { arr.push({ id: c.id, nome: c.nome, categoria, preco, semFicha: true }); continue; }
      const base = custoDaFicha(ficha, estoque);
      const sab = custoDosSabores(c.sabores, estoque); // custo médio da fruta escolhida na venda
      const custo = Math.round((base.custo + sab.medio) * 100) / 100;
      const lucro = Math.round((preco - custo) * 100) / 100;
      const margem = preco > 0 ? (lucro / preco) * 100 : 0;
      const qtdMes = vendido.get(norm(c.nome || '')) || 0;
      arr.push({
        id: c.id, nome: c.nome, categoria, preco, custo, lucro, margem, completo: base.completo,
        temSabores: sab.n > 0, sabMin: base.custo + sab.min, sabMax: base.custo + sab.max,
        qtdMes, lucroMes: Math.round(lucro * qtdMes * 100) / 100,
      });
    }
    return arr.sort((a, b) => {
      if (a.semFicha !== b.semFicha) return a.semFicha ? 1 : -1;
      if (a.semFicha) return (a.nome || '').localeCompare(b.nome || '');
      if (ordem === 'lucro') return b.lucro - a.lucro;     // quem dá mais por unidade
      if (ordem === 'mes') return b.lucroMes - a.lucroMes; // quem mais pôs dinheiro no bolso
      return a.margem - b.margem;                          // piores primeiro
    });
  }, [cardapio, fichaPorId, estoque, vendido, ordem]);

  const comFicha = linhas.filter((l) => !l.semFicha);
  const noPrejuizo = comFicha.filter((l) => l.lucro < -0.005).length;
  const semFicha = linhas.filter((l) => l.semFicha).length;
  const margemMedia = comFicha.length ? comFicha.reduce((s, l) => s + l.margem, 0) / comFicha.length : 0;
  // O que o cardápio realmente pôs no bolso no mês escolhido.
  const lucroMes = comFicha.reduce((s, l) => s + l.lucroMes, 0);
  const temVendas = comFicha.some((l) => l.qtdMes > 0);

  // O CMV do mesmo mês. Sai pelo caminho da venda (ficha + o sabor escolhido),
  // não pela média desta tela — por isso vem da lib e não do `lucroMes` acima.
  const cmv = useMemo(() => cmvDoMes({ vendas, fichas, estoque, mes }), [vendas, fichas, estoque, mes]);
  const corCMV = { bom: C.green, atencao: C.amber, ruim: C.red, 'sem-base': C.amber, 'sem-dados': C.faint }[lerCMV(cmv).nivel];

  const filtro = busca.trim().toLowerCase();
  const lista = filtro ? linhas.filter((l) => (l.nome || '').toLowerCase().includes(filtro)) : [];

  // Agrupa por categoria (na ordem do cardápio) quando não está buscando.
  const grupos = useMemo(() => {
    const ordem = [...CATEGORIAS_CARDAPIO, ''];
    const map = new Map();
    for (const l of linhas) { const cat = l.categoria || ''; if (!map.has(cat)) map.set(cat, []); map.get(cat).push(l); }
    return [...map.entries()]
      .sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
      .map(([cat, itens]) => {
        const comF = itens.filter((l) => !l.semFicha);
        const avg = comF.length ? comF.reduce((s, l) => s + l.margem, 0) / comF.length : null;
        return { cat: cat || 'Sem categoria', itens, avg };
      });
  }, [linhas]);

  const corMargem = (m) => (m < 0 ? C.red : m < 40 ? C.amber : C.green);

  const linhaCard = (l) => (
    <Card key={l.id} style={{ marginBottom: 8, padding: '12px 14px', borderColor: !l.semFicha && l.lucro < -0.005 ? C.red : C.cardBorder }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{l.nome}</div>
          {l.semFicha ? (
            <div style={{ fontSize: 12, color: C.faint }}>preço {brl(l.preco)} · sem ficha técnica</div>
          ) : (
            <div style={{ fontSize: 12, color: C.faint }}>
              preço {brl(l.preco)} · custo {brl(l.custo)}{l.temSabores ? ` (c/ fruta média; varia ${brl(l.sabMin)}–${brl(l.sabMax)})` : ''}{!l.completo ? ' · parcial' : ''}
            </div>
          )}
        </div>
        {!l.semFicha && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: corMargem(l.margem), lineHeight: 1 }}>{l.margem.toFixed(0)}%</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: l.lucro >= 0 ? C.green : C.red, marginTop: 2 }}>{l.lucro >= 0 ? 'lucro ' : 'prejuízo '}{brl(Math.abs(l.lucro))}</div>
            {l.qtdMes > 0 ? (
              <div style={{ fontSize: 11, color: C.faint, marginTop: 3, whiteSpace: 'nowrap' }}>
                saiu {l.qtdMes} · deu <b style={{ color: l.lucroMes >= 0 ? C.green : C.red }}>{brl(Math.abs(l.lucroMes))}</b> em {mesLabel(mes)}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );

  return (
    <div>
      <PageTitle sub="Quanto cada item custa de ingredientes vs. o preço de venda">Margem por produto</PageTitle>

      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
          O <b style={{ color: C.text }}>lucro de cada item</b> = preço − custo dos ingredientes (da ficha + a fruta do sabor). Dentro de cada categoria, os <b style={{ color: C.red }}>piores primeiro</b>. Itens <b>sem ficha</b> não dá pra calcular.
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
        <KPI titulo="Margem média" valor={comFicha.length ? margemMedia.toFixed(0) + '%' : '—'} cor={corMargem(margemMedia)} sub={`${comFicha.length} item(ns) com ficha`} />
        <KPI titulo={`Lucro em ${mesLabel(mes)}`} valor={temVendas ? brl(lucroMes) : '—'} cor={lucroMes >= 0 ? C.green : C.red} sub={temVendas ? 'o que o cardápio te deu' : 'sem venda de comanda ainda'} />
        <KPI titulo="No prejuízo" valor={String(noPrejuizo)} cor={noPrejuizo > 0 ? C.red : C.green} sub={noPrejuizo > 0 ? 'custam mais que vendem' : 'nenhum item no vermelho'} />
        {/* O mesmo mês, visto por cima: quanto do que entrou foi embora em
            ingrediente. A conta detalhada fica em Finanças → Relatórios. */}
        <KPI
          titulo={`CMV em ${mesLabel(mes)}`}
          valor={cmv.pct == null ? '—' : `${cmv.pct.toFixed(0)}%`}
          cor={corCMV}
          sub={cmv.pct == null ? 'sem venda com ficha' : `${brl(cmv.cmv)} de ingrediente`}
        />
      </div>

      {/* Por onde olhar. Cada ordem responde uma pergunta diferente. */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['margem', 'pior margem'], ['lucro', 'maior lucro por unidade'], ['mes', 'quem mais deu no mês']].map(([v, rot]) => (
          <button key={v} onClick={() => setOrdem(v)} style={{
            borderRadius: 999, padding: '7px 13px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            border: `1px solid ${ordem === v ? C.accent : C.line}`,
            background: ordem === v ? C.accent : 'transparent',
            color: ordem === v ? '#06101F' : C.muted,
          }}>{rot}</button>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 12, lineHeight: 1.5 }}>
        {ordem === 'margem' ? 'Os que mais comem margem primeiro — é onde tem preço ou ficha pra rever.'
          : ordem === 'lucro' ? 'Quanto sobra em cada unidade vendida. Margem alta em produto barato rende pouco.'
            : `Lucro × quantas unidades saíram em ${mesLabel(mes)}. É o que realmente pagou as contas.`}
      </div>

      {semFicha > 0 && (
        <div style={{ fontSize: 12, color: C.amber, marginBottom: 12 }}>⚠️ {semFicha} item(ns) sem ficha técnica — monte a ficha deles pra entrar no cálculo.</div>
      )}

      {/* O mês que está sendo olhado. Mês fechado é o que serve pra avaliar de
          verdade; o corrente ainda está andando, e a tela avisa isso. */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {mesesDisp.map((m) => (
          <button key={m} onClick={() => setMes(m)} style={{
            border: `1px solid ${mes === m ? C.accent : C.line}`,
            background: mes === m ? C.accent : 'transparent',
            color: mes === m ? '#06101F' : C.muted,
            borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
          }}>{mesLabel(m)}</button>
        ))}
      </div>
      {mes === ymOf(diaOperacional()) && (
        <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 12, lineHeight: 1.45 }}>
          {mesLabel(mes)} ainda está correndo — são {Number(diaOperacional().slice(8, 10))} dia(s) até agora.
          Pra comparar um mês com o outro, espera fechar ou olha um mês anterior aí em cima.
        </div>
      )}

      <div style={{ marginBottom: 12 }}><TextInput value={busca} onChange={setBusca} placeholder="Buscar produto pelo nome…" /></div>

      {filtro ? (
        lista.length === 0 ? <Empty>Nenhum produto com esse nome.</Empty> : lista.map((l) => linhaCard(l))
      ) : (
        grupos.length === 0 ? <Empty>Nenhum produto no cardápio.</Empty> : grupos.map((g) => (
          <div key={g.cat} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, padding: '2px 4px 8px' }}>
              <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: C.accent }}>{g.cat}</span>
              {g.avg != null && <span style={{ fontSize: 12, fontWeight: 700, color: corMargem(g.avg) }}>média {g.avg.toFixed(0)}%</span>}
            </div>
            {g.itens.map((l) => linhaCard(l))}
          </div>
        ))
      )}
    </div>
  );
}
