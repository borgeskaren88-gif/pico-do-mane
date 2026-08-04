'use client';
import React, { useState, useEffect } from 'react';
import { C, Card, Btn } from './ui';

export default function AgendaCalendario() {
  const [url, setUrl] = useState('');
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/calendario/link', { cache: 'no-store' });
        const json = await res.json();
        if (json.ok && json.url) setUrl(json.url);
        else setErro('Não consegui gerar o link agora.');
      } catch {
        setErro('Não consegui gerar o link agora.');
      }
    })();
  }, []);

  const webcal = url ? url.replace(/^https?:/, 'webcal:') : '';
  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); setMsg('Link copiado!'); setTimeout(() => setMsg(''), 3000); }
    catch { setMsg('Copie manualmente o link acima.'); }
  };

  return (
    <Card style={{ marginTop: 14, marginBottom: 14, borderColor: C.accent }}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Agenda — lembretes no celular</div>
      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 14 }}>
        Assine este calendário no seu celular e os <b>boletos a vencer</b> e as <b>tarefas com data</b> aparecem na sua Agenda,
        com <b>alarme</b>, atualizando sozinhos. Assim você é avisado sem precisar abrir o PicoOS.
      </div>

      {erro && <div style={{ fontSize: 13, color: C.amber }}>{erro}</div>}

      {url && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input readOnly value={url} onFocus={(e) => e.target.select()}
              style={{ flex: 1, minWidth: 0, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 12, fontFamily: 'monospace' }} />
            <Btn small onClick={copiar}>Copiar</Btn>
          </div>
          {msg && <div style={{ fontSize: 12, color: C.green, fontWeight: 600, marginBottom: 8 }}>{msg}</div>}

          <a href={webcal} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.accent, color: '#06101F', borderRadius: 10, padding: '11px 18px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>
              Assinar no Calendário do iPhone
            </div>
          </a>

          <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', color: C.accent, fontWeight: 700, marginBottom: 8 }}>Como assinar (iPhone)</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              <li>Toque em <b>“Assinar no Calendário do iPhone”</b> acima e confirme <b>Assinar</b>. <span style={{ color: C.faint }}>(Se não abrir, copie o link e cole em Ajustes → Calendário → Contas → Adicionar conta → Outra → Adicionar calendário assinado.)</span></li>
              <li>Pronto — os boletos e tarefas aparecem no app <b>Calendário</b>, com alerta na véspera e no dia.</li>
            </ol>
            <div style={{ fontSize: 12, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
              No <b>Google Agenda</b> também dá pra assinar (Outros calendários → Do URL), mas o Google <b>não toca alarme</b> de calendário assinado — por isso, pra ser avisada, use o Calendário do iPhone.
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
