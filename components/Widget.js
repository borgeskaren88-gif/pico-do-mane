'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { C, Card, Btn, PageTitle, SecTitle, inputStyle } from './ui';

// Monta o script do Scriptable com o link já embutido, pra dona só copiar e colar.
function montarScript(url) {
  return `// PicoOS — Caixa de ontem + Fiado + Estoque
const URL = "${url}";
let r;
try {
  const req = new Request(URL + (URL.includes("?") ? "&" : "?") + "_=" + Date.now());
  req.headers = { "Cache-Control": "no-store" };
  r = await req.loadJSON();
} catch (e) { r = null; }
const w = new ListWidget();
w.backgroundColor = new Color("#0A1220");
w.setPadding(14, 14, 14, 14);
const t = w.addText("PICO DO MANÉ");
t.font = Font.mediumSystemFont(10); t.textColor = new Color("#7AA2FF");
w.addSpacer(6);
if (!r || !r.ok) {
  const e = w.addText("Sem dados agora"); e.font = Font.systemFont(12); e.textColor = new Color("#9AA7BD");
} else {
  const o = r.ontem || {};
  const cx = w.addText(o.caixaBRL || "R$ 0,00");
  cx.font = Font.boldSystemFont(22); cx.textColor = Color.white();
  const sub = w.addText("caixa de ontem");
  sub.font = Font.systemFont(9); sub.textColor = new Color("#9AA7BD");
  w.addSpacer(6);
  const aReceber = (r.aReceber && r.aReceber.totalBRL) || o.fiadoBRL || "R$ 0,00";
  const fi = w.addText("A receber (fiado): " + aReceber);
  fi.font = Font.systemFont(10); fi.textColor = new Color("#ECB24A");
  w.addSpacer(8);
  const eb = r.estoqueBaixo || { quantidade: 0, itens: [] };
  if (eb.quantidade > 0) {
    const e = w.addText("⚠️ " + eb.quantidade + " acabando");
    e.font = Font.mediumSystemFont(11); e.textColor = new Color("#F0A93B");
    const n = w.addText(eb.itens.join(", "));
    n.font = Font.systemFont(9); n.textColor = new Color("#9AA7BD"); n.lineLimit = 2;
  } else {
    const e = w.addText("estoque ok ✓"); e.font = Font.systemFont(10); e.textColor = new Color("#5BBF8A");
  }
}
w.addSpacer();
Script.setWidget(w);
w.presentSmall();
Script.complete();`;
}

export default function Widget() {
  const [url, setUrl] = useState('');
  const [dados, setDados] = useState(null);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/widget/link', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok && j.url) {
        setUrl(j.url);
        try { const rd = await fetch(j.url, { cache: 'no-store' }); const jd = await rd.json(); if (jd.ok) setDados(jd); } catch { /* ignora */ }
      } else setErro('Não consegui gerar o link.');
    } catch { setErro('Sem conexão.'); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const copiar = async (texto, oque) => {
    try { await navigator.clipboard.writeText(texto); setMsg(oque + ' copiado!'); setTimeout(() => setMsg(''), 3000); }
    catch { setMsg('Não consegui copiar. Selecione e copie manualmente abaixo.'); }
  };

  const script = url ? montarScript(url) : '';

  return (
    <div>
      <PageTitle sub="Um quadrinho na tela inicial com o caixa de ontem, o fiado e o estoque">Widget na tela inicial</PageTitle>

      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
          O iPhone não deixa um app web (como o PicoOS) criar widget sozinho. Mas com o app grátis <b style={{ color: C.text }}>Scriptable</b> dá pra ter um widget de verdade na tela inicial, puxando os seus números. É uma configuração de uma vez só — o passo a passo está aqui embaixo.
        </div>
      </Card>

      {/* Prévia de como vai ficar (com os dados de agora). */}
      {dados && dados.ok && (
        <Card style={{ marginBottom: 14 }}>
          <SecTitle>Prévia (dados de agora)</SecTitle>
          <div style={{ marginTop: 8, background: '#0A1220', borderRadius: 16, padding: 16, maxWidth: 200 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7AA2FF', letterSpacing: '.08em' }}>PICO DO MANÉ</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginTop: 6, lineHeight: 1 }}>{dados.ontem?.caixaBRL || 'R$ 0,00'}</div>
            <div style={{ fontSize: 10, color: '#9AA7BD' }}>caixa de ontem</div>
            <div style={{ fontSize: 10, color: '#ECB24A', marginTop: 4 }}>A receber (fiado): {dados.aReceber?.totalBRL || dados.ontem?.fiadoBRL || 'R$ 0,00'}</div>
            <div style={{ marginTop: 10 }}>
              {dados.estoqueBaixo.quantidade > 0 ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#F0A93B' }}>⚠️ {dados.estoqueBaixo.quantidade} acabando</div>
                  <div style={{ fontSize: 9, color: '#9AA7BD' }}>{dados.estoqueBaixo.itens.join(', ')}</div>
                </>
              ) : <div style={{ fontSize: 10, color: '#5BBF8A' }}>estoque ok ✓</div>}
            </div>
          </div>
        </Card>
      )}

      {erro && <div style={{ fontSize: 13, color: C.amber, marginBottom: 12 }}>{erro}</div>}

      {/* Passo a passo. */}
      <Card style={{ marginBottom: 14, borderColor: C.accent }}>
        <SecTitle>Como colocar na tela inicial</SecTitle>
        <ol style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 14, color: C.muted, lineHeight: 1.7 }}>
          <li>Baixe o app grátis <b style={{ color: C.text }}>Scriptable</b> na App Store</li>
          <li>Abra o Scriptable → toque em <b style={{ color: C.text }}>➕</b> (novo script)</li>
          <li>Toque em <b style={{ color: C.text }}>“Copiar o script”</b> aqui embaixo e <b>cole</b> lá dentro</li>
          <li>Dê um nome (ex.: <b style={{ color: C.text }}>PicoOS</b>) e toque em <b style={{ color: C.text }}>Concluir</b></li>
          <li>Vá pra tela inicial → segure num espaço vazio → <b style={{ color: C.text }}>➕</b> no canto → procure <b style={{ color: C.text }}>Scriptable</b> → escolha o widget <b>pequeno</b> → Adicionar</li>
          <li>Segure no widget → <b style={{ color: C.text }}>Editar Widget</b> → em “Script” escolha <b style={{ color: C.text }}>PicoOS</b></li>
        </ol>
        <div style={{ fontSize: 12, color: C.faint, marginTop: 10 }}>Pronto! Ele atualiza sozinho ao longo do dia.</div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <SecTitle>O script</SecTitle>
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Btn onClick={() => copiar(script, 'Script')} disabled={!script}>Copiar o script</Btn>
          <Btn kind="ghost" onClick={() => copiar(url, 'Link')} disabled={!url}>Copiar só o link</Btn>
        </div>
        {msg && <div style={{ marginTop: 10, fontSize: 13, color: C.accent }}>{msg}</div>}
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: C.muted, fontWeight: 600 }}>Ver o script</summary>
          <textarea readOnly value={script} style={{ ...inputStyle, marginTop: 10, height: 200, fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre' }} />
        </details>
        <div style={{ fontSize: 12, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>Esse link é <b>só seu</b> e mostra apenas leitura (faturamento e estoque). Não compartilhe — quem tiver o link vê esses números.</div>
      </Card>
    </div>
  );
}
