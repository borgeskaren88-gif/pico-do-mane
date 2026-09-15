'use client';
import React from 'react';
import { C, inputStyle } from './ui';

// Os campos do cartão "confirma?" — o que o Darci entendeu, aberto pra ela
// corrigir antes de gravar.
//
// Isto vivia copiado nos dois Darcis (a tela cheia e o balão). Com a IA
// entendendo ordem nova, o cartão cresceu, e manter duas cópias iguais era
// pedir pra elas se separarem. Agora é um lugar só.
//
// A regra que não muda: NADA é gravado sem ela apertar confirmar. A IA erra, e
// esse cartão existe justamente pra o erro morrer aqui, na frente dela.
const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const txt = (v) => String(v || '').trim();

export function podeGravarPedido(pedido, edit = {}) {
  if (!pedido) return false;
  const valor = Number(String(edit.valor ?? '').toString().replace(',', '.'));
  switch (pedido.tipo) {
    case 'despesa':
    case 'receita': return valor > 0 && txt(edit.descricao).length > 1;
    case 'compra': return valor > 0 && (txt(edit.fornecedor).length > 1 || txt(edit.produto).length > 1);
    case 'tarefa': return txt(edit.texto).length > 1;
    case 'agenda': return txt(edit.titulo).length > 2 && ehData(edit.data);
    case 'perda': return Number(edit.qtd) > 0;
    default: return false;
  }
}

export default function CamposPedido({ pedido, edit, setEdit, compacto = false }) {
  if (!pedido) return null;
  const mudar = (campo) => (e) => setEdit((m) => ({ ...m, [campo]: e.target.value }));
  const mudarNum = (campo) => (e) => setEdit((m) => ({ ...m, [campo]: e.target.value.replace(',', '.') }));
  const t = pedido.tipo;
  // O balão flutuante é apertado; a tela cheia tem espaço. Mesmos campos, só
  // que menores lá.
  const est = compacto ? { ...inputStyle, padding: '9px 10px', fontSize: 13 } : inputStyle;
  const g = compacto ? 7 : 8;
  const fim = compacto ? 0 : 12;
  const dica = { fontSize: compacto ? 11.5 : 12, color: C.faint, marginBottom: fim };

  if (t === 'despesa' || t === 'receita') {
    return (
      <>
        <div style={{ display: 'flex', gap: g, marginBottom: g }}>
          <input value={edit.valor ?? ''} onChange={mudarNum('valor')} inputMode="decimal" placeholder="Valor" style={{ ...est, width: compacto ? 92 : 110 }} />
          <input value={edit.descricao ?? ''} onChange={mudar('descricao')} placeholder="Do que foi?"
            autoFocus={!txt(pedido.dados.descricao)} style={{ ...est, flex: 1, minWidth: 0 }} />
        </div>
        <div style={dica}>
          {t === 'despesa' ? `Categoria: ${edit.categoria || 'A classificar'} · hoje` : 'Entra como receita de hoje.'}
        </div>
      </>
    );
  }

  // Conta a pagar: o que mais dá trabalho de digitar no dia a dia dela.
  if (t === 'compra') {
    return (
      <>
        <div style={{ display: 'flex', gap: g, marginBottom: g }}>
          <input value={edit.valor ?? ''} onChange={mudarNum('valor')} inputMode="decimal" placeholder="Valor" style={{ ...est, width: compacto ? 92 : 110 }} />
          <input value={edit.fornecedor ?? ''} onChange={mudar('fornecedor')} placeholder="De quem?" style={{ ...est, flex: 1, minWidth: 0 }} />
        </div>
        <div style={{ display: 'flex', gap: g, marginBottom: g }}>
          <input value={edit.produto ?? ''} onChange={mudar('produto')} placeholder="O que é?" style={{ ...est, flex: 1, minWidth: 0 }} />
          <input type="date" value={edit.vencimento ?? ''} onChange={mudar('vencimento')} style={{ ...est, width: compacto ? 130 : 150 }} />
        </div>
        <div style={dica}>
          {edit.vencimento ? 'Entra em Contas a pagar, ainda não paga.' : 'Sem vencimento ela não entra nos avisos — se souber a data, põe aí.'}
        </div>
      </>
    );
  }

  if (t === 'tarefa') {
    return <input value={edit.texto ?? ''} onChange={mudar('texto')} style={{ ...est, width: '100%', marginBottom: fim }} />;
  }

  if (t === 'agenda') {
    return (
      <>
        <input value={edit.titulo ?? ''} onChange={mudar('titulo')} placeholder="O que é?" style={{ ...est, width: '100%', marginBottom: g }} />
        <div style={{ display: 'flex', gap: g, marginBottom: fim }}>
          <input type="date" value={edit.data ?? ''} onChange={mudar('data')} style={{ ...est, flex: 1, minWidth: 0 }} />
          <input type="time" value={edit.hora ?? ''} onChange={(e) => setEdit((m) => ({ ...m, hora: e.target.value, diaTodo: !e.target.value }))} style={{ ...est, width: compacto ? 110 : 130 }} />
        </div>
      </>
    );
  }

  if (t === 'perda') {
    return (
      <div style={{ display: 'flex', gap: g, alignItems: 'center', marginBottom: fim }}>
        <input value={edit.qtd ?? ''} onChange={mudarNum('qtd')} inputMode="decimal" style={{ ...est, width: compacto ? 92 : 110 }} />
        <span style={{ fontSize: compacto ? 13 : 14, color: C.text }}>{edit.unidade} de <b>{edit.nome}</b> · {String(edit.motivo || '').toLowerCase()}</span>
      </div>
    );
  }
  return null;
}
