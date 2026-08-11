'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { C, Card, Btn, Field, TextInput, Empty, SecTitle, PageTitle } from './ui';
import { brl, num } from '../lib/util';

const CATS = ['Chopp / Cerveja', 'Drinks / Doses', 'Porções', 'Não alcoólicos', 'Sobremesas', 'Outros'];

export default function Comandas({ papel = 'dona' }) {
  const [comandas, setComandas] = useState([]);
  const [cardapio, setCardapio] = useState([]);
  const [mesasQtd, setMesasQtd] = useState(20);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState('');
  const [selId, setSelId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [configAberto, setConfigAberto] = useState(false);
  const [mesasInput, setMesasInput] = useState('');
  const editandoRef = useRef(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/comandas', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) { setComandas(j.comandas || []); setCardapio(j.cardapio || []); if (j.mesasQtd) setMesasQtd(j.mesasQtd); setErro(''); }
      else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Sem conexão.'); }
    finally { setCarregado(true); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  // Atualiza sozinho de tempos em tempos, pra um garçom ver as mesas do outro.
  // Não recarrega enquanto está mexendo numa comanda, pra não atrapalhar.
  useEffect(() => {
    const t = setInterval(() => { if (!editandoRef.current) carregar(); }, 12000);
    const onFoco = () => { if (!editandoRef.current) carregar(); };
    window.addEventListener('focus', onFoco);
    return () => { clearInterval(t); window.removeEventListener('focus', onFoco); };
  }, [carregar]);

  const acao = async (payload, { manterSel = true } = {}) => {
    setBusy(true);
    try {
      const r = await fetch('/api/comandas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Erro.'); return null; }
      if (j.comanda) {
        setComandas((cs) => {
          const outras = cs.filter((c) => c.id !== j.comanda.id);
          return [...outras, j.comanda].sort((a, b) => Number(a.mesa) - Number(b.mesa));
        });
        if (manterSel) setSelId(j.comanda.id);
      } else {
        await carregar();
      }
      setErro('');
      return j;
    } catch { setErro('Sem conexão.'); return null; }
    finally { setBusy(false); }
  };

  // Toca numa mesa do grid: se já tem comanda, entra; se não, abre e entra.
  const tocarMesa = async (mesa) => {
    const existente = comandas.find((c) => String(c.mesa) === String(mesa));
    if (existente) { setSelId(existente.id); return; }
    const j = await acao({ acao: 'abrir', mesa: String(mesa) });
    if (j?.comanda) setSelId(j.comanda.id);
  };
  const salvarMesas = async () => {
    const n = Math.floor(Number(mesasInput));
    if (!(n >= 1 && n <= 80)) { setErro('Número de mesas inválido (1 a 80).'); return; }
    const j = await acao({ acao: 'config', mesasQtd: n }, { manterSel: true });
    if (j?.ok) { setMesasQtd(n); setConfigAberto(false); }
  };
  const addItem = (cardapioId) => acao({ acao: 'add', comandaId: selId, cardapioId });
  const setQtd = (itemId, qtd) => acao({ acao: 'setQtd', comandaId: selId, itemId, qtd });
  const remover = (itemId) => acao({ acao: 'remover', comandaId: selId, itemId });
  const cancelar = async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Cancelar esta comanda? Todo o consumo lançado será apagado.')) return;
    await acao({ acao: 'cancelar', comandaId: id }, { manterSel: false });
    setSelId(null);
  };

  const totalDe = (c) => (c.itens || []).reduce((s, it) => s + (Number(it.qtd) || 0) * (Number(it.preco) || 0), 0);
  const sel = comandas.find((c) => c.id === selId) || null;
  useEffect(() => { editandoRef.current = !!selId; }, [selId]);

  const cardapioGrupos = useMemo(() => {
    const ordem = [...CATS, ''];
    const map = new Map();
    for (const it of cardapio) { const cat = it.categoria || ''; if (!map.has(cat)) map.set(cat, []); map.get(cat).push(it); }
    return [...map.entries()].sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
      .map(([cat, itens]) => ({ cat: cat || 'Outros', itens: itens.sort((x, y) => (x.nome || '').localeCompare(y.nome || '')) }));
  }, [cardapio]);

  // ---- Detalhe de uma comanda ----
  if (sel) {
    const total = totalDe(sel);
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button onClick={() => setSelId(null)} style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>‹ Mesas</button>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Mesa {sel.mesa}</div>
        </div>

        <Card style={{ marginBottom: 14, padding: 14 }}>
          {sel.itens.length === 0 ? <Empty>Nada lançado ainda.<br />Toque nos itens do cardápio abaixo.</Empty> :
            sel.itens.map((it) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${C.line}`, paddingTop: 9, marginTop: 9 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{it.nome}</div>
                  <div style={{ fontSize: 12, color: C.faint }}>{brl(num(it.preco))} cada</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setQtd(it.id, (Number(it.qtd) || 0) - 1)} disabled={busy} style={estBtn}>–</button>
                  <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{it.qtd}</span>
                  <button onClick={() => setQtd(it.id, (Number(it.qtd) || 0) + 1)} disabled={busy} style={estBtn}>+</button>
                </div>
                <div style={{ width: 78, textAlign: 'right', fontWeight: 800, color: C.green, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl((Number(it.qtd) || 0) * num(it.preco))}</div>
                <button onClick={() => remover(it.id)} disabled={busy} title="Remover" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>×</button>
              </div>
            ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: `2px solid ${C.line}` }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.muted }}>Total da mesa</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{brl(total)}</span>
          </div>
        </Card>

        <SecTitle>Cardápio</SecTitle>
        {cardapio.length === 0 ? <Empty>Cardápio vazio. Cadastre os itens na aba Cardápio.</Empty> :
          cardapioGrupos.map((g) => (
            <Card key={g.cat} style={{ marginBottom: 10, padding: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, color: C.accent }}>{g.cat}</div>
              {g.itens.map((it) => (
                <button key={it.id} onClick={() => addItem(it.id)} disabled={busy}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${C.line}`, paddingTop: 9, marginTop: 9, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: C.accent, color: '#fff', fontSize: 18, fontWeight: 800, lineHeight: '24px', textAlign: 'center' }}>+</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: C.text }}>{it.nome}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.green, fontVariantNumeric: 'tabular-nums' }}>{brl(num(it.preco))}</span>
                </button>
              ))}
            </Card>
          ))}

        {papel === 'dona' && (
          <div style={{ marginTop: 8 }}>
            <Btn kind="danger" small onClick={() => cancelar(sel.id)}>Cancelar comanda</Btn>
          </div>
        )}
      </div>
    );
  }

  // ---- Painel de mesas (grid como o Consumer) ----
  // Monta a lista de mesas: 1..mesasQtd + qualquer mesa aberta fora dessa faixa.
  const abertasPorMesa = new Map(comandas.map((c) => [String(c.mesa), c]));
  const numeros = [];
  for (let i = 1; i <= mesasQtd; i++) numeros.push(String(i));
  for (const c of comandas) { const m = String(c.mesa); if (!numeros.includes(m)) numeros.push(m); }
  numeros.sort((a, b) => Number(a) - Number(b));
  const nAbertas = comandas.length;

  return (
    <div>
      <PageTitle sub={`${nAbertas} mesa${nAbertas === 1 ? '' : 's'} ocupada${nAbertas === 1 ? '' : 's'} de ${mesasQtd}`}>Comandas</PageTitle>

      {erro && <div style={{ fontSize: 13, color: C.red, marginBottom: 10 }}>{erro}</div>}

      {!carregado ? <Empty>Carregando…</Empty> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 8 }}>
          {numeros.map((m) => {
            const c = abertasPorMesa.get(m);
            const ocupada = !!c;
            const total = ocupada ? totalDe(c) : 0;
            return (
              <button key={m} onClick={() => (ocupada ? setSelId(c.id) : tocarMesa(m))} disabled={busy}
                style={{
                  cursor: 'pointer', borderRadius: 14, padding: '12px 8px', minHeight: 84,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  border: ocupada ? `1px solid ${C.accent}` : `1px solid ${C.line}`,
                  background: ocupada ? C.accent : C.panel2,
                  color: ocupada ? '#06101F' : C.text,
                }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: ocupada ? 'rgba(6,16,31,0.65)' : C.faint }}>
                  {ocupada ? 'Ocupada' : 'Abrir'}
                </span>
                <span style={{ fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{m}</span>
                {ocupada && <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{brl(total)}</span>}
              </button>
            );
          })}
        </div>
      )}

      {papel === 'dona' && (
        <div style={{ marginTop: 18 }}>
          {!configAberto ? (
            <button onClick={() => { setMesasInput(String(mesasQtd)); setConfigAberto(true); }}
              style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0 }}>
              Configurar nº de mesas ({mesasQtd})
            </button>
          ) : (
            <Card style={{ padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Quantas mesas tem o salão?</div>
              <div style={{ fontSize: 12, color: C.faint, marginBottom: 10 }}>Vira o grid de mesas que você e os garçons usam.</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 100 }}><TextInput value={mesasInput} onChange={setMesasInput} inputMode="numeric" placeholder="20" /></div>
                <Btn small onClick={salvarMesas} disabled={busy}>Salvar</Btn>
                <Btn kind="ghost" small onClick={() => setConfigAberto(false)}>Cancelar</Btn>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

const estBtn = { width: 30, height: 30, borderRadius: 8, border: `1px solid var(--c-line)`, background: 'transparent', color: 'var(--c-text)', fontSize: 18, fontWeight: 800, cursor: 'pointer', lineHeight: 1 };
