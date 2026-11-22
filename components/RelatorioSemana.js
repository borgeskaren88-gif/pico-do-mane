'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { C, Card, Btn } from './ui';

// O RELATÓRIO DA SEMANA, na tela do Darci.
//
// Em cima, os números grandes (o que ela quer ver num relance); embaixo, a
// análise do Darci com cabeça de CEO: o que importa, por quê, e o que fazer
// esta semana. A semana passada fica guardada — abrir de novo é instantâneo e
// não gasta IA. A semana em andamento dá pra refazer quando quiser.

const reais = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ddmm = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');
const sinal = (p) => (p == null ? '' : `${p > 0 ? '+' : ''}${p}%`);

// Negrito (**x**) e itálico (_x_) dentro de uma linha, sem HTML vindo de fora.
function Inline({ t }) {
  const partes = String(t).split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return partes.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <b key={i} style={{ color: C.text }}>{p.slice(2, -2)}</b>;
    if (/^_[^_]+_$/.test(p)) return <i key={i}>{p.slice(1, -1)}</i>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

export function TextoRelatorio({ texto }) {
  const linhas = String(texto || '').split('\n');
  return (
    <div data-relatorio-texto style={{ fontSize: 14.5, lineHeight: 1.65, color: C.muted }}>
      {linhas.map((l, i) => {
        const s = l.trim();
        if (!s) return <div key={i} style={{ height: 6 }} />;
        if (/^#{1,3}\s/.test(s)) {
          return <div key={i} style={{ fontSize: 15.5, fontWeight: 900, color: C.text, margin: '16px 0 6px', letterSpacing: '-.01em' }}>{s.replace(/^#{1,3}\s+/, '')}</div>;
        }
        const num = /^(\d+)[.)]\s+(.*)$/.exec(s);
        if (num) {
          return (
            <div key={i} style={{ display: 'flex', gap: 10, margin: '8px 0' }}>
              <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 999, background: C.accent, color: '#06101F', fontSize: 12.5, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{num[1]}</span>
              <span><Inline t={num[2]} /></span>
            </div>
          );
        }
        if (/^[-•*]\s+/.test(s)) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, margin: '4px 0' }}>
              <span style={{ color: C.accent, fontWeight: 900 }}>•</span>
              <span><Inline t={s.replace(/^[-•*]\s+/, '')} /></span>
            </div>
          );
        }
        return <p key={i} style={{ margin: '4px 0' }}><Inline t={s} /></p>;
      })}
    </div>
  );
}

