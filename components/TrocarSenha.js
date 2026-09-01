'use client';
import React, { useState } from 'react';
import { C, Card, Btn, Field, SecTitle, inputStyle } from './ui';

// Trocar a senha da Karen, dentro do app. Pede a senha atual + a nova (2×) e
// grava no servidor. A partir daí, o login e a trava usam a senha nova.
export default function TrocarSenha() {
  const [aberto, setAberto] = useState(false);
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [nova2, setNova2] = useState('');
  const [ver, setVer] = useState(false);
  const [msg, setMsg] = useState(null); // { tipo:'ok'|'erro', texto }
  const [busy, setBusy] = useState(false);

  const limpar = () => { setAtual(''); setNova(''); setNova2(''); };

  const salvar = async (e) => {
    e.preventDefault();
    if (busy) return;
    setMsg(null);
    if (nova.trim().length < 4) { setMsg({ tipo: 'erro', texto: 'A nova senha precisa ter pelo menos 4 caracteres.' }); return; }
    if (nova !== nova2) { setMsg({ tipo: 'erro', texto: 'A confirmação não bate com a nova senha.' }); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/senha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ atual, nova }) });
      const j = await r.json();
      if (j.ok) { setMsg({ tipo: 'ok', texto: 'Senha alterada! Use a nova senha no próximo login.' }); limpar(); setAberto(false); }
      else setMsg({ tipo: 'erro', texto: j.erro || 'Não consegui trocar a senha.' });
    } catch { setMsg({ tipo: 'erro', texto: 'Sem conexão. Tente de novo.' }); }
    finally { setBusy(false); }
  };

  const campo = (val, set, ph) => (
    <input type={ver ? 'text' : 'password'} value={val} onChange={(e) => set(e.target.value)} placeholder={ph}
      autoCapitalize="none" autoCorrect="off" spellCheck="false" autoComplete="off" style={inputStyle} />
  );

  return (
    <div style={{ marginTop: 22 }}>
      <SecTitle>Segurança</SecTitle>
      <Card>
        {!aberto ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Senha de acesso</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Trocar a senha da Karen (login e desbloqueio).</div>
            </div>
            <Btn small onClick={() => { setMsg(null); setAberto(true); }}>Trocar senha</Btn>
          </div>
        ) : (
          <form onSubmit={salvar}>
            <Field label="Senha atual">{campo(atual, setAtual, 'senha de agora')}</Field>
            <Field label="Nova senha">{campo(nova, setNova, 'nova senha')}</Field>
            <Field label="Confirmar nova senha">{campo(nova2, setNova2, 'repita a nova senha')}</Field>
            <button type="button" onClick={() => setVer((v) => !v)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0, marginBottom: 12 }}>
              {ver ? 'ocultar senhas' : 'ver senhas'}
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn type="submit" small onClick={() => {}} >{busy ? 'Salvando…' : 'Salvar nova senha'}</Btn>
              <Btn kind="ghost" small onClick={() => { setAberto(false); limpar(); setMsg(null); }}>Cancelar</Btn>
            </div>
          </form>
        )}
        {msg && (
          <div style={{ fontSize: 13, marginTop: 12, fontWeight: 600, color: msg.tipo === 'ok' ? C.green : C.red }}>{msg.texto}</div>
        )}
      </Card>
    </div>
  );
}
