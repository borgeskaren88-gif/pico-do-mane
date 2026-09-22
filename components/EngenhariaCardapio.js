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

// Uma linha de produto: o NOME numa linha inteira e os números embaixo.
//
// Antes era tudo na mesma linha, e no celular o nome levava reticências —
// "Mirante - ...", "Cum...". Um cardápio que ela não consegue ler não serve
// pra decidir nada, e nome de produto de bar é comprido por natureza.
function Linha({ l }) {
  const total = l.lucro * l.qtd;
  return (
    <div style={{ padding: '9px 0', borderTop: `1px solid ${C.line}` }}>
      <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{l.nome}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 3 }}>
        <span style={{ fontSize: 11.5, color: C.faint }}>
          {brl(l.lucro)} cada · saiu {l.qtd}
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, flexShrink: 0, fontVariantNumeric: 'tabular-nums', color: total >= 0 ? C.green : C.red }}>
          {brl(total)}
        </span>
      </div>
    </div>
  );
}

// O grupo fecha e abre no título. Com 77 produtos no cardápio, deixar tudo
// aberto vira uma página de rolagem infinita onde ela se perde — ela pediu
// pra clicar no título e só então ver os produtos.
function Grupo({ g, abertoInicial = false }) {
  const [aberto, setAberto] = useState(abertoInicial);
  const cor = COR[g.chave] || C.muted;
  return (
    <div style={{ borderLeft: `3px solid ${cor}`, paddingLeft: 12, marginBottom: 14 }}>
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}
        style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '2px 0 6px', cursor: 'pointer', color: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: cor, minWidth: 0 }}>
            {g.icone} {g.nome} ({g.qtdItens})
          </span>
          <span style={{ fontSize: 13, color: C.faint, flexShrink: 0 }}>{aberto ? '▾' : '▸'}</span>
        </div>
        <div style={{ fontSize: 11.5, color: C.faint, marginTop: 2 }}>
          {g.resumo} · deu {brl(g.lucroTotal)} no mês
        </div>
      </button>

      {aberto && (
        <div style={{ paddingBottom: 4 }}>
          <div style={{ fontSize: 12.5, color: C.muted, margin: '4px 0 8px', lineHeight: 1.5 }}>{g.texto}</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, background: C.panel2, borderRadius: 10, padding: '9px 12px', lineHeight: 1.45, marginBottom: 4 }}>
            {g.acao}
          </div>
          {g.itens.map((l) => <Linha key={l.id || l.nome} l={l} />)}
        </div>
      )}
    </div>
  );
}

// Produto com a ficha técnica quebrada. Fica fora da matriz e aparece aqui,
// porque o conserto é outro: é ir na ficha, não mexer no cardápio.
function Impossiveis({ itens }) {
  const [aberto, setAberto] = useState(false);
  if (!itens || !itens.length) return null;
  return (
    <div style={{ border: `1px solid ${C.red}`, borderRadius: 12, padding: '11px 13px', marginBottom: 14 }}>
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}
        style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.red }}>Ficha técnica com erro ({itens.length})</span>
          <span style={{ fontSize: 13, color: C.faint, flexShrink: 0 }}>{aberto ? '▾' : '▸'}</span>
        </div>
      </button>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
        O custo destes está <b style={{ color: C.text }}>muitas vezes maior que o preço</b> — isso não é prejuízo, é erro de cadastro.
        Ficaram de fora da conta: com eles dentro, a linha de corte ia pro negativo e <b style={{ color: C.text }}>todo o resto do cardápio</b> saía classificado errado.
      </div>
      {aberto && itens.map((l) => (
        <div key={l.id || l.nome} style={{ padding: '9px 0', borderTop: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{l.nome}</div>
          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 3 }}>
            vende por {brl(l.preco)} e a ficha diz que custa <b style={{ color: C.red }}>{brl(l.custo)}</b>
          </div>
        </div>
      ))}
      <div style={{ fontSize: 11.5, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
        Abre a ficha técnica de cada um e confere a <b style={{ color: C.muted }}>unidade</b> de cada ingrediente. Quase sempre é grama cadastrado como quilo, ou ml como litro — mil vezes mais do que devia.
      </div>
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
      {/* O primeiro grupo já vem aberto, pra ela ver de cara que ali tem uma
          lista dentro — senão quatro títulos fechados parecem só quatro
          títulos, e ninguém toca. */}
      {r.grupos.map((g, i) => <Grupo key={g.chave} g={g} abertoInicial={i === 0} />)}
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
        <>
          <Impossiveis itens={geral.impossiveis} />
          {geral.poucosDados ? <Empty>{geral.motivo}</Empty> : <Matriz r={geral} />}
        </>
      ) : (
        <>
          <Impossiveis itens={porCat.impossiveis} />
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
