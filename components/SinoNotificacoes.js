'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { C, Card, Btn } from './ui';
import { pushSuportado, ehIOS, estaInstalado, statusPush, ativarPush, testarPush } from '../lib/pushClient';

// Cartão compacto pra ativar as notificações (usado na Cozinha). Assunto define
// o texto ("avisos de tarefas"); a lógica de push é a mesma do resto do app.
export default function SinoNotificacoes({ titulo = 'Avisos no celular', descricao = 'Receba um aviso quando tiver tarefa nova.' }) {
  const [suporta, setSuporta] = useState(true);
  const [precisaInstalar, setPrecisaInstalar] = useState(false);
  const [inscrito, setInscrito] = useState(false);
  const [permissao, setPermissao] = useState('default');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const conferir = useCallback(async () => {
    setPrecisaInstalar(ehIOS() && !estaInstalado());
    const s = await statusPush();
    setSuporta(s.suporta); setInscrito(s.inscrito); setPermissao(s.permissao);
  }, []);
  useEffect(() => { conferir(); }, [conferir]);

  const ativar = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await ativarPush('Cozinha');
      if (!r.ok) { setMsg(r.erro || 'Não consegui ativar.'); return; }
      setInscrito(true); setMsg('Ativado! ✅ Toque em "Testar" pra confirmar.');
    } catch (e) { setMsg('Não consegui ativar.'); }
    finally { setBusy(false); }
  };
  const testar = async () => {
    setBusy(true); setMsg('');
    try { const j = await testarPush(); setMsg(j.ok && j.enviados > 0 ? 'Teste enviado! Deve chegar em segundos.' : 'Ative primeiro.'); }
    catch { setMsg('Sem conexão.'); }
    finally { setBusy(false); }
  };

  if (!pushSuportado() && !precisaInstalar) return null;

  return (
    <Card style={{ marginBottom: 16, borderColor: inscrito ? C.green : C.accent, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: precisaInstalar ? 8 : 10 }}>
        <span style={{ fontSize: 18 }}>🔔</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{titulo}</div>
          <div style={{ fontSize: 12, color: C.faint }}>{descricao}</div>
        </div>
      </div>

      {precisaInstalar ? (
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
          No iPhone, primeiro instale na tela inicial: botão <b style={{ color: C.text }}>Compartilhar ↑</b> → <b style={{ color: C.text }}>“Adicionar à Tela de Início”</b>. Depois abra por esse ícone e volte aqui.
        </div>
      ) : permissao === 'denied' ? (
        <div style={{ fontSize: 13, color: C.amber, lineHeight: 1.5 }}>As notificações estão bloqueadas nas configurações do aparelho. Libere e volte aqui.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {!inscrito ? (
            <Btn small onClick={ativar} disabled={busy}>{busy ? 'Ativando…' : 'Ativar avisos'}</Btn>
          ) : (
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: C.green }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: C.green }} /> Ativado
              </span>
              <Btn small kind="ghost" onClick={testar} disabled={busy}>Testar</Btn>
            </>
          )}
        </div>
      )}
      {msg && <div style={{ marginTop: 10, fontSize: 12, color: msg.includes('Não') || msg.includes('Ative') ? C.amber : C.accent }}>{msg}</div>}
    </Card>
  );
}
