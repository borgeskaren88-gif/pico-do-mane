'use client';
import React, { useState, useEffect } from 'react';
import { C, Card, Btn } from './ui';

export default function AgendaCalendario() {
  // Integração automática (OAuth) com o Google Agenda.
  const [gs, setGs] = useState(null);
  const [sMsg, setSMsg] = useState('');
  const [sincronizando, setSincronizando] = useState(false);

  // Assinatura .ics (alternativa).
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');

  const carregarStatus = async () => {
    try { const r = await fetch('/api/google/status', { cache: 'no-store' }); const j = await r.json(); if (j.ok) setGs(j); } catch { /* ignora */ }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('google');
      if (p === 'ok') setSMsg('Google Agenda conectado! Seus boletos e tarefas já foram enviados.');
      else if (p === 'erro') { const m = params.get('motivo'); setSMsg('Não consegui conectar ao Google. Tente de novo.' + (m ? ` (Detalhe: ${decodeURIComponent(m)})` : '')); }
      else if (p === 'naoconfig') setSMsg('A integração ainda não está configurada no app (faltam as credenciais do Google).');
      if (p) window.history.replaceState({}, '', window.location.pathname);
    }
    carregarStatus();
    (async () => {
      try { const res = await fetch('/api/calendario/link', { cache: 'no-store' }); const json = await res.json(); if (json.ok && json.url) setUrl(json.url); } catch { /* ignora */ }
    })();
  }, []);

  const sincronizar = async () => {
    setSincronizando(true); setSMsg('');
    try {
      const r = await fetch('/api/google/sync', { method: 'POST' }); const j = await r.json();
      if (j.ok) setSMsg(`Sincronizado: ${j.criados} novo(s), ${j.atualizados} atualizado(s), ${j.removidos} removido(s).`);
      else setSMsg('Erro ao sincronizar: ' + (j.erro || ''));
    } catch { setSMsg('Erro ao sincronizar.'); }
    setSincronizando(false);
  };

  const desconectar = async () => {
    if (typeof window !== 'undefined' && !window.confirm('Desconectar o Google Agenda? Os eventos já criados continuam lá.')) return;
    try { await fetch('/api/google/disconnect', { method: 'POST' }); setSMsg('Google desconectado.'); carregarStatus(); } catch { /* ignora */ }
  };

  const webcal = url ? url.replace(/^https?:/, 'webcal:') : '';
  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); setMsg('Link copiado!'); setTimeout(() => setMsg(''), 3000); }
    catch { setMsg('Copie manualmente o link acima.'); }
  };

  return (
    <>
      <Card style={{ marginTop: 14, marginBottom: 14, borderColor: C.accent }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Google Agenda (automático)</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 14 }}>
          Conecte sua conta e os <b>boletos a vencer</b> e as <b>tarefas com data</b> entram direto no seu Google Agenda,
          <b> na hora</b> — e atualizam sozinhos quando você lança, edita ou paga.
        </div>

        {gs === null && <div style={{ fontSize: 13, color: C.faint }}>Verificando…</div>}

        {gs && gs.configurado === false && (
          <div style={{ fontSize: 13, color: C.muted, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
            A conexão ainda não está ativada no app (faltam as credenciais do Google nas configurações). Assim que forem adicionadas, o botão de <b>conectar</b> aparece aqui.
          </div>
        )}

        {gs && gs.configurado && !gs.conectado && (
          <a href="/api/google/auth" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.accent, color: '#06101F', borderRadius: 10, padding: '11px 18px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Conectar meu Google Agenda
            </div>
          </a>
        )}

        {gs && gs.conectado && (
          <div>
            <div style={{ fontSize: 14, color: C.green, fontWeight: 700, marginBottom: 12 }}>
              Conectado{gs.email ? ` como ${gs.email}` : ''}.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn small onClick={sincronizar}>{sincronizando ? 'Sincronizando…' : 'Sincronizar agora'}</Btn>
              <Btn kind="ghost" small onClick={desconectar}>Desconectar</Btn>
            </div>
          </div>
        )}

        {sMsg && <div style={{ marginTop: 12, fontSize: 13, color: sMsg.startsWith('Erro') || sMsg.startsWith('Não') ? C.amber : C.accent, fontWeight: 600 }}>{sMsg}</div>}

        {gs && gs.configurado && gs.diag && !gs.conectado && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: C.faint, fontWeight: 600 }}>Diagnóstico (abrir se der erro ao conectar)</summary>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, marginTop: 8, fontFamily: 'monospace' }}>
              <div>Chave secreta começa com “GOCSPX-”: <b style={{ color: gs.diag.segStarts ? C.green : C.red }}>{gs.diag.segStarts ? 'sim' : 'NÃO'}</b></div>
              <div>Chave secreta: <b>{gs.diag.segLen}</b> caracteres{gs.diag.segEspaco ? <b style={{ color: C.red }}> · TEM ESPAÇO/QUEBRA</b> : ''}</div>
              <div>Client ID termina certo: <b style={{ color: gs.diag.idEnds ? C.green : C.red }}>{gs.diag.idEnds ? 'sim' : 'NÃO'}</b> · <b>{gs.diag.idLen}</b> caracteres{gs.diag.idEspaco ? <b style={{ color: C.red }}> · TEM ESPAÇO</b> : ''}</div>
            </div>
          </details>
        )}
      </Card>

      <details style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, color: C.muted }}>Outra opção: assinar o calendário (sem conectar conta)</summary>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 12 }}>
            Assinar uma URL de calendário. Funciona sem conectar conta, mas <b>atualiza com atraso</b> (o Google puxa no ritmo dele) e o Google não toca alarme. Melhor pelo <b>Calendário do iPhone</b>.
          </div>
          {url && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input readOnly value={url} onFocus={(e) => e.target.select()}
                  style={{ flex: 1, minWidth: 0, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 12, fontFamily: 'monospace' }} />
                <Btn small onClick={copiar}>Copiar</Btn>
              </div>
              {msg && <div style={{ fontSize: 12, color: C.green, fontWeight: 600, marginBottom: 8 }}>{msg}</div>}
              <a href={webcal} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: C.accent, border: `1px solid ${C.line}`, borderRadius: 10, padding: '9px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  Assinar no Calendário do iPhone
                </div>
              </a>
            </>
          )}
        </div>
      </details>
    </>
  );
}