function Numero({ rotulo, valor, sub, cor }) {
  return (
    <div style={{ flex: '1 1 130px', minWidth: 0, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: C.faint, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>{rotulo}</div>
      <div style={{ fontSize: 19, fontWeight: 900, marginTop: 3, color: cor || C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// Cada dia da semana: a barra é o que entrou; o risquinho é a média desse
// mesmo dia nas 4 semanas anteriores. Barra passou do risco = dia acima do normal.
function Dias({ dias }) {
  const max = Math.max(1, ...dias.map((d) => Math.max(d.total, d.mediaIgual || 0)));
  return (
    <div data-relatorio-dias style={{ marginTop: 4 }}>
      {dias.map((d) => {
        const acima = d.mediaIgual > 0 && d.total >= d.mediaIgual;
        return (
          <div key={d.data} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '5px 0' }}>
            <div style={{ width: 34, fontSize: 12, color: C.muted, fontWeight: 700 }}>{d.dia.slice(0, 3)}</div>
            <div style={{ flex: 1, position: 'relative', height: 14, background: C.panel2, borderRadius: 4 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(d.total / max) * 100}%`, background: d.mediaIgual > 0 ? (acima ? C.green : C.amber) : C.accent, borderRadius: 4 }} />
              {d.mediaIgual > 0 && <div title="média deste dia" style={{ position: 'absolute', top: -3, bottom: -3, width: 2, left: `calc(${(d.mediaIgual / max) * 100}% - 1px)`, background: C.text, opacity: 0.7 }} />}
            </div>
            <div style={{ width: 92, textAlign: 'right', fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{d.total > 0 ? reais(d.total) : '—'}</div>
          </div>
        );
      })}
      <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4 }}>O risquinho é a média do mesmo dia nas 4 semanas anteriores. Verde passou da média; laranja ficou abaixo.</div>
    </div>
  );
}

export default function RelatorioSemana() {
  const [semana, setSemana] = useState('passada');
  const [rel, setRel] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  // Fechado até ela tocar: abrir a tela do Darci não pode gastar IA sozinho.
  const [aberto, setAberto] = useState(false);

  const carregar = useCallback(async (qual, refazer = false) => {
    setCarregando(true); setErro(''); setAviso('');
    try {
      const r = refazer
        ? await fetch('/api/darci/relatorio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ semana: qual }), signal: AbortSignal.timeout(75000) })
        : await fetch(`/api/darci/relatorio?semana=${qual}`, { cache: 'no-store', signal: AbortSignal.timeout(75000) });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setErro(j.erro || 'Não consegui montar o relatório.'); setRel(null); return; }
      setRel(j);
    } catch (e) {
      setErro(/Timeout|Abort/i.test(e?.name || '') ? 'O Darci demorou demais pra analisar. Tenta de novo.' : 'Sem conexão.');
    } finally { setCarregando(false); }
  }, []);

  useEffect(() => { if (aberto) carregar(semana); }, [aberto, semana, carregar]);

  const compartilhar = async () => {
    if (!rel) return;
    const titulo = `Relatório da semana ${ddmm(rel.ini)} a ${ddmm(rel.fim)}`;
    const texto = `${titulo}\n\n${String(rel.texto || '').replace(/\*\*/g, '').replace(/^#{1,3}\s+/gm, '').replace(/^_|_$/gm, '')}`;
    try {
      if (navigator.share) { await navigator.share({ title: titulo, text: texto }); return; }
      await navigator.clipboard.writeText(texto);
      setAviso('Copiado. É só colar no WhatsApp.');
    } catch { /* cancelou */ }
  };

  const n = rel && rel.numeros;
  if (!aberto) {
    return (
      <Card data-relatorio-semana style={{ marginBottom: 16, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>Relatório da semana</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>O Darci lê os números da semana como um CEO: o que importa, por quê, e o que fazer agora.</div>
        </div>
        <Btn onClick={() => setAberto(true)}>Ver relatório</Btn>
      </Card>
    );
  }
  return (
    <Card data-relatorio-semana style={{ marginBottom: 16, textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 900 }}>Relatório da semana</div>
          <div style={{ fontSize: 12.5, color: C.faint }}>{rel && !rel.vazia ? `${ddmm(rel.ini)} a ${ddmm(rel.fim)}${rel.parcial ? ' (até ontem)' : ''}` : 'Segunda a domingo'}</div>
        </div>
        <div style={{ display: 'flex', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 2, gap: 2 }}>
          {[['passada', 'Semana passada'], ['atual', 'Esta semana']].map(([v, rot]) => (
            <button key={v} data-semana={v} onClick={() => setSemana(v)} style={{
              border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 700,
              background: semana === v ? C.accent : 'transparent', color: semana === v ? '#06101F' : C.muted,
            }}>{rot}</button>
          ))}
        </div>
      </div>

      {carregando && (
        <div data-relatorio-carregando style={{ fontSize: 14, color: C.muted, padding: '14px 0' }}>
          O Darci está lendo os números da semana e pensando no que importa… (pode levar uns 30 segundos)
        </div>
      )}
      {erro && !carregando && <div style={{ fontSize: 13.5, color: C.red, marginBottom: 10 }}>{erro}</div>}
      {rel && rel.vazia && !carregando && <div style={{ fontSize: 14, color: C.muted }}>A semana começou hoje: ainda não tem dia fechado pra analisar. Olha a semana passada.</div>}

      {rel && !rel.vazia && !carregando && n && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <Numero rotulo="Faturamento" valor={reais(n.faturamento)} sub={n.pctAnterior != null ? `${sinal(n.pctAnterior)} vs semana anterior` : 'sem semana anterior'} cor={n.pctAnterior == null ? null : n.pctAnterior >= 0 ? C.green : C.red} />
            <Numero rotulo="Ticket médio" valor={reais(n.ticket)} sub={n.pctTicket != null ? `${sinal(n.pctTicket)} por comanda` : 'por comanda'} />
            {n.cmvPct != null && <Numero rotulo="CMV" valor={`${String(n.cmvPct).replace('.', ',')}%`} sub={n.cmvPct > 45 ? 'alto' : n.cmvPct > 35 ? 'atenção' : 'saudável'} cor={n.cmvPct > 45 ? C.red : n.cmvPct > 35 ? C.amber : C.green} />}
            {n.metaPct != null && <Numero rotulo="Meta do mês" valor={`${n.metaPct}%`} sub="feita até aqui" />}
          </div>
          <Dias dias={n.dias} />
          <div style={{ borderTop: `1px solid ${C.hair}`, marginTop: 14, paddingTop: 4 }}>
            <TextoRelatorio texto={rel.texto} />
          </div>
          {rel.erroIA && <div style={{ fontSize: 12.5, color: C.amber, marginTop: 10 }}>A análise da IA não veio desta vez ({rel.erroIA}). Este é o resumo automático; toca em &quot;Gerar de novo&quot; pra tentar outra vez.</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <Btn small kind="ghost" onClick={compartilhar}>Compartilhar</Btn>
            <Btn small kind="ghost" onClick={() => carregar(semana, true)}>Gerar de novo</Btn>
          </div>
          {aviso && <div style={{ fontSize: 12.5, color: C.green, marginTop: 8 }}>{aviso}</div>}
          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 10 }}>
            {rel.motor ? 'Análise do Darci' : 'Resumo automático'} · gerado em {new Date(rel.geradoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Os números são contados pelo PicoOS; a leitura deles é do Darci.
          </div>
        </>
      )}
    </Card>
  );
}
