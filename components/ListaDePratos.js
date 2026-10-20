'use client';
import React, { useMemo, useState } from 'react';
import { C, TextInput } from './ui';

// A lista de pratos com caixinha, usada pelos dois ajudantes da ficha.
//
// Em arquivo separado porque duas cópias do mesmo seletor acabam divergindo —
// uma ganha a busca, a outra não; uma mostra "já tem", a outra esquece. E aí a
// mesma tarefa parece duas telas diferentes pra quem usa.
//
// NOVENTA E DOIS ITENS NUMA CAIXA DE 260 PIXELS.
//
// Ela mandou print do ajudante aberto com "Shot", "Tilápia ao Molho de
// Laranja" e "Parmegiana de Carne" no topo, todos desmarcados — e os nove
// pratos que ela tinha marcado em algum lugar lá embaixo, invisíveis. Sem
// conseguir ver o que escolheu, não dá pra conferir nem corrigir: ela só pode
// marcar de novo e torcer.
//
// Daí os três acréscimos: a conta do que está marcado, um filtro pra ver só
// eles, e busca por nome. A ordem da lista NÃO muda com o clique de propósito
// — item que pula sob o dedo faz desmarcar o vizinho sem querer.
export default function ListaDePratos({ itens = [], marcados = [], onAlternar, jaTem = () => false, rotuloJaTem = 'já tem' }) {
  const [soMarcados, setSoMarcados] = useState(false);
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return itens.filter((c) => {
      if (soMarcados && !marcados.includes(c.id)) return false;
      if (t && !(c.nome || '').toLowerCase().includes(t)) return false;
      return true;
    });
  }, [itens, marcados, soMarcados, busca]);

  const n = marcados.filter((id) => itens.some((c) => c.id === id)).length;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: n > 0 ? C.accent : C.faint }}>
          {n} marcado{n === 1 ? '' : 's'}
        </span>
        {n > 0 && (
          <button onClick={() => setSoMarcados((v) => !v)} style={{
            borderRadius: 999, padding: '4px 11px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer',
            border: `1px solid ${soMarcados ? C.accent : C.line}`,
            background: soMarcados ? C.accent : 'transparent',
            color: soMarcados ? '#06101F' : C.muted,
          }}>{soMarcados ? 'vendo só os marcados' : 'ver só os marcados'}</button>
        )}
        <div style={{ flex: '1 1 150px', minWidth: 0 }}>
          <TextInput value={busca} onChange={setBusca} placeholder="Buscar prato…" />
        </div>
      </div>

      <div style={{ maxHeight: 260, overflowY: 'auto', border: `1px solid ${C.line}`, borderRadius: 10, padding: 8 }}>
        {filtrados.length === 0 ? (
          <div style={{ fontSize: 12.5, color: C.faint, padding: 8 }}>
            {itens.length === 0 ? 'Sem itens no cardápio.' : 'Nenhum prato com esse nome.'}
          </div>
        ) : filtrados.map((c) => (
          <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 4px', cursor: 'pointer', fontSize: 13.5 }}>
            <input type="checkbox" checked={marcados.includes(c.id)} onChange={() => onAlternar(c.id)}
              style={{ width: 17, height: 17, flexShrink: 0, accentColor: C.accent }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
            {jaTem(c.id) && <span style={{ fontSize: 10.5, fontWeight: 800, color: C.green, flexShrink: 0 }}>{rotuloJaTem}</span>}
          </label>
        ))}
      </div>
    </div>
  );
}
