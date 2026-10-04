'use client';
import React, { useState, useEffect } from 'react';
import { C, Field, TextInput } from './ui';

// QUEM PEGOU.
//
// "Quero que o atendimento possa pôr consumo da casa também, eu só quero poder
// saber quem pegou o que."
//
// Lançar consumo da casa o atendimento já podia. O que faltava era o nome — e
// um campo de texto vazio às duas da manhã, com o bar cheio, é um campo que
// volta em branco. Então a primeira coisa que aparece são as pessoas que estão
// com o TURNO ABERTO agora: um toque, e é quase sempre uma delas, porque quem
// pega consumo da casa é quem está trabalhando.
//
// Digitar continua existindo, pra o dia em que foi alguém de fora da lista. O
// que não existe é sair daqui sem dizer: o servidor recusa consumo da casa sem
// nome, e a trava mora lá porque tela velha guardada no aparelho continua
// mandando pedido.
//
// A privacidade do ponto vale aqui também: o atendimento enxerga os nomes do
// atendimento, a dona enxerga todo mundo. É a mesma regra da tela de ponto,
// vinda do mesmo lugar — não é uma segunda regra pra manter de pé.
export default function QuemPegou({ valor, onChange, titulo = 'Quem pegou?', aviso = '' }) {
  const [nomes, setNomes] = useState([]);
  const [digitando, setDigitando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch('/api/ponto', { cache: 'no-store' });
        const j = await r.json();
        if (!vivo || !j.ok) return;
        // Turno aberto = sem saída. Quem está no bar agora.
        const abertos = (j.registros || []).filter((x) => x && !x.saida && x.nome).map((x) => x.nome);
        setNomes([...new Set(abertos)]);
      } catch { /* sem rede: o campo de digitar resolve */ }
    })();
    return () => { vivo = false; };
  }, []);

  const escolher = (n) => { onChange(valor === n ? '' : n); setDigitando(false); };

  return (
    <Field label={titulo + (aviso ? ` ${aviso}` : '')}>
      {nomes.length > 0 && !digitando && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {nomes.map((n) => {
            const on = valor === n;
            return (
              <button key={n} onClick={() => escolher(n)} style={{
                border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accent : 'transparent',
                color: on ? '#06101F' : C.muted, borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>{n}</button>
            );
          })}
          <button onClick={() => { setDigitando(true); onChange(''); }} style={{
            border: `1px dashed ${C.line}`, background: 'transparent', color: C.faint,
            borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>outro…</button>
        </div>
      )}
      {(digitando || nomes.length === 0) && (
        <TextInput value={valor} onChange={onChange} placeholder="Nome de quem pegou" />
      )}
      {nomes.length === 0 && (
        <div style={{ fontSize: 11.5, color: C.faint, marginTop: 6, lineHeight: 1.4 }}>
          Ninguém com o ponto aberto agora — por isso não tem lista pra tocar. Quando a equipe bate o ponto, os nomes aparecem aqui sozinhos.
        </div>
      )}
    </Field>
  );
}
