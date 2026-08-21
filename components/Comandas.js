'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Select, Empty, PageTitle } from './ui';
import { brl, num } from '../lib/util';

const CATS = ['Chopp / Cerveja', 'Drinks / Doses', 'Porções', 'Não alcoólicos', 'Sobremesas', 'Tabacaria', 'Combos', 'Outros'];
const FORMAS_PAG = ['Dinheiro', 'Pix', 'Crédito', 'Débito', 'Fiado'];

export default function Comandas({ papel = 'dona' }) {
  const [comandas, setComandas] = useState([]);
  const [cardapio, setCardapio] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [mesasQtd, setMesasQtd] = useState(20);
  const [carregado, setCarregado] = useState(false);
  const [verValores, setVerValores] = useState(true); // mostrar/ocultar os R$ nas mesas (fica lembrado no aparelho)
  const [erro, setErro] = useState('');
  const [selId, setSelId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [configAberto, setConfigAberto] = useState(false);
  const [mesasInput, setMesasInput] = useState('');
  const [fecharForm, setFecharForm] = useState(null); // { pagamento, pessoas } quando fechando
  const [outroCliente, setOutroCliente] = useState(false); // digitar nome fora da lista de clientes
  const [busca, setBusca] = useState('');
  const [picker, setPicker] = useState(false); // tela de adicionar produtos (carrinho)
  const [catSel, setCatSel] = useState(null); // categoria escolhida na tela de adicionar
  const [saborDe, setSaborDe] = useState(null); // item cujo seletor de sabor está aberto
  const [dividirPor, setDividirPor] = useState(2); // divisor da conta (quantas pessoas rachando)
  const [info, setInfo] = useState({ nome: '', pessoas: '', obs: '' });
  const infoDe = useRef(null); // id da comanda cujo info está carregado
  const editandoRef = useRef(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/comandas', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) { setComandas(j.comandas || []); setCardapio(j.cardapio || []); setClientes(j.clientes || []); if (j.mesasQtd) setMesasQtd(j.mesasQtd); setErro(''); }
      else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Sem conexão.'); }
    finally { setCarregado(true); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { try { if (localStorage.getItem('picoos-ver-valores-mesa') === '0') setVerValores(false); } catch { /* ignora */ } }, []);
  const toggleValores = () => setVerValores((v) => { const nv = !v; try { localStorage.setItem('picoos-ver-valores-mesa', nv ? '1' : '0'); } catch { /* ignora */ } return nv; });
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
  const addItem = (cardapioId, sabor) => acao({ acao: 'add', comandaId: selId, cardapioId, ...(sabor ? { sabor } : {}) });
  const setQtd = (itemId, qtd) => acao({ acao: 'setQtd', comandaId: selId, itemId, qtd });
  const remover = (itemId) => acao({ acao: 'remover', comandaId: selId, itemId });
  const cancelar = async (id) => {
    const c = comandas.find((x) => x.id === id);
    const vazia = !c || (c.itens || []).length === 0;
    const msg = vazia ? 'Excluir esta mesa aberta? (sem consumo lançado)' : 'Cancelar esta comanda? Todo o consumo lançado será apagado.';
    if (typeof window !== 'undefined' && !window.confirm(msg)) return;
    await acao({ acao: 'cancelar', comandaId: id }, { manterSel: false });
    setSelId(null);
  };
  const confirmarFechar = async () => {
    const pagamentos = FORMAS_PAG.map((f) => ({ forma: f, valor: num(fecharForm.valores[f] || '') })).filter((x) => x.valor > 0);
    const nomeCli = (fecharForm.nome || '').trim();
    const fiadoVal = num(fecharForm.valores['Fiado'] || '');
    const r = await fetch('/api/comandas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'fechar', comandaId: selId, pagamentos, pessoas: fecharForm.pessoas, nome: nomeCli, descontoPct: num(fecharForm.descontoPct || 0) }) });
    const j = await r.json();
    if (!j.ok) { setErro(j.erro || 'Não consegui fechar.'); return; }
    // Ficou fiado com um nome que não está cadastrado? Oferece salvar como cliente,
    // pra da próxima ser só clicar no nome (e poder definir um limite depois).
    const norm = (s) => (s || '').trim().toLowerCase();
    if (fiadoVal > 0.005 && nomeCli && !clientes.some((n) => norm(n) === norm(nomeCli))) {
      if (typeof window !== 'undefined' && window.confirm(`Salvar "${nomeCli}" na sua lista de clientes?\n\nAssim, da próxima vez é só clicar no nome — e dá pra definir um limite de fiado pra ele na aba Clientes.`)) {
        try { await fetch('/api/comandas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'novoCliente', nome: nomeCli }) }); } catch { /* se falhar, a venda já está salva; ela cadastra depois */ }
      }
    }
    setFecharForm(null);
    setSelId(null);
    await carregar();
  };

  const totalDe = (c) => (c.itens || []).reduce((s, it) => s + (Number(it.qtd) || 0) * (Number(it.preco) || 0), 0);
  // Conta com a taxa de serviço de 10% (ligada por padrão; some se a comanda tiver servico=false).
  const contaDe = (c) => {
    const subtotal = totalDe(c);
    const servicoOn = c && c.servico !== false;
    const servicoVal = servicoOn ? Math.round(subtotal * 0.10 * 100) / 100 : 0;
    return { subtotal, servicoOn, servicoVal, total: Math.round((subtotal + servicoVal) * 100) / 100 };
  };
  const sel = comandas.find((c) => c.id === selId) || null;
  useEffect(() => { editandoRef.current = !!selId; }, [selId]);
  // Ao abrir uma comanda, carrega os campos de nome/pessoas/obs pra edição.
  useEffect(() => {
    if (sel && infoDe.current !== sel.id) {
      infoDe.current = sel.id;
      setInfo({ nome: sel.nome || '', pessoas: sel.pessoas > 0 ? String(sel.pessoas) : '', obs: sel.obs || '' });
      setBusca(''); setFecharForm(null); setPicker(false);
    }
    if (!sel) { infoDe.current = null; }
  }, [sel]);

  const salvarInfos = (parcial) => acao({ acao: 'infos', comandaId: selId, ...parcial }, { manterSel: true });

  // Formata o horário de abertura (HH:MM).
  const horaAbertura = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  const rotuloPapel = (x) => (x === 'garcom' ? 'Garçom' : x === 'dona' ? 'Dona' : '');

  const cardapioGrupos = useMemo(() => {
    const ordem = [...CATS, ''];
    const map = new Map();
    for (const it of cardapio) { const cat = it.categoria || ''; if (!map.has(cat)) map.set(cat, []); map.get(cat).push(it); }
    return [...map.entries()].sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
      .map(([cat, itens]) => ({ cat: cat || 'Outros', itens: itens.sort((x, y) => (x.nome || '').localeCompare(y.nome || '')) }));
  }, [cardapio]);

  // ---- Tela de adicionar produtos (carrinho) ----
  if (sel && picker) {
    const total = contaDe(sel).total;
    const termoBusca = busca.trim().toLowerCase();
    const qtdNaComanda = (cardapioId) => (sel.itens.find((it) => it.cardapioId === cardapioId)?.qtd) || 0;
    const nItens = (sel.itens || []).reduce((s, it) => s + (Number(it.qtd) || 0), 0);
    const categorias = cardapioGrupos.map((g) => g.cat);
    const catAtiva = catSel && categorias.includes(catSel) ? catSel : categorias[0];
    // Com busca, mostra todos os itens que batem (ignora a categoria). Sem busca,
    // mostra só os da categoria escolhida na aba.
    const itensMostrar = termoBusca
      ? cardapioGrupos.flatMap((g) => g.itens).filter((it) => (it.nome || '').toLowerCase().includes(termoBusca))
      : (cardapioGrupos.find((g) => g.cat === catAtiva)?.itens || []);

    const linhaProduto = (it) => {
      const q = qtdNaComanda(it.id);
      const d = it.disp; // null = sem ficha; 0 = em falta; baixo = acabando
      const temSabores = Array.isArray(it.sabores) && it.sabores.length > 0;
      return (
        <button key={it.id} onClick={() => (temSabores ? setSaborDe(it) : addItem(it.id))} disabled={busy}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${C.line}`, paddingTop: 9, marginTop: 9, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: C.accent, color: '#fff', fontSize: 20, fontWeight: 800, lineHeight: '26px', textAlign: 'center' }}>+</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: C.text }}>{it.nome}</span>
          {temSabores && <span style={{ fontSize: 10, fontWeight: 800, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 999, padding: '1px 7px', flexShrink: 0 }}>sabores</span>}
          {d === 0 && <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: C.red, borderRadius: 999, padding: '2px 8px', flexShrink: 0 }}>em falta</span>}
          {d != null && d > 0 && d <= 3 && <span style={{ fontSize: 11, fontWeight: 800, color: '#06101F', background: C.amber, borderRadius: 999, padding: '2px 8px', flexShrink: 0 }}>só {d}</span>}
          {q > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: '#06101F', background: C.green, borderRadius: 999, padding: '2px 8px', flexShrink: 0 }}>{q} na mesa</span>}
          <span style={{ fontSize: 13, fontWeight: 700, color: C.green, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(num(it.preco))}</span>
        </button>
      );
    };

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button onClick={() => { setPicker(false); setBusca(''); }} style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>‹ Voltar</button>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Adicionar · Mesa {sel.mesa}</div>
        </div>

        {saborDe && (
          <div onClick={() => setSaborDe(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.accent}`, borderRadius: 16, padding: 18, width: '100%', maxWidth: 360, boxShadow: '0 12px 44px rgba(0,0,0,.4)' }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>{saborDe.nome} — qual sabor?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {saborDe.sabores.map((s) => (
                  <button key={s.nome} onClick={() => { addItem(saborDe.id, s.nome); setSaborDe(null); }} disabled={busy}
                    style={{ border: 'none', background: C.accent, color: '#06101F', borderRadius: 999, padding: '11px 18px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>{s.nome}</button>
                ))}
              </div>
              <button onClick={() => setSaborDe(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '14px 0 0' }}>Cancelar</button>
            </div>
          </div>
        )}

        {cardapio.length > 0 && (
          <div style={{ marginBottom: 12 }}><TextInput value={busca} onChange={setBusca} placeholder="Buscar produto…" /></div>
        )}

        {cardapio.length === 0 ? <Empty>Cardápio vazio. Cadastre os itens na aba Cardápio.</Empty> : (
          <div className="picker-layout">
            {!termoBusca && (
              <div className="picker-cats">
                {categorias.map((cat) => (
                  <button key={cat} className={`picker-cat-chip${cat === catAtiva ? ' on' : ''}`} onClick={() => setCatSel(cat)}>{cat}</button>
                ))}
              </div>
            )}
            <div className="picker-produtos">
              {itensMostrar.length === 0 ? <Empty>Nenhum produto{termoBusca ? ' com esse nome' : ' nesta categoria'}.</Empty> : (
                <Card style={{ padding: 14 }}>
                  {termoBusca && <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, color: C.accent }}>Resultados</div>}
                  {itensMostrar.map((it) => linhaProduto(it))}
                </Card>
              )}
            </div>
          </div>
        )}

        <div style={{ position: 'sticky', bottom: 12, marginTop: 14 }}>
          <button onClick={() => { setPicker(false); setBusca(''); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer', border: 'none', borderRadius: 14, padding: '14px 18px', background: C.accent, color: '#06101F', boxShadow: C.cardShadow }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>Concluir</span>
            <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{nItens} item{nItens === 1 ? '' : 's'} · {brl(total)}</span>
          </button>
        </div>
      </div>
    );
  }

  // ---- Detalhe de uma comanda (só o que foi pedido) ----
  if (sel) {
    const conta = contaDe(sel);
    const total = conta.total;
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button onClick={() => setSelId(null)} style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>‹ Mesas</button>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Mesa {sel.mesa}</div>
        </div>

        <Card style={{ marginBottom: 14, padding: 14 }}>
          <div style={{ fontSize: 12, color: C.faint, marginBottom: 12 }}>
            {horaAbertura(sel.abertaEm) && <>Aberta às <b style={{ color: C.muted }}>{horaAbertura(sel.abertaEm)}</b></>}
            {rotuloPapel(sel.abertaPor) && <> · por {rotuloPapel(sel.abertaPor)}</>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
            <Field label="Nome do cliente (opcional)"><TextInput value={info.nome} onChange={(v) => setInfo((s) => ({ ...s, nome: v }))} onBlur={() => salvarInfos({ nome: info.nome })} placeholder="Ex.: João do balcão" /></Field>
            <Field label="Pessoas">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => { const n = Math.max(0, (Number(info.pessoas) || 0) - 1); setInfo((s) => ({ ...s, pessoas: n ? String(n) : '' })); salvarInfos({ pessoas: n }); }} style={estBtn}>–</button>
                <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 800 }}>{info.pessoas || '–'}</span>
                <button onClick={() => { const n = (Number(info.pessoas) || 0) + 1; setInfo((s) => ({ ...s, pessoas: String(n) })); salvarInfos({ pessoas: n }); }} style={estBtn}>+</button>
              </div>
            </Field>
          </div>
          <Field label="Observação (opcional)"><TextInput value={info.obs} onChange={(v) => setInfo((s) => ({ ...s, obs: v }))} onBlur={() => salvarInfos({ obs: info.obs })} placeholder="Ex.: sem cebola, cliente com pressa…" /></Field>
        </Card>

        <Card style={{ marginBottom: 14, padding: 14 }}>
          {sel.itens.length === 0 ? <Empty>Nada lançado ainda.<br />Toque em “Adicionar produtos” abaixo.</Empty> :
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
          {sel.itens.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `2px solid ${C.line}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: 14 }}>
                <span style={{ color: C.muted }}>Consumo</span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{brl(conta.subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                <button onClick={() => salvarInfos({ servico: !conta.servicoOn })} disabled={busy}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.muted, fontSize: 14 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `2px solid ${conta.servicoOn ? C.accent : C.line}`, background: conta.servicoOn ? C.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {conta.servicoOn && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06101F" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>}
                  </span>
                  Serviço (10%)
                </button>
                <span style={{ fontWeight: 700, color: conta.servicoOn ? C.text : C.faint, fontVariantNumeric: 'tabular-nums' }}>{conta.servicoOn ? brl(conta.servicoVal) : 'retirado'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginTop: 4, borderTop: `1px solid ${C.line}` }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Total da mesa</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{brl(total)}</span>
              </div>
            </div>
          )}
        </Card>

        <div style={{ marginBottom: 14 }}>
          <Btn onClick={() => { setBusca(''); setCatSel(null); setPicker(true); }}>+ Adicionar produtos</Btn>
        </div>

        {total > 0 && (
          fecharForm ? (() => {
            const descontoPct = Math.max(0, Math.min(100, num(fecharForm.descontoPct || 0)));
            const desconto = Math.round(total * descontoPct / 100 * 100) / 100;
            const totalFinal = Math.round((total - desconto) * 100) / 100;
            const soma = FORMAS_PAG.reduce((s, f) => s + num(fecharForm.valores[f] || ''), 0);
            const falta = Math.round((totalFinal - soma) * 100) / 100;
            const fiadoVal = num(fecharForm.valores['Fiado'] || '');
            const confere = Math.abs(falta) <= 0.005;
            const setVal = (f) => (v) => setFecharForm((s) => ({ ...s, valores: { ...s.valores, [f]: v } }));
            const setDesc = (p) => setFecharForm((s) => ({ ...s, descontoPct: p, valores: {} }));
            const preencherResto = (f) => {
              const outros = FORMAS_PAG.filter((x) => x !== f).reduce((s, x) => s + num(fecharForm.valores[x] || ''), 0);
              const resto = Math.round((totalFinal - outros) * 100) / 100;
              setFecharForm((s) => ({ ...s, valores: { ...s.valores, [f]: resto > 0 ? resto.toFixed(2).replace('.', ',') : '' } }));
            };
            return (
              <Card style={{ marginBottom: 14, padding: 14, borderColor: C.green }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>Fechar conta — {brl(total)}</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Quanto entrou em cada forma? Dá pra dividir. Use “resto” pra completar.</div>

                {/* Desconto (%) — abate do total da conta */}
                <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Desconto</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {[0, 5, 10, 15].map((p) => (
                      <button key={p} onClick={() => setDesc(p)} style={{ border: `1px solid ${descontoPct === p ? C.accent : C.line}`, background: descontoPct === p ? C.accent : 'transparent', color: descontoPct === p ? '#06101F' : C.muted, borderRadius: 999, padding: '7px 13px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{p === 0 ? 'Sem' : p + '%'}</button>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 2 }}>
                      <div style={{ width: 62 }}><NumInput value={descontoPct ? String(descontoPct) : ''} onChange={(v) => setDesc(num(v))} placeholder="outro" /></div>
                      <span style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>%</span>
                    </div>
                  </div>
                  {descontoPct > 0 && <div style={{ fontSize: 14, fontWeight: 800, color: C.accent, marginTop: 8 }}>− {brl(desconto)} · Total com desconto: {brl(totalFinal)}</div>}
                </div>

                {/* Dividir a conta (calculadora de rachar) — só pra ver quanto fica por pessoa */}
                <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Dividir a conta entre</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={() => setDividirPor((n) => Math.max(1, n - 1))} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.line}`, background: 'transparent', color: C.text, fontSize: 20, fontWeight: 800, cursor: 'pointer', lineHeight: 1 }}>–</button>
                      <span style={{ minWidth: 46, textAlign: 'center', fontSize: 15, fontWeight: 800 }}>{dividirPor} {dividirPor === 1 ? 'pessoa' : 'pessoas'}</span>
                      <button onClick={() => setDividirPor((n) => Math.min(50, n + 1))} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.line}`, background: 'transparent', color: C.text, fontSize: 20, fontWeight: 800, cursor: 'pointer', lineHeight: 1 }}>+</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.accent, marginTop: 8, textAlign: 'center' }}>{brl(totalFinal / dividirPor)} <span style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>por pessoa</span></div>
                </div>

                {FORMAS_PAG.map((f) => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 82, flexShrink: 0, fontSize: 13, fontWeight: 700, color: f === 'Fiado' ? C.amber : C.text }}>{f}</span>
                    <div style={{ flex: 1, minWidth: 0 }}><NumInput value={fecharForm.valores[f] || ''} onChange={setVal(f)} /></div>
                    <button onClick={() => preencherResto(f)} style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 8, padding: '7px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>resto</button>
                  </div>
                ))}
                <div style={{ fontSize: 13, marginTop: 4, marginBottom: fiadoVal > 0 ? 10 : 6, fontWeight: 700, color: confere ? C.green : C.amber }}>
                  {confere ? 'Confere!' : falta > 0 ? `Falta ${brl(falta)}` : `Passou ${brl(-falta)}`}
                  <span style={{ color: C.faint, fontWeight: 500 }}> · somado {brl(soma)} de {brl(totalFinal)}</span>
                </div>
                {fiadoVal > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <Field label="Quem ficou devendo?">
                      {clientes.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <Select
                            value={outroCliente ? 'Outro (digitar)' : fecharForm.nome}
                            onChange={(v) => { if (v === 'Outro (digitar)') { setOutroCliente(true); setFecharForm((s) => ({ ...s, nome: '' })); } else { setOutroCliente(false); setFecharForm((s) => ({ ...s, nome: v })); } }}
                            options={[...clientes, 'Outro (digitar)']} placeholder="Selecionar cliente" />
                          {outroCliente && <TextInput value={fecharForm.nome} onChange={(v) => setFecharForm((s) => ({ ...s, nome: v }))} placeholder="Nome do cliente" />}
                        </div>
                      ) : (
                        <TextInput value={fecharForm.nome} onChange={(v) => setFecharForm((s) => ({ ...s, nome: v }))} placeholder="Nome do cliente" />
                      )}
                    </Field>
                    <div style={{ fontSize: 11, color: C.amber, marginTop: 6 }}>{brl(fiadoVal)} vai pra lista de Fiados (não entra no caixa até você marcar “Recebi”).</div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <Btn kind="ok" onClick={confirmarFechar} disabled={busy || !confere}>Confirmar</Btn>
                  <Btn kind="ghost" onClick={() => setFecharForm(null)}>Voltar</Btn>
                </div>
              </Card>
            );
          })() : (
            <div style={{ marginBottom: 14 }}>
              <Btn kind="ok" onClick={() => { setOutroCliente(!!(sel.nome && !clientes.includes(sel.nome))); setDividirPor(sel.pessoas > 0 ? sel.pessoas : 2); setFecharForm({ valores: {}, nome: sel.nome || '', pessoas: sel.pessoas > 0 ? sel.pessoas : 1 }); }}>Fechar conta · {brl(total)}</Btn>
            </div>
          )
        )}

        {(papel === 'dona' || sel.itens.length === 0) && (
          <div style={{ marginTop: 8 }}>
            <Btn kind="danger" small onClick={() => cancelar(sel.id)}>{sel.itens.length === 0 ? 'Excluir mesa (aberta sem querer)' : 'Cancelar comanda'}</Btn>
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
  // Mesas ocupadas primeiro (agrupadas no começo), depois as livres — cada grupo
  // em ordem de número. Assim as mesas ativas ficam juntas, sem uma perdida no meio.
  numeros.sort((a, b) => {
    const oa = abertasPorMesa.has(a) ? 0 : 1, ob = abertasPorMesa.has(b) ? 0 : 1;
    return oa !== ob ? oa - ob : Number(a) - Number(b);
  });
  const nAbertas = comandas.length;

  return (
    <div>
      <PageTitle sub={`${nAbertas} mesa${nAbertas === 1 ? '' : 's'} ocupada${nAbertas === 1 ? '' : 's'} de ${mesasQtd}`}>Comandas</PageTitle>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6, marginBottom: 10 }}>
        <button onClick={toggleValores} title="Mostrar ou esconder os valores das mesas"
          style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 9, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {verValores ? 'Ocultar valores' : 'Mostrar valores'}
        </button>
      </div>

      {erro && <div style={{ fontSize: 13, color: C.red, marginBottom: 10 }}>{erro}</div>}

      {!carregado ? <Empty>Carregando…</Empty> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 10 }}>
          {numeros.map((m) => {
            const c = abertasPorMesa.get(m);
            const ocupada = !!c;
            const total = ocupada ? contaDe(c).total : 0;
            const escuroSobreAzul = 'rgba(6,16,31,0.62)';
            return (
              <button key={m} onClick={() => (ocupada ? setSelId(c.id) : tocarMesa(m))} disabled={busy}
                style={{
                  cursor: 'pointer', borderRadius: 18, padding: ocupada ? '14px 10px 12px' : '16px 10px', minHeight: 104,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                  border: ocupada ? 'none' : `1px solid color-mix(in srgb, ${C.accent} 16%, ${C.panel})`,
                  background: ocupada ? C.accent : `color-mix(in srgb, ${C.accent} 7%, ${C.panel})`,
                  boxShadow: ocupada ? C.cardShadow : 'none',
                  color: ocupada ? '#06101F' : C.text,
                  transition: 'transform .08s ease',
                }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: ocupada ? escuroSobreAzul : C.faint }}>
                  {ocupada ? 'Ocupada' : 'Livre'}
                </span>
                <span style={{ fontSize: 21, fontWeight: 800, lineHeight: 1, color: ocupada ? '#06101F' : C.accent }}>{m}</span>
                {!ocupada && <span style={{ fontSize: 10, fontWeight: 700, color: C.faint, letterSpacing: '.02em' }}>toque p/ abrir</span>}
                {ocupada && c.nome && <span style={{ fontSize: 11, fontWeight: 600, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: escuroSobreAzul }}>{c.nome}</span>}
                {ocupada && <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{verValores ? brl(total) : 'R$ •••'}</span>}
                {ocupada && c.pessoas > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: escuroSobreAzul }}>{c.pessoas} pessoa{c.pessoas === 1 ? '' : 's'}</span>}
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
