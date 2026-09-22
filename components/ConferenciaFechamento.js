'use client';
import React, { useState } from 'react';
import { C, Card, QtdInput, Empty } from './ui';
import { brl, limparNome } from '../lib/util';

// A conferência do fechamento, em duas partes separadas de propósito:
//
//   ContarNoFechamento   — a contagem, ÀS CEGAS, igual pra quem estiver lá.
//   ResultadoConferencia — o resultado, depois, só pra dona.
//
// Por que às cegas pra todo mundo, inclusive pra ela:
//
// 1) Quem enxerga "o sistema diz 6" digita 6. Não é má fé — é o que a cabeça
//    faz quando tem um número pronto na frente. A contagem só vale alguma coisa
//    se sair da prateleira, não da tela.
// 2) Tem noite que quem fecha é ela e tem noite que é o atendimento. Se a tela
//    muda conforme quem está lá, a conta de terça não é comparável com a de
//    quarta — e o que interessa aqui é justamente o padrão ao longo das
//    semanas, não a noite isolada.
const CORES = { certo: '#FF5A5A', duvidoso: '#F5A524', sobra: '#6AA9FF', ok: '#3FBF7F' };

export function ContarNoFechamento({ itens = [], contagens = {}, onContagens }) {
  const set = (id) => (v) => onContagens({ ...contagens, [id]: v });

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', color: C.muted, fontWeight: 700, marginBottom: 6 }}>
        Conferir o estoque (opcional)
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
        Conta na prateleira e digita o que tem de verdade. Não mostro o que o sistema espera de propósito — se eu
        mostrasse, a conta viria da tela e não da prateleira. O resultado aparece depois de fechar.
      </div>

      {itens.length === 0 ? (
        <Empty>Nada mexeu no estoque hoje.</Empty>
      ) : (
        <div style={{ maxHeight: 250, overflowY: 'auto', margin: '0 -4px 10px', padding: '0 4px' }}>
          {itens.map((it) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderTop: `1px solid ${C.hair}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: C.text }}>{limparNome(it.nome)}</div>
                <div style={{ fontSize: 11, color: C.faint }}>em {it.unidade || 'un'}</div>
              </div>
              <div style={{ width: 110, flexShrink: 0 }}>
                <QtdInput value={contagens[it.id] ?? ''} onChange={set(it.id)} placeholder="contei" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// O resultado guardado de uma conferência. Serve logo depois de fechar e também
// no histórico de caixas — é a mesma coisa, então é o mesmo componente.
export function ResultadoConferencia({ conferencia, conferidoPor, compacto }) {
  if (!conferencia || !conferencia.totais) return null;
  const { veredito, faltas = [], totais } = conferencia;
  const grave = totais.receitaPerdidaCerta > 0 || totais.faltaNoCaixa > 0;
  const quem = conferidoPor === 'garcom' ? ' · contado pelo atendimento'
    : conferidoPor === 'dona' ? ' · contado pela Karen' : '';

  const corpo = (
    <>
      <div style={{ fontSize: 11, color: C.faint, fontWeight: 800, letterSpacing: '.06em', marginBottom: 6 }}>
        CONFERÊNCIA DO ESTOQUE{quem}
      </div>
      {veredito?.texto && (
        <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55, marginBottom: faltas.length ? 8 : 0 }}>{veredito.texto}</div>
      )}
      {faltas.map((fl, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, padding: '3px 0' }}>
          <span style={{ color: CORES[fl.nivel] || C.muted, minWidth: 0 }}>
            {fl.nome} · contou {fl.contado}, sistema {fl.sistema} {fl.unidade}
          </span>
          <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {fl.nivel === 'sobra' ? 'sobrando' : fl.receitaPerdida > 0 ? brl(fl.receitaPerdida) : brl(fl.custoPerdido)}
          </span>
        </div>
      ))}
      {totais.saidasNaMao > 0 && (
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>
          Saídas lançadas na mão hoje: <b style={{ color: C.text }}>{brl(totais.saidasNaMao)}</b>. Isso é decisão tua, não furo.
        </div>
      )}
    </>
  );

  if (compacto) return <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.line}` }}>{corpo}</div>;
  return <Card style={{ padding: 12, marginTop: 12, borderColor: grave ? C.amber : C.green }}>{corpo}</Card>;
}

// O PADRÃO DAS ÚLTIMAS NOITES.
//
// Isto existe porque o conselho "abre o histórico e vê se tem item repetindo"
// não é tarefa pra pessoa: seriam quinze caixas abertos um por um, guardando
// nomes de cabeça. Uma falta é ocorrência; a mesma falta toda semana é padrão —
// e o padrão é a única coisa que autoriza uma conversa com alguém.
export function PadraoConferencias({ padrao }) {
  const [aberto, setAberto] = useState(false);
  if (!padrao || padrao.poucasNoites || !padrao.itens.length) return null;
  const repetem = padrao.itens.filter((i) => i.repete);
  const mostrar = aberto ? padrao.itens : padrao.itens.slice(0, 5);

  return (
    <Card style={{ marginTop: 20, borderColor: repetem.length ? C.amber : C.cardBorder }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 700 }}>
        Padrão das últimas {padrao.noites} noites
      </div>
      <div style={{ fontSize: 12.5, color: C.muted, margin: '5px 0 12px', lineHeight: 1.5 }}>
        {repetem.length
          ? <><b style={{ color: C.text }}>{repetem.length} produto(s) apareceram mais de uma vez.</b> Uma noite é azar; toda semana é outra coisa.</>
          : <>Nenhum produto repetiu. As faltas que apareceram foram de uma noite só.</>}
        {padrao.totalPerdido > 0 && <> Somando tudo: <b style={{ color: C.red }}>{brl(padrao.totalPerdido)}</b>.</>}
      </div>

      {mostrar.map((i) => (
        <div key={i.nome} style={{ padding: '9px 0', borderTop: `1px solid ${C.line}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: i.repete ? 700 : 500, color: CORES[i.pior] || C.text, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
              {i.nome}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, flexShrink: 0, fontVariantNumeric: 'tabular-nums', color: i.pior === 'sobra' ? C.muted : C.red }}>
              {i.pior === 'sobra' ? 'sobrando' : brl(i.valor)}
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 3, lineHeight: 1.45 }}>
            {i.pior === 'sobra' ? 'sobrou' : 'faltou'} <b style={{ color: C.muted }}>{i.falhas}</b> {i.falhas === 1 ? 'vez' : 'vezes'}
            {' '}{padrao.base === 'contado' ? `em ${i.de} contagem(ns)` : `em ${i.de} noite(s)`}
            {i.taxa != null && i.falhas > 1 ? ` · ${i.taxa}% das vezes` : ''}
            {i.niveis.duvidoso > 0 && i.pior !== 'duvidoso' ? ` · ${i.niveis.duvidoso} delas em dúvida` : ''}
          </div>
          {/* Cada cor pede uma ação diferente, e é isso que o número sozinho
              não diz. */}
          {i.repete && (
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4, lineHeight: 1.45 }}>
              {i.pior === 'certo' ? 'Item contado no dedo e vendido direto. Repetindo assim, vale olhar de perto quem fecha nessas noites.'
                : i.pior === 'sobra' ? 'Sobra repetida quase sempre é compra que não está sendo lançada — confere as notas desse fornecedor.'
                  : 'Em dúvida: ou é produto sem ficha técnica no cardápio, ou é peso/volume. Monta a ficha e o número passa a valer.'}
            </div>
          )}
        </div>
      ))}

      {padrao.itens.length > 5 && (
        <button type="button" onClick={() => setAberto((v) => !v)}
          style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '8px 0 0' }}>
          {aberto ? 'mostrar menos' : `ver os outros ${padrao.itens.length - 5}`}
        </button>
      )}

      {padrao.base === 'noites' && (
        <div style={{ fontSize: 11, color: C.faint, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.line}`, lineHeight: 1.5 }}>
          A conta está sobre o total de noites, não sobre as vezes em que cada item foi contado — tem caixa aqui de antes dessa parte existir.
          Conforme essas noites forem saindo da lista, a conta fica mais justa sozinha.
        </div>
      )}
    </Card>
  );
}

export default ContarNoFechamento;
