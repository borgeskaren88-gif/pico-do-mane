'use client';
import React, { useState } from 'react';
import { C, Card, Btn } from './ui';

// O PACOTE PARA O ANALISTA — o botão que junta tudo e entrega um Excel.
//
// "Ele precisa de muitas informações que tem no PicoOS, porém não achei uma boa
// forma de mandar essas coisas pra ele."
//
// Um toque, uma planilha, uma aba por assunto. No celular, "Compartilhar" abre
// a folha do aparelho (WhatsApp, e-mail) JÁ COM O ARQUIVO; no computador, baixa.

const PERIODOS = [['4', 'Últimos 4 meses'], ['12', 'Últimos 12 meses'], ['0', 'Tudo que existe']];

export default function PacoteAnalista() {
  const [meses, setMeses] = useState('4');
  const [telefones, setTelefones] = useState(false);
  const [nomes, setNomes] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({ texto: '', ok: true });

  const url = () => `/api/analista?meses=${meses}&telefones=${telefones ? 1 : 0}&nomes=${nomes ? 1 : 0}`;

  const pegar = async () => {
    const r = await fetch(url(), { cache: 'no-store' });
    if (!r.ok) {
      let erro = 'Não consegui montar o pacote.';
      try { const j = await r.json(); if (j && j.erro) erro = j.erro; } catch { /* ignora */ }
      throw new Error(erro);
    }
    const disp = r.headers.get('content-disposition') || '';
    const nome = (/filename="([^"]+)"/.exec(disp) || [])[1] || 'picoos-pacote-analista.xlsx';
    return { blob: await r.blob(), nome };
  };

  const baixar = async () => {
    setBusy('baixar'); setMsg({ texto: '', ok: true });
    try {
      const { blob, nome } = await pegar();
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
      setMsg({ texto: 'Pronto: a planilha foi baixada. Abre a aba "Leia-me" primeiro.', ok: true });
    } catch (e) { setMsg({ texto: e.message || 'Não deu certo.', ok: false }); } finally { setBusy(''); }
  };

  const compartilhar = async () => {
    setBusy('compartilhar'); setMsg({ texto: '', ok: true });
    try {
      const { blob, nome } = await pegar();
      const arquivo = new File([blob], nome, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: 'Pacote PicoOS', text: 'Planilha com os dados do negócio (abre a aba "Leia-me" primeiro).' });
        setMsg({ texto: 'Pronto: escolhe pra quem mandar.', ok: true });
      } else {
        const u = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(u), 4000);
        setMsg({ texto: 'Este aparelho não compartilha arquivo direto: a planilha foi baixada. Manda por e-mail ou WhatsApp.', ok: true });
      }
    } catch (e) {
      if (e && e.name === 'AbortError') setMsg({ texto: '', ok: true });
      else setMsg({ texto: e.message || 'Não deu certo.', ok: false });
    } finally { setBusy(''); }
  };

  const linha = { display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13.5, color: C.muted, lineHeight: 1.5, cursor: 'pointer', marginTop: 8 };
  return (
    <Card data-pacote-analista style={{ marginBottom: 14, borderColor: C.accent }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.accent, fontWeight: 700, marginBottom: 6 }}>Pacote para o analista</div>
      <div style={{ fontSize: 14, color: C.text, lineHeight: 1.55 }}>
        Uma planilha de Excel com vendas, caixa, despesas, contas, cardápio, fichas técnicas e fornecedores — uma aba por assunto, com os mesmos números das telas.
        A primeira aba explica tudo; a segunda lista o que o PicoOS <b>não</b> tem, pra tu responderes.
      </div>

      <div style={{ marginTop: 12, fontSize: 12.5, color: C.muted, fontWeight: 700 }}>Período</div>
      <select data-pacote-periodo value={meses} onChange={(e) => setMeses(e.target.value)}
        style={{ marginTop: 5, background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 9, padding: '10px 12px', fontSize: 14.5, fontWeight: 700, width: '100%', maxWidth: 280 }}>
        {PERIODOS.map(([v, rot]) => <option key={v} value={v}>{rot}</option>)}
      </select>

      <label style={linha}>
        <input data-pacote-nomes type="checkbox" checked={nomes} onChange={(e) => setNomes(e.target.checked)} style={{ marginTop: 3, width: 17, height: 17, flexShrink: 0 }} />
        <span>Incluir o <b style={{ color: C.text }}>nome</b> dos clientes (fiado e cadastro). Desmarcando, o fiado vira &quot;Cliente 1, 2…&quot;.</span>
      </label>
      <label style={linha}>
        <input data-pacote-telefones type="checkbox" checked={telefones} onChange={(e) => setTelefones(e.target.checked)} disabled={!nomes} style={{ marginTop: 3, width: 17, height: 17, flexShrink: 0 }} />
        <span>Incluir o <b style={{ color: C.text }}>telefone</b> dos clientes. Vem desmarcado de propósito: é dado pessoal.</span>
      </label>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        <Btn data-pacote-baixar onClick={baixar} disabled={!!busy}>{busy === 'baixar' ? 'Montando a planilha…' : 'Baixar o Excel'}</Btn>
        <Btn kind="ghost" onClick={compartilhar} disabled={!!busy}>{busy === 'compartilhar' ? 'Montando…' : 'Compartilhar'}</Btn>
      </div>
      {msg.texto && <div data-pacote-msg style={{ marginTop: 10, fontSize: 13.5, fontWeight: 700, color: msg.ok ? C.green : C.red, lineHeight: 1.5 }}>{msg.texto}</div>}
      <div style={{ fontSize: 12, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
        Tem dinheiro e dados do negócio: manda só pra quem precisa. O salário de cada funcionário não vai no arquivo.
      </div>
    </Card>
  );
}
