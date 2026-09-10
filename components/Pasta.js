'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { C, Card, Btn, Empty } from './ui';

// A pasta de textos: modelo de cobrança, ficha técnica de prato e de drink,
// receita, roteiro de atendimento. Cada texto mora numa pasta, e a pasta é só
// um nome livre — quem escreve decide como organizar.
//
// O botão "copiar" é o que faz isso valer no dia a dia: abre o WhatsApp, cola
// o modelo, pronto. Ninguém precisa reescrever a mesma mensagem toda semana.
const SUGESTOES = ['Modelos de cobrança', 'Fichas técnicas — pratos', 'Fichas técnicas — drinks', 'Receitas', 'Atendimento'];
const vazio = (pasta) => ({ id: '', titulo: '', pasta: pasta && pasta !== 'todas' ? pasta : '', texto: '' });

export default function Pasta() {
  const [textos, setTextos] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [pastaSel, setPastaSel] = useState('todas');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState({}); // { [id]: true } — texto aberto
  const [form, setForm] = useState(null);
  const [copiado, setCopiado] = useState('');

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/textos', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) { setTextos(Array.isArray(j.textos) ? j.textos : []); setErro(''); }
      else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Sem conexão.'); }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const pastas = useMemo(() => {
    const m = new Map();
    for (const t of textos) {
      const p = (t.pasta || 'Sem pasta').trim() || 'Sem pasta';
      m.set(p, (m.get(p) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [textos]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return textos.filter((t) => {
      const p = (t.pasta || 'Sem pasta').trim() || 'Sem pasta';
      if (pastaSel !== 'todas' && p !== pastaSel) return false;
      if (!q) return true;
      return `${t.titulo} ${t.pasta} ${t.texto}`.toLowerCase().includes(q);
    });
  }, [textos, pastaSel, busca]);

  const salvar = async () => {
    if (!form) return;
    if (!form.titulo.trim()) { setErro('Dá um nome pro texto.'); return; }
    setBusy(true); setErro('');
    try {
      const r = await fetch('/api/textos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'salvar', ...form }),
      });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Não consegui salvar.'); return; }
      setForm(null);
      await carregar();
    } catch { setErro('Sem conexão.'); }
    finally { setBusy(false); }
  };

  const excluir = async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Apagar este texto? Não dá pra desfazer.')) return;
    setBusy(true); setErro('');
    try {
      const r = await fetch('/api/textos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'excluir', id }),
      });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Não consegui apagar.'); return; }
      await carregar();
    } catch { setErro('Sem conexão.'); }
    finally { setBusy(false); }
  };

  const copiar = async (t) => {
    try {
      await navigator.clipboard.writeText(t.texto || '');
      setCopiado(t.id);
      setTimeout(() => setCopiado(''), 2200);
    } catch { setErro('Não consegui copiar aqui. Abre o texto e copia com o dedo.'); }
  };

  const inp = { background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 10, padding: '11px 12px', fontSize: 15, width: '100%', boxSizing: 'border-box' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: C.text }}>Pasta</div>
        <div style={{ fontSize: 12, color: C.faint, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {textos.length ? `${textos.length} texto(s)` : 'vazia'}
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12, lineHeight: 1.45 }}>
        Modelo de cobrança, ficha técnica de prato e de drink, receita — guardado aqui, pronto pra copiar.
      </div>

      {erro && <div style={{ fontSize: 13, color: C.red, marginBottom: 10 }}>{erro}</div>}

      {/* As pastas, em pastilhas. Toca numa pra ver só o que está dentro. */}
      {pastas.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <button onClick={() => setPastaSel('todas')} style={chip(pastaSel === 'todas')}>Tudo <span style={{ opacity: 0.6 }}>{textos.length}</span></button>
          {pastas.map(([p, n]) => (
            <button key={p} onClick={() => setPastaSel(pastaSel === p ? 'todas' : p)} style={chip(pastaSel === p)}>
              📁 {p} <span style={{ opacity: 0.6 }}>{n}</span>
            </button>
          ))}
        </div>
      )}

      {textos.length > 3 && (
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar no texto…" style={{ ...inp, marginBottom: 12 }} />
      )}

      {!carregado ? <Empty>Carregando…</Empty> : visiveis.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '22px 12px', border: `1px dashed ${C.line}`, borderRadius: 14, color: C.faint, fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
          {textos.length === 0
            ? <>A pasta está vazia.<br /><span style={{ fontSize: 12 }}>Guarda aqui o modelo de cobrança, a ficha técnica de um drink, a receita de um prato…</span></>
            : 'Nada aqui com esse nome.'}
        </div>
      ) : visiveis.map((t) => {
        const ab = !!aberto[t.id];
        return (
          <Card key={t.id} style={{ marginBottom: 8, padding: 14 }}>
            <button onClick={() => setAberto((m) => ({ ...m, [t.id]: !m[t.id] }))} style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <span style={{ color: C.accent, fontSize: 12, fontWeight: 900, marginTop: 3, flexShrink: 0 }}>{ab ? '▾' : '▸'}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: C.text, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{t.titulo}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: C.faint, marginTop: 3 }}>
                  📁 {t.pasta || 'Sem pasta'}
                  {!ab && t.texto ? ` · ${String(t.texto).replace(/\s+/g, ' ').slice(0, 60)}${t.texto.length > 60 ? '…' : ''}` : ''}
                </span>
              </span>
            </button>

            {ab && (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  fontSize: 14, color: C.muted, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                  background: C.panel2, borderRadius: 10, padding: '11px 12px', overflowWrap: 'anywhere',
                }}>{t.texto || 'Sem texto ainda.'}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
                  <button onClick={() => copiar(t)} style={{ ...acaoBtn, color: copiado === t.id ? C.green : C.accent, borderColor: copiado === t.id ? C.green : C.line }}>
                    {copiado === t.id ? '✓ copiado!' : 'copiar'}
                  </button>
                  <button onClick={() => { setForm({ id: t.id, titulo: t.titulo, pasta: t.pasta || '', texto: t.texto || '' }); setErro(''); }} style={acaoBtn}>editar</button>
                  <button onClick={() => excluir(t.id)} disabled={busy} style={{ ...acaoBtn, marginLeft: 'auto', color: C.red }}>apagar</button>
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {!form ? (
        <button onClick={() => { setForm(vazio(pastaSel)); setErro(''); }} style={{
          marginTop: 4, width: '100%', background: 'transparent', border: `1px dashed ${C.line}`,
          color: C.accent, borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 800, cursor: 'pointer',
        }}>+ Guardar um texto</button>
      ) : (
        <Card style={{ marginTop: 8, padding: 14, borderColor: C.accent }}>
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 12 }}>{form.id ? 'Editar texto' : 'Novo texto'}</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={{ display: 'block' }}>
              <span style={rot}>Nome</span>
              <input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ex.: Cobrança do fiado · Caipirinha da casa" style={inp} autoFocus />
            </label>
            <label style={{ display: 'block' }}>
              <span style={rot}>Pasta</span>
              <input list="pastas-pico" value={form.pasta} onChange={(e) => setForm((f) => ({ ...f, pasta: e.target.value }))} placeholder="Ex.: Fichas técnicas — drinks" style={inp} />
              <datalist id="pastas-pico">
                {[...new Set([...pastas.map(([p]) => p), ...SUGESTOES])].map((p) => <option key={p} value={p} />)}
              </datalist>
              <span style={{ display: 'block', fontSize: 11, color: C.faint, marginTop: 4, lineHeight: 1.45 }}>
                Escreve o nome da pasta. Se ela ainda não existe, é criada na hora.
              </span>
            </label>
            <label style={{ display: 'block' }}>
              <span style={rot}>O texto</span>
              <textarea value={form.texto} onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))} rows={10}
                placeholder={'Escreve aqui.\n\nNuma ficha técnica dá pra pôr ingrediente, quantidade, modo de fazer e o preço de venda.'}
                style={{ ...inp, resize: 'vertical', lineHeight: 1.55, fontSize: 14.5 }} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Btn onClick={salvar} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</Btn>
            <Btn kind="ghost" onClick={() => { setForm(null); setErro(''); }}>Cancelar</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

const rot = { display: 'block', fontSize: 12, color: C.muted, fontWeight: 700, marginBottom: 5 };
const chip = (ativo) => ({
  border: `1px solid ${ativo ? C.accent : C.line}`, cursor: 'pointer', borderRadius: 999,
  background: ativo ? `color-mix(in srgb, ${C.accent} 16%, transparent)` : 'transparent',
  color: ativo ? C.accent : C.muted, padding: '6px 12px', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
});
const acaoBtn = {
  background: 'none', border: `1px solid ${C.line}`, color: C.muted, cursor: 'pointer',
  fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8,
};
