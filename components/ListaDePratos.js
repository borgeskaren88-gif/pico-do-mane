'use client';
import React from 'react';
import { C } from './ui';

// A lista de pratos com caixinha, usada pelos dois ajudantes da ficha.
//
// Em arquivo separado porque duas cópias do mesmo seletor acabam divergindo —
// uma ganha a busca, a outra não; uma mostra "já tem", a outra esquece. E aí a
// mesma tarefa parece duas telas diferentes pra quem usa.
export default function ListaDePratos({ itens = [], marcados = [], onAlternar, jaTem = () => false, rotuloJaTem = 'já tem' }) {
  return (
    <div style={{ maxHeight: 260, overflowY: 'auto', border: `1px solid ${C.line}`, borderRadius: 10, padding: 8, marginBottom: 12 }}>
      {itens.length === 0 ? (
        <div style={{ fontSize: 12.5, color: C.faint, padding: 8 }}>Sem itens no cardápio.</div>
      ) : itens.map((c) => (
        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 4px', cursor: 'pointer', fontSize: 13.5 }}>
          <input type="checkbox" checked={marcados.includes(c.id)} onChange={() => onAlternar(c.id)}
            style={{ width: 17, height: 17, flexShrink: 0, accentColor: C.accent }} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
          {jaTem(c.id) && <span style={{ fontSize: 10.5, fontWeight: 800, color: C.green, flexShrink: 0 }}>{rotuloJaTem}</span>}
        </label>
      ))}
    </div>
  );
}
