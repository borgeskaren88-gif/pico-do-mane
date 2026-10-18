'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, Btn, NumInput, Label } from './ui';
import { brl } from '../lib/util';
import { olharOTeto, TETO_MEI_PADRAO } from '../lib/teto';

// O AVISO DO TETO DO MEI.
//
// Fala alto quando está perto e fica quieto quando está longe. Um card que
// grita todo mês vira paisagem e deixa de ser lido justamente no mês em que
// importava — o mesmo motivo pelo qual a compra de emergência só aparece
// quando houve.

const CORES = {
  tranquilo: C.green, atencao: C.amber, perto: C.amber, passou: C.red, estourou: C.red,
};

export default function TetoMEI({ receitas = [], config, onConfig }) {
  const [ajustando, setAjustando] = useState(false);
  const ativo = !config || config.ativo !== false;
  const teto = (config && config.teto) || TETO_MEI_PADRAO;
  const t = useMemo(() => olharOTeto({ receitas, teto }), [receitas, teto]);

  const salvar = (p) => { if (onConfig) onConfig({ ativo, teto, ...p }); };

  if (!ativo) {
    return (
      <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 14, lineHeight: 1.5 }}>
        O aviso de teto do MEI está desligado.{' '}
        <button onClick={() => salvar({ ativo: true })} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 11.5, fontWeight: 800, padding: 0 }}>ligar de novo</button>
      </div>
    );
  }

  if (t.faturado <= 0) return null; // Sem receita no ano não há o que avisar.

  const cor = CORES[t.nivel];
  const barra = Math.max(2, Math.min(100, t.pct));
  // A faixa de tolerância desenhada depois do teto: é onde ela ainda é MEI,
  // mas já com data marcada pra sair.
  const barraTol = Math.max(0, Math.min(100, ((t.faturado - t.limite) / (t.limiteTolerancia - t.limite)) * 100));

  const recado = () => {
    if (t.nivel === 'estourou') {
      return (<>
        Tu passou <b>mais de 20%</b> do teto. Nesse caso o desenquadramento é{' '}
        <b style={{ color: C.red }}>retroativo a 1º de janeiro de {t.ano}</b> — o ano inteiro passa a valer como
        Simples Nacional. <b>Fala com um contador esta semana</b>: quanto antes, menor a conta.
      </>);
    }
    if (t.nivel === 'passou') {
      return (<>
        Tu passou o teto em <b style={{ color: C.red }}>{brl(t.excesso)}</b>, mas ainda dentro dos 20% de tolerância
        (até {brl(t.limiteTolerancia)}). Tu segue MEI até 31/12 e paga um <b>DAS complementar</b> sobre o excesso —
        o desenquadramento vale a partir de <b>1º de janeiro de {t.ano + 1}</b>. Se o ritmo continuar e passar
        de {brl(t.limiteTolerancia)}, aí vira retroativo e fica bem pior. Procura um contador agora.
      </>);
    }
    if (t.estouro && t.vaiEstourar) {
      return (<>
        No ritmo de agora tu fecha o ano em <b style={{ color: cor }}>{brl(t.projecao)}</b> e bate no teto por
        volta de <b style={{ color: cor }}>{t.estouro.texto}</b>. Ainda dá pra decidir com calma: ou segura o
        faturamento, ou já começa a conversar com um contador sobre virar ME.
      </>);
    }
    if (t.nivel === 'perto') {
      return (<>Falta <b style={{ color: cor }}>{brl(t.folga)}</b> pro teto. Daqui pra frente, de olho todo mês.</>);
    }
    return (<>No ritmo de agora tu fecha o ano em <b style={{ color: C.text }}>{brl(t.projecao)}</b> — dentro do teto.
      Ainda cabem <b style={{ color: C.text }}>{brl(t.folga)}</b> este ano.</>);
  };

  return (
    <Card style={{ marginBottom: 14, borderColor: t.nivel === 'tranquilo' ? C.cardBorder : cor }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', color: cor, fontWeight: 800 }}>
          Teto do MEI · {t.ano}
        </span>
        <span style={{ fontSize: 12, color: C.faint }}>limite {brl(t.limite)}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginTop: 7 }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: cor, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{brl(t.faturado)}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.muted }}>{t.pct.toFixed(0)}% do teto</span>
      </div>
      <div style={{ fontSize: 11.5, color: C.faint, marginTop: 3 }}>faturado de 1º de janeiro até hoje</div>

      {/* A régua. A faixa depois do traço é a tolerância de 20%: ainda MEI,
          mas com data marcada pra sair. */}
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', height: 12, borderRadius: 7, overflow: 'hidden', background: C.panel2 }}>
          <div style={{ flex: 1, display: 'flex', background: C.panel2 }}>
            <div style={{ width: `${barra}%`, background: cor }} />
          </div>
          <div style={{ width: 2, background: C.text, flexShrink: 0 }} />
          <div style={{ width: 54, flexShrink: 0, background: `color-mix(in srgb, ${C.red} 18%, transparent)`, display: 'flex' }}>
            <div style={{ width: `${barraTol}%`, background: C.red }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: C.faint, marginTop: 5 }}>
          <span>0</span>
          <span>{brl(t.limite)} · teto</span>
          <span>+20%</span>
        </div>
      </div>

      <div style={{ fontSize: 13, color: C.text, marginTop: 12, lineHeight: 1.6 }}>{recado()}</div>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
        {ajustando ? (
          <>
            <Label>Teto anual (R$)</Label>
            <NumInput value={String(teto)} onChange={(v) => salvar({ teto: v })} placeholder="81000" />
            <div style={{ fontSize: 11.5, color: C.faint, margin: '6px 0 10px', lineHeight: 1.5 }}>
              Em {t.ano} o teto é R$ 81.000. Muda aqui se a lei subir o valor, ou se tu abriu o MEI no meio do
              ano — nesse caso o limite é proporcional: R$ 6.750 por mês de atividade.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn kind="ghost" small onClick={() => setAjustando(false)}>Pronto</Btn>
              <Btn kind="ghost" small onClick={() => { salvar({ ativo: false }); setAjustando(false); }}>Não sou MEI — tirar este aviso</Btn>
            </div>
          </>
        ) : (
          <button onClick={() => setAjustando(true)} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: 0 }}>
            ajustar o teto ou desligar o aviso
          </button>
        )}
      </div>
    </Card>
  );
}
