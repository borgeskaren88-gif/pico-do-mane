'use client';
import React, { useState } from 'react';
import { C, Card, Btn } from './ui';

// OS LOGINS DA EQUIPE, NOS BARES NOVOS — até 5, cada um com nome e senha.
//
// A dona cria a PESSOA ("Bia"), escolhe o que ela faz (Atendimento, Cozinha
// ou Gerência) e passa a senha. Na tela de entrar, a pessoa escolhe "Equipe"
// e escreve o nome dela. Nome, tipo e senha se editam aqui a qualquer hora.

const O_QUE_VE = {
  garcom: 'Comandas, mesas, caixa e cardápio. Não vê o financeiro do bar.',
  cozinha: 'Pedidos, lista de compras, porções, fichas e ponto. Não vê dinheiro.',
  gerente: 'Tudo do Atendimento e da Cozinha, a meta em porcentagem e o fiado. Não vê lucro, despesas nem salários.',
};

const campo = { background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 9, padding: '10px 12px', fontSize: 15, width: '100%', boxSizing: 'border-box' };

function Formulario({ inicial, tipos, onSalvar, onCancelar, ocupado, novo }) {
  const [nome, setNome] = useState(inicial.nome || '');
  const [tipo, setTipo] = useState(inicial.tipo || 'garcom');
  const [senha, setSenha] = useState('');
  return (
    <div data-form-login style={{ marginTop: novo ? 0 : 12 }}>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, marginBottom: 5 }}>Nome da pessoa</div>
      <input data-login-nome value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Bia" autoComplete="off" style={campo} />
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, margin: '12px 0 5px' }}>O que ela faz</div>
      <select data-login-tipo value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ ...campo, fontWeight: 700 }}>
        {Object.entries(tipos).map(([v, rot]) => <option key={v} value={v}>{rot}</option>)}
      </select>
      <div style={{ fontSize: 12, color: C.faint, marginTop: 5, lineHeight: 1.45 }}>{O_QUE_VE[tipo]}</div>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, margin: '12px 0 5px' }}>{novo ? 'Senha (pelo menos 4)' : 'Senha nova (deixa em branco pra não trocar)'}</div>
      <input data-login-senha type="text" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder={novo ? 'a senha que tu vais passar pra ela' : '••••'} autoComplete="off" style={campo} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Btn small disabled={ocupado} onClick={() => onSalvar({ nome, tipo, senha })}>{ocupado ? 'Salvando…' : novo ? 'Criar login' : 'Salvar'}</Btn>
        <Btn small kind="ghost" onClick={onCancelar}>Cancelar</Btn>
      </div>
    </div>
  );
}

export default function LoginsEquipe({ logins, max, tipos, onMudou }) {
  const [editando, setEditando] = useState('');
  const [criando, setCriando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState({ texto: '', ok: true });

  const mandar = async (corpo, recado) => {
    setOcupado(true); setMsg({ texto: '', ok: true });
    try {
      const r = await fetch('/api/acessos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setMsg({ texto: j.erro || 'Não deu certo.', ok: false }); return false; }
      setMsg({ texto: recado, ok: true }); setEditando(''); setCriando(false);
      await onMudou();
      return true;
    } catch { setMsg({ texto: 'Sem conexão. Tenta de novo.', ok: false }); return false; } finally { setOcupado(false); }
  };

  return (
    <div data-logins-equipe>
      <Card style={{ marginBottom: 14, padding: 14 }}>
        <div style={{ fontSize: 15.5, fontWeight: 900 }}>Logins da equipe ({logins.length} de {max})</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55, marginTop: 4 }}>
          Cria um login pra cada pessoa: nome, senha e o que ela faz. Pra entrar, a pessoa põe o <b style={{ color: C.text }}>código do bar</b>,
          escolhe <b style={{ color: C.text }}>Equipe</b> e escreve o <b style={{ color: C.text }}>nome</b> e a senha dela.
        </div>
      </Card>

      {msg.texto && (
        <div style={{ background: C.panel2, border: `1px solid ${msg.ok ? C.green : C.amber}`, borderRadius: 10, padding: '10px 13px', marginBottom: 12, fontSize: 13, fontWeight: 700, color: msg.ok ? C.green : C.amber, lineHeight: 1.5 }}>{msg.texto}</div>
      )}

      {logins.map((l) => (
        <Card key={l.id} data-login={l.nome} style={{ marginBottom: 10, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 15.5, fontWeight: 900 }}>{l.nome}</div>
              <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>{l.tipoNome}</div>
            </div>
            {editando !== l.id && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn small kind="ghost" onClick={() => { setEditando(l.id); setCriando(false); setMsg({ texto: '', ok: true }); }}>Editar</Btn>
                <Btn small kind="danger" disabled={ocupado} onClick={() => {
                  if (typeof window !== 'undefined' && !window.confirm(`Apagar o login de ${l.nome}?\n\nA pessoa não entra mais, e quem estiver logado como ${l.tipoNome} cai e entra de novo com a própria senha. O ponto e as comandas dela ficam guardados.`)) return;
                  mandar({ acao: 'apagarLogin', id: l.id }, `Pronto: o login de ${l.nome} foi apagado.`);
                }}>Apagar</Btn>
              </div>
            )}
          </div>
          {editando === l.id && (
            <Formulario inicial={l} tipos={tipos} ocupado={ocupado}
              onCancelar={() => setEditando('')}
              onSalvar={(f) => mandar({ acao: 'editarLogin', id: l.id, ...f }, f.senha ? `Pronto: ${f.nome || l.nome} atualizado. Com a senha nova, quem estava logado como ${tipos[f.tipo] || l.tipoNome} precisa entrar de novo.` : `Pronto: ${f.nome || l.nome} atualizado.`)} />
          )}
        </Card>
      ))}

      {criando ? (
        <Card style={{ marginBottom: 10, padding: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10 }}>Novo login</div>
          <Formulario novo inicial={{}} tipos={tipos} ocupado={ocupado} onCancelar={() => setCriando(false)}
            onSalvar={(f) => mandar({ acao: 'criarLogin', ...f }, `Pronto: login de ${String(f.nome).trim()} criado. Passa pra pessoa o código do bar, o nome e a senha.`)} />
        </Card>
      ) : logins.length < max ? (
        <Btn onClick={() => { setCriando(true); setEditando(''); setMsg({ texto: '', ok: true }); }}>+ Criar login</Btn>
      ) : (
        <div style={{ fontSize: 13, color: C.faint }}>Chegaste ao limite de {max} logins. Pra criar outro, apaga um.</div>
      )}
    </div>
  );
}
