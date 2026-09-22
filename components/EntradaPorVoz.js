'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, QtdInput, inputStyle } from './ui';
import { limparNome, numQtd } from '../lib/util';
import { entendeEntradaFalada } from '../lib/estoqueFala';

// ABASTECER FALANDO
//
// Ela dita "entrou 5 red bull, 5 coca zero e 2,500 de limão" e o PicoOS monta
// as linhas. Ela confere, corrige o que estiver errado, e só então grava.
//
// POR QUE TEM TELA DE CONFERÊNCIA. O app que ela viu já abastece direto. Aqui
// não, e não é frescura: o saldo do estoque alimenta o CMV, o custo médio, o
// mínimo sugerido, a curva ABC, a validade por lote e a conferência do
// fechamento de caixa. Um "vinte e cinco" ouvido no lugar de "dois e meio" não
// estragaria só a linha do limão — envenenaria o mês inteiro, e ela só
// descobriria dias depois sem saber de onde veio. Dois segundos de conferência
// valem mais do que isso.
//
// POR QUE CAIXA DE TEXTO E NÃO BOTÃO DE MICROFONE. Ela usa iPhone, onde o
// reconhecimento do navegador é irregular (às vezes o MicBtn nem aparece). O
// microfone do teclado do próprio iPhone funciona sempre, em qualquer campo de
// texto. Então o caminho é: toca na caixa, toca no microfone do teclado, fala.
export default function EntradaPorVoz({ itens = [], onLote }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [linhas, setLinhas] = useState(null);   // null = ainda não interpretou
  const [sobra, setSobra] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const ordenados = useMemo(
    () => [...itens].sort((a, b) => limparNome(a.nome).localeCompare(limparNome(b.nome), 'pt-BR')),
    [itens],
  );

  const entender = () => {
    const r = entendeEntradaFalada(texto, itens);
    setLinhas(r.linhas);
    setSobra(r.sobra);
    setMsg(r.linhas.length ? '' : 'Não achei nenhuma quantidade na frase. Fala assim: "5 red bull, 2 quilos de limão".');
  };

  const limpar = () => { setTexto(''); setLinhas(null); setSobra(''); setMsg(''); };

  // Trocar o item na mão resolve a linha: foi ela que disse, não se discute.
  const trocarItem = (id, itemId) => setLinhas((ls) => ls.map((l) => {
    if (l.id !== id) return l;
    const item = itens.find((x) => x.id === itemId) || null;
    return { ...l, item, unidade: item ? (item.unidade || 'un') : l.unidade, nivel: item ? 'ok' : 'nao-achei', recado: item ? '' : 'Escolhe o item.' };
  }));

  const trocarQtd = (id, v) => setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, qtd: v, nivel: l.item ? 'ok' : l.nivel, recado: l.item ? '' : l.recado } : l)));

  const tirar = (id) => setLinhas((ls) => ls.filter((l) => l.id !== id));

  const prontas = (linhas || []).filter((l) => l.item && numQtd(l.qtd) > 0);

  const gravar = async () => {
    if (busy || !prontas.length) return;
    setBusy(true); setMsg('');
    try {
      const j = await onLote(prontas.map((l) => ({ id: l.item.id, qtd: l.qtd })));
      if (j && j.ok) {
        const n = j.lancadas || prontas.length;
        setMsg(`Pronto: ${n} ${n === 1 ? 'item abastecido' : 'itens abastecidos'}.`);
        setTexto(''); setLinhas(null); setSobra('');
      } else setMsg((j && j.erro) || 'Não consegui lançar. Tenta de novo.');
    } catch {
      setMsg('Não consegui lançar. Tenta de novo.');
    }
    setBusy(false);
  };

  if (!aberto) {
    return (
      <Card style={{ marginBottom: 14, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Abastecer falando</div>
            <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>Dita o que chegou e confere antes de gravar</div>
          </div>
          <Btn kind="ghost" small onClick={() => setAberto(true)}>Abrir</Btn>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Abastecer falando</div>
        <Btn kind="ghost" small onClick={() => { setAberto(false); limpar(); }}>Fechar</Btn>
      </div>

      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 10 }}>
        Toca na caixa, toca no <b style={{ color: C.text }}>microfone do teclado</b> do teu celular e fala o que chegou. Depois confere as linhas e toca em abastecer.
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        placeholder="entrou 5 red bull, 5 coca zero e 2,500 de limão"
        style={{
          width: '100%', boxSizing: 'border-box', background: C.panel2, color: C.text,
          border: `1px solid ${C.line}`, borderRadius: 12, padding: '11px 13px',
          fontSize: 15, lineHeight: 1.45, resize: 'vertical', fontFamily: 'inherit',
        }}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <Btn small onClick={entender} disabled={!texto.trim()}>Entender</Btn>
        {(texto || linhas) && <Btn kind="ghost" small onClick={limpar}>Limpar</Btn>}
      </div>

      {msg && (
        <div style={{ fontSize: 13, color: msg.startsWith('Pronto') ? C.green : C.amber, marginTop: 10, lineHeight: 1.45, fontWeight: 600 }}>{msg}</div>
      )}

      {linhas && linhas.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 800, marginBottom: 8 }}>
            Confere antes de gravar
          </div>

          {linhas.map((l) => {
            const cor = l.nivel === 'ok' ? C.line : l.nivel === 'confira' ? C.amber : C.red;
            return (
              <div key={l.id} style={{ border: `1px solid ${cor}`, borderRadius: 12, padding: '10px 12px', marginBottom: 8, background: C.panel2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: l.nivel === 'ok' ? 0 : 8 }}>
                  <div style={{ width: 92, flexShrink: 0 }}>
                    <QtdInput value={l.qtd == null ? '' : String(l.qtd)} onChange={(v) => trocarQtd(l.id, v)} />
                  </div>
                  <span style={{ fontSize: 13, color: C.faint, flexShrink: 0 }}>{l.unidade}</span>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.item ? limparNome(l.item.nome) : <span style={{ color: C.red }}>{l.falado || 'sem nome'}</span>}
                    </div>
                    {l.item && l.falado && (
                      <div style={{ fontSize: 11, color: C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>tu falou "{l.falado}"</div>
                    )}
                  </div>
                  <button type="button" onClick={() => tirar(l.id)} aria-label="Tirar esta linha"
                    style={{ background: 'transparent', border: 'none', color: C.faint, fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>×</button>
                </div>

                {l.nivel !== 'ok' && (
                  <>
                    <div style={{ fontSize: 12, color: l.nivel === 'confira' ? C.amber : C.red, marginBottom: 7, lineHeight: 1.4 }}>{l.recado}</div>
                    <select value={l.item ? l.item.id : ''} onChange={(e) => trocarItem(l.id, e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                      <option value="">— escolher item —</option>
                      {ordenados.map((it) => <option key={it.id} value={it.id}>{limparNome(it.nome)} ({it.unidade || 'un'})</option>)}
                    </select>
                  </>
                )}
              </div>
            );
          })}

          {sobra && (
            <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4, marginBottom: 8, lineHeight: 1.45 }}>
              Não usei isto da tua frase: "{sobra}"
            </div>
          )}

          <Btn onClick={gravar} disabled={busy || !prontas.length} style={{ width: '100%', marginTop: 6 }}>
            {busy ? 'Abastecendo…' : prontas.length ? `Abastecer ${prontas.length} ${prontas.length === 1 ? 'item' : 'itens'}` : 'Resolve as linhas acima'}
          </Btn>
        </div>
      )}
    </Card>
  );
}
