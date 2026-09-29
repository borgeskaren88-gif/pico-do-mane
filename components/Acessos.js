'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { C, Card, Btn, Empty, PageTitle } from './ui';

// QUEM ENTRA NO PICOOS — e como tirar alguém daqui.
//
// "Preciso deixar o login da cozinha existente, porém demiti a pessoa que
// estava na cozinha. Como faço pra bloquear o acesso dela?"
//
// A resposta, antes disto, era: não tinha como. Trocar a senha não adiantava —
// quem já estava logado continuava logado pra sempre, porque o crachá não
// vencia nunca. O único jeito era trocar o segredo do app inteiro na Vercel, o
// que derruba todo mundo junto e ainda quebra o link do calendário e do widget.
//
// Esta tela resolve o caso certo: corta UM acesso, agora, sem tocar em mais
// nada. O login da cozinha continua existindo pra quem vier depois.

const RECADOS = {
  cozinha: 'Quem entra por aqui vê a lista de compras, as tarefas, as porções e bate o ponto. Não vê dinheiro.',
  garcom: 'Quem entra por aqui abre e fecha comanda e vê o cardápio. Não vê o financeiro do bar.',
  reservas: 'Quem entra por aqui vê e marca as reservas de mesa. Não vê mais nada.',
};

export default function Acessos() {
  const [lista, setLista] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [trocando, setTrocando] = useState('');   // papel com o campo de senha aberto
  const [nova, setNova] = useState('');

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/acessos', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) setLista(Array.isArray(j.acessos) ? j.acessos : []);
    } catch { /* offline */ }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const mandar = async (corpo, recado) => {
    setBusy(corpo.papel); setMsg('');
    try {
      const r = await fetch('/api/acessos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const j = await r.json();
      if (j.ok) { setMsg(recado); setTrocando(''); setNova(''); await carregar(); }
      else setMsg(j.erro || 'Não consegui fazer isso.');
    } catch { setMsg('Sem conexão. Tenta de novo.'); }
    finally { setBusy(''); }
  };

  const desconectar = (a) => {
    if (typeof window !== 'undefined' && !window.confirm(
      `Desconectar todos os aparelhos do acesso "${a.nome}"?\n\nQuem estiver usando vai cair na tela de senha e só volta com a senha atual. O acesso continua existindo.`
    )) return;
    mandar({ acao: 'desconectar', papel: a.papel }, `Pronto: todos os aparelhos de ${a.nome} foram desconectados agora.`);
  };

  const salvarSenha = (a) => {
    if (nova.trim().length < 4) { setMsg('A senha precisa ter pelo menos 4 caracteres.'); return; }
    mandar({ acao: 'senha', papel: a.papel, nova: nova.trim() },
      `Senha de ${a.nome} trocada — e todos os aparelhos que estavam logados foram desconectados junto.`);
  };

  if (!carregado) return <Empty>Carregando…</Empty>;

  return (
    <div>
      <PageTitle sub="Quem entra no PicoOS, e como tirar alguém daqui">Acessos da equipe</PageTitle>

      <Card style={{ marginBottom: 14, padding: 14 }}>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
          Quando alguém sai do bar, <b style={{ color: C.text }}>trocar a senha não basta</b>: o celular de quem já
          estava logado continua entrando. Por isso tem os dois botões aqui — e trocar a senha já desconecta todo mundo
          junto, que quase sempre é o que tu queres.
          <br /><br />
          O teu acesso de dona não aparece aqui: ele não se corta por esta tela, senão a chave ficaria trancada do lado
          de dentro.
        </div>
      </Card>

      {msg && (
        <div style={{ background: C.panel2, border: `1px solid ${msg.startsWith('Pronto') || msg.includes('trocada') ? C.green : C.amber}`, borderRadius: 10, padding: '10px 13px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: msg.startsWith('Pronto') || msg.includes('trocada') ? C.green : C.amber, lineHeight: 1.5 }}>{msg}</span>
          <button onClick={() => setMsg('')} aria-label="Fechar" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
        </div>
      )}

      {lista.map((a) => (
        <Card key={a.papel} style={{ marginBottom: 10, padding: 14 }}>
          <div style={{ fontSize: 15.5, fontWeight: 900 }}>{a.nome}</div>
          <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.5, marginTop: 2 }}>{RECADOS[a.papel] || ''}</div>

          {/* "1234" é a senha de fábrica, e é o tipo de coisa que fica anos no
              ar sem ninguém lembrar. Se nunca foi trocada, a tela diz. */}
          {!a.senhaPropria && (
            <div style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginTop: 8, lineHeight: 1.45 }}>
              Ainda está com a senha de fábrica. Vale trocar.
            </div>
          )}

          {trocando === a.papel ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 6, lineHeight: 1.45 }}>
                Senha nova de {a.nome} (pelo menos 4 caracteres). Quem estiver logado agora será desconectado.
              </div>
              <input
                type="text" value={nova} onChange={(e) => setNova(e.target.value)} placeholder="senha nova"
                autoComplete="off"
                style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 9, padding: '10px 12px', fontSize: 15, width: '100%', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Btn small onClick={() => salvarSenha(a)} disabled={busy === a.papel}>{busy === a.papel ? 'Salvando…' : 'Salvar e desconectar'}</Btn>
                <Btn small kind="ghost" onClick={() => { setTrocando(''); setNova(''); }}>Cancelar</Btn>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Btn small onClick={() => { setTrocando(a.papel); setNova(''); setMsg(''); }}>Trocar a senha</Btn>
              <Btn small kind="ghost" onClick={() => desconectar(a)} disabled={busy === a.papel}>
                {busy === a.papel ? 'Desconectando…' : 'Só desconectar os aparelhos'}
              </Btn>
            </div>
          )}
        </Card>
      ))}

      <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.55, marginTop: 6 }}>
        Desconectar não apaga nada: nem o ponto batido, nem a lista, nem as comandas. Só tira os aparelhos de dentro.
        O link do calendário e o do widget continuam funcionando igual.
      </div>
    </div>
  );
}
