'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, Empty } from './ui';
import { brl, mesLabel } from '../lib/util';
import { engenhariaDoCardapio, engenhariaPorCategoria, primeiroPasso } from '../lib/engenharia';

// ENGENHARIA DE CARDÁPIO na tela.
//
// Quatro cantos, e cada um pede uma coisa diferente. O ponto não é o rótulo
// bonitinho: é que olhando só a margem ela tiraria do cardápio um prato que
// puxa gente, e olhando só a quantidade ela protegeria um campeão de venda que
// não deixa nada.

const COR = { estrela: C.amber, burro: C.accent, quebra: C.green, cachorro: C.red };

function Grupo({ g }) {
  const [tudo, setTudo] = useState(false);
  const cor = COR[g.chave] || C.muted;
  const mostrar = tudo ? g.itens : g.itens.slice(0, 5);
  return (
    <div style={{ borderLeft: `3px solid ${cor}`, paddingLeft: 12, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: cor, minWidth: 0 }}>
          {g.icone} {g.nome} ({g.qtdItens})
        </div>
        <div style={{ fontSize: 11, color: C.faint, flexShrink: 0, whiteSpace: 'nowrap' }}>{g.resumo}</div>
      </div>

      <div style={{ fontSize: 12, color: C.muted, margin: '5px 0 6px', lineHeight: 1.5 }}>{g.texto}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, background: C.panel2, borderRadius: 10, padding: '8px 11px', lineHeight: 1.45, marginBottom: 8 }}>
        {g.acao}
      </div>

      {mostrar.map((l) => (
        <div key={l.id || l.nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderTop: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nome}</div>
          <div style={{ fontSize: 11, color: C.faint, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {brl(l.lucro)} cada · saiu {l.qtd} · deu <b style={{ color: C.text }}>{brl(l.lucro * l.qtd)}</b>
          </div>
        </div>
      ))}
      {g.itens.length > 5 && (
        <button type="button" onClick={() => setTudo((v) => !v)}
          style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '6px 0' }}>
          {tudo ? 'mostrar menos' : `ver os outros ${g.itens.length - 5}`}
        </button>
      )}
    </div>
  );
}

function Matriz({ r }) {
  const passo = primeiroPasso(r);
  return (
    <>
      {passo && (
        <div style={{ fontSize: 12.5, color: C.text, background: C.panel2, borderRadius: 12, padding: '11px 13px', lineHeight: 1.5, marginBottom: 14 }}>
          <b style={{ color: C.accent }}>Por onde começar: </b>{passo}
        </div>
      )}
      {r.grupos.map((g) => <Grupo key={g.chave} g={g} />)}
      {/* Onde estão os cortes. Sem isto, os rótulos viram opinião do app —
          e ela não teria como discordar de um número que não vê. */}
      <div style={{ fontSize: 11, color: C.faint, lineHeight: 1.5, paddingTop: 8, borderTop: `1px solid ${C.line}` }}>
        A linha de corte: deixar <b style={{ color: C.muted }}>{brl(r.cortes.margem)}</b> por unidade (a média do que saiu)
        e sair <b style={{ color: C.muted }}>{r.cortes.popularidade.toFixed(0)}</b> vezes
        ({r.cortes.nItens} produtos, {r.cortes.totalQtd} unidades no total).
      </div>
    </>
  );
}

export default function EngenhariaCardapio({ linhas = [], mes }) {
  const [modo, setModo] = useState('todo'); // 'todo' | 'categoria'

  const geral = useMemo(() => engenhariaDoCardapio(linhas), [linhas]);
  const porCat = useMemo(() => engenhariaPorCategoria(linhas), [linhas]);

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', color: C.accent, fontWeight: 700, marginBottom: 4 }}>
        Engenharia do cardápio — {mesLabel(mes)}
      </div>
      <div style={{ fontSize: 12, color: C.faint, marginBottom: 12, lineHeight: 1.45 }}>
        Cruza <b style={{ color: C.text }}>quanto cada item deixa</b> com <b style={{ color: C.text }}>quantas vezes ele sai</b>. Cada canto pede uma coisa diferente.
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['todo', 'Cardápio todo'], ['categoria', 'Por categoria']].map(([v, rot]) => (
          <button key={v} type="button" onClick={() => setModo(v)} style={{
            borderRadius: 999, padding: '7px 13px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            border: `1px solid ${modo === v ? C.accent : C.line}`,
            background: modo === v ? C.accent : 'transparent',
            color: modo === v ? '#06101F' : C.muted,
          }}>{rot}</button>
        ))}
      </div>

      {modo === 'todo' ? (
        geral.poucosDados ? <Empty>{geral.motivo}</Empty> : <Matriz r={geral} />
      ) : (
        <>
          {/* Comparar dentro da categoria é a leitura mais correta: chopp e
              porção não disputam o mesmo lugar no cardápio. Junto com tudo, o
              chopp sempre vira burro de carga — o que é a natureza dele. */}
          <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 12, lineHeight: 1.5 }}>
            Chopp e porção não disputam o mesmo lugar. Comparados juntos, o chopp sempre vira burro de carga — aqui cada um é comparado com os da sua categoria.
          </div>
          {porCat.categorias.length === 0 ? (
            <Empty>Nenhuma categoria tem produtos suficientes pra comparar ainda.</Empty>
          ) : porCat.categorias.map((c) => (
            <div key={c.categoria} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 10 }}>{c.categoria}</div>
              <Matriz r={c} />
            </div>
          ))}
          {porCat.forasteiras.length > 0 && (
            <div style={{ fontSize: 11, color: C.faint, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}`, lineHeight: 1.5 }}>
              Ficaram de fora, com produtos de menos pra comparar: {porCat.forasteiras.map((f) => `${f.categoria} (${f.qtdItens})`).join(', ')}.
            </div>
          )}
        </>
      )}
    </Card>
  );
}
