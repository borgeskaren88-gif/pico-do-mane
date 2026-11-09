'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { C, Card, Btn, Field, Label, TextInput, NumInput, Select, Empty, SecTitle, PageTitle, inputStyle } from './ui';
import { brl, num, uid, limparNome } from '../lib/util';
import { promoVazia, limparPromo, erroDaPromo, estadoDaPromo, diasEmTexto } from '../lib/promocao';
import { UNIDADES, qtdNaUnidadeDoItem, conversaoDaReceita } from '../lib/estoque';

// AS CATEGORIAS DE FÁBRICA — o ponto de partida, não a lei.
//
// "Eu quero ter a opção de criar categorias no cardápio, tipo quero criar a
// categoria almoço."
//
// Isto aqui era a lista inteira, trancada no código: pra criar "Almoço" ela
// teria que me pedir e esperar um deploy. Agora é só o que vem pronto no
// primeiro dia; a lista de verdade mora no banco, e é dela.
//
// Duas listas fixas existiam, e elas já tinham DISCORDADO: esta tinha "Carta
// de Vinhos" e "Café & Tapiocas", a da tela do garçom não. O item não sumia —
// o garçom monta as abas a partir dos itens que existem — mas a categoria
// desconhecida pulava pra frente de todas na ordem. Uma lista só, guardada num
// lugar só, acaba com isso.
export const CATEGORIAS_PADRAO = ['Chopp / Cerveja', 'Drinks / Doses', 'Carta de Vinhos', 'Porções', 'Café & Tapiocas', 'Não alcoólicos', 'Sobremesas', 'Tabacaria', 'Combos', 'Outros'];

// A lista que vale: a dela, se existir; senão a de fábrica. Sempre com as
// categorias que os ITENS usam no fim — senão um item cadastrado numa
// categoria apagada vira item sem aba, invisível pro garçom.
export function categoriasDoCardapio(guardadas, itens = []) {
  const base = Array.isArray(guardadas) && guardadas.length ? guardadas.map(String) : CATEGORIAS_PADRAO;
  const usadas = [...new Set((itens || []).map((i) => (i && i.categoria) || '').filter(Boolean))];
  const orfas = usadas.filter((c) => !base.includes(c));
  return [...base, ...orfas];
}

// Compatibilidade: o nome antigo continua existindo pra quem ainda importa.
export const CATEGORIAS_CARDAPIO = CATEGORIAS_PADRAO;

const estCat = { width: 30, height: 30, borderRadius: 8, border: `1px solid var(--c-line)`, background: 'transparent', color: 'var(--c-muted)', fontSize: 15, fontWeight: 800, cursor: 'pointer', lineHeight: 1, flexShrink: 0 };

const CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const itemVazio = () => ({ nome: '', preco: '', categoria: '', sabores: [], saboresTotal: '', adicionais: [], promo: promoVazia() });

export default function Cardapio({ dados = [], onChange, estoque = [], categorias, onCategorias }) {
  const [novo, setNovo] = useState(itemVazio());
  const [editId, setEditId] = useState(null);
  const [catNova, setCatNova] = useState('');
  const [catErro, setCatErro] = useState('');
  const [verCats, setVerCats] = useState(false);
  const CATS = categoriasDoCardapio(categorias, dados);
  const set = (k) => (v) => setNovo((f) => ({ ...f, [k]: v }));
  const setPromo = (k) => (v) => setNovo((f) => ({ ...f, promo: { ...(f.promo || promoVazia()), [k]: v } }));
  const diasDaPromo = Array.isArray(novo.promo && novo.promo.dias) ? novo.promo.dias : [0, 1, 2, 3, 4, 5, 6];
  const alternarDia = (d) => setPromo('dias')(diasDaPromo.includes(d) ? diasDaPromo.filter((x) => x !== d) : [...diasDaPromo, d].sort((x, y) => x - y));
  const erroPromo = erroDaPromo(novo.promo, novo.preco);

  // O "valendo agora" tem que ser verdade AGORA.
  //
  // Sem este relógio, a tela que a dona deixou aberta às 15h58 continuaria
  // dizendo "começa hoje às 16:00" às 17h — e ela ia achar que não ligou.
  // Só anda quando existe promoção pra olhar.
  const [, tic] = useState(0);
  const temPromo = useMemo(() => dados.some((i) => i && i.promo), [dados]);
  useEffect(() => {
    if (!temPromo) return undefined;
    const t = setInterval(() => tic((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [temPromo]);

  const estoqueOrdenado = useMemo(() => [...estoque].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })), [estoque]);
  // Sabores/variações do item (ex.: caipirinha de morango, maracujá…). Cada
  // sabor aponta pra UMA fruta do estoque, com quantidade. A base (cachaça,
  // açúcar) fica na ficha técnica normal do item.
  const addSabor = () => setNovo((f) => ({ ...f, sabores: [...(f.sabores || []), { nome: '', estoqueId: '', qtd: '', unidade: '' }] }));
  const setSabor = (i, patch) => setNovo((f) => ({ ...f, sabores: (f.sabores || []).map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const removerSabor = (i) => setNovo((f) => ({ ...f, sabores: (f.sabores || []).filter((_, j) => j !== i) }));

  // Adicionais pagos (ex.: açaí + granola, leite condensado…). Cada um tem o
  // seu preço e, se quiser, o item do estoque que baixa junto.
  const addAdicional = () => setNovo((f) => ({ ...f, adicionais: [...(f.adicionais || []), { nome: '', preco: '3', estoqueId: '', qtd: '', unidade: '' }] }));
  const setAdicional = (i, patch) => setNovo((f) => ({ ...f, adicionais: (f.adicionais || []).map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const removerAdicional = (i) => setNovo((f) => ({ ...f, adicionais: (f.adicionais || []).filter((_, j) => j !== i) }));

  // Agrupa por categoria, na ordem do cardápio; "sem categoria" por último.
  const grupos = useMemo(() => {
    const ordem = [...CATS, ''];
    const map = new Map();
    for (const it of dados) {
      const cat = it.categoria || '';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(it);
    }
    return [...map.entries()]
      .sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
      .map(([cat, itens]) => ({ cat: cat || 'Sem categoria', itens: itens.sort((x, y) => (x.nome || '').localeCompare(y.nome || '')) }));
  }, [dados, categorias]);

  const salvar = () => {
    if (!novo.nome.trim()) return;
    const nomeLimpo = limparNome(novo.nome);
    // Avisa se já existe um item com esse nome (evita duplicar sem querer, ex.: narguilé).
    if (!editId && dados.some((i) => (i.nome || '').trim().toLowerCase() === nomeLimpo.toLowerCase())) {
      if (typeof window !== 'undefined' && !window.confirm(`Já existe um item chamado "${nomeLimpo}" no cardápio. Quer mesmo criar outro igual?`)) return;
    }
    const saboresLimpos = (novo.sabores || [])
      .map((s) => ({ nome: limparNome(s.nome), estoqueId: String(s.estoqueId || ''), qtd: String(s.qtd || ''), unidade: String(s.unidade || '') }))
      .filter((s) => s.nome && s.estoqueId && num(s.qtd) > 0);
    // Total de escolhas por sabor (combo): >0 = o garçom distribui N unidades
    // entre os sabores (ex.: 5 energéticos = 3 Tropical + 2 Melancia). Vazio/0 =
    // escolhe 1 sabor só (ex.: caipirinha).
    const total = Math.max(0, Math.floor(num(novo.saboresTotal)));
    const adicionaisLimpos = (novo.adicionais || [])
      .map((a) => ({ nome: limparNome(a.nome), preco: String(a.preco || '0'), estoqueId: String(a.estoqueId || ''), qtd: String(a.qtd || ''), unidade: String(a.unidade || '') }))
      .filter((a) => a.nome);
    // A promoção só entra se estiver inteira (preço + as duas horas). Pela
    // metade, limparPromo devolve null e o item fica sem promoção nenhuma —
    // melhor que guardar um horário sem preço e ninguém saber se liga.
    if (erroPromo) return;
    const promoLimpa = limparPromo(novo.promo);
    const limpo = { nome: nomeLimpo, preco: novo.preco || '0', categoria: novo.categoria, sabores: saboresLimpos, saboresTotal: saboresLimpos.length ? total : 0, adicionais: adicionaisLimpos, promo: promoLimpa };
    if (editId) onChange(dados.map((i) => (i.id === editId ? { ...i, ...limpo } : i)));
    else onChange([{ id: uid(), ...limpo, ativo: true }, ...dados]);
    setNovo(itemVazio()); setEditId(null);
  };
  const editar = (it) => { setNovo({ nome: it.nome || '', preco: it.preco || '', categoria: it.categoria || '', sabores: Array.isArray(it.sabores) ? it.sabores.map((s) => ({ ...s })) : [], saboresTotal: it.saboresTotal ? String(it.saboresTotal) : '', adicionais: Array.isArray(it.adicionais) ? it.adicionais.map((a) => ({ ...a })) : [], promo: it.promo ? { ...promoVazia(), ...it.promo, dias: Array.isArray(it.promo.dias) ? [...it.promo.dias] : [0, 1, 2, 3, 4, 5, 6] } : promoVazia() }); setEditId(it.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const cancelar = () => { setNovo(itemVazio()); setEditId(null); };
  const excluir = (id) => { if (id === editId) cancelar(); onChange(dados.filter((i) => i.id !== id)); };
  const alternarAtivo = (it) => onChange(dados.map((i) => (i.id === it.id ? { ...i, ativo: i.ativo === false ? true : false } : i)));

  // ---- mexer nas categorias ----
  const salvarCats = (lista) => { if (onCategorias) onCategorias(lista); };

  const criarCat = () => {
    const nome = limparNome(catNova);
    if (!nome) return;
    // Comparação sem acento e sem maiúscula: "Almoço" e "almoco" são a mesma
    // categoria pra quem digita correndo, e duas abas iguais na tela do garçom
    // é o tipo de coisa que ninguém entende e todo mundo xinga.
    const chave = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (CATS.some((c) => chave(c) === chave(nome))) { setCatErro(`"${nome}" já existe.`); return; }
    salvarCats([...CATS, nome]);
    setCatNova(''); setCatErro('');
  };

  const apagarCat = (c) => {
    const quantos = dados.filter((it) => (it.categoria || '') === c).length;
    // Apagar categoria com item dentro deixaria o item sem aba — presente no
    // banco e invisível na tela. Pior que um erro: um sumiço.
    if (quantos) { setCatErro(`"${c}" tem ${quantos} ${quantos === 1 ? 'item' : 'itens'}. Mova ${quantos === 1 ? 'ele' : 'eles'} pra outra categoria antes de apagar.`); return; }
    salvarCats(CATS.filter((x) => x !== c));
    setCatErro('');
  };

  const mudarOrdem = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= CATS.length) return;
    const lista = [...CATS];
    [lista[i], lista[j]] = [lista[j], lista[i]];
    salvarCats(lista);
  };

  const ativos = dados.filter((i) => i.ativo !== false).length;

  return (
    <div>
      <PageTitle sub="Os itens que o garçom lança nas comandas">Cardápio</PageTitle>

      {/* AS CATEGORIAS, agora dela.
          Fica fechado: quem entra aqui quer cadastrar um item, não arrumar
          categoria. Mexer nisso é coisa de uma vez por mês. */}
      <Card style={{ marginBottom: 16 }}>
        <button onClick={() => setVerCats((v) => !v)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
          <span style={{ color: C.accent, fontSize: 12, fontWeight: 800, width: 12, flexShrink: 0 }}>{verCats ? '▾' : '▸'}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>Categorias do cardápio</span>
            <span style={{ fontSize: 12, color: C.muted, display: 'block', marginTop: 1 }}>
              {CATS.length} categorias · viram as abas do garçom, nesta ordem
            </span>
          </span>
        </button>

        {verCats && (
          <div style={{ marginTop: 12, borderTop: `1px solid ${C.hair}`, paddingTop: 12 }}>
            {CATS.map((c, i) => {
              const quantos = dados.filter((it) => (it.categoria || '') === c).length;
              return (
                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: i ? `1px solid ${C.hair}` : 'none' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600 }}>
                    {c}
                    <span style={{ color: C.faint, fontWeight: 400 }}> · {quantos} {quantos === 1 ? 'item' : 'itens'}</span>
                  </span>
                  {/* A ordem daqui é a ordem das abas do garçom. Subir "Almoço"
                      no dia do almoço é a diferença entre achar e procurar. */}
                  <button onClick={() => mudarOrdem(i, -1)} disabled={i === 0} title="Subir"
                    style={{ ...estCat, opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                  <button onClick={() => mudarOrdem(i, +1)} disabled={i === CATS.length - 1} title="Descer"
                    style={{ ...estCat, opacity: i === CATS.length - 1 ? 0.3 : 1 }}>↓</button>
                  <button onClick={() => apagarCat(c)} title="Apagar"
                    style={{ ...estCat, color: quantos ? C.faint : C.red, opacity: quantos ? 0.4 : 1 }}>×</button>
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <TextInput value={catNova} onChange={(v) => { setCatNova(v); setCatErro(''); }} placeholder="Ex.: Almoço" />
              </div>
              <Btn small onClick={criarCat} disabled={!catNova.trim()}>Criar</Btn>
            </div>
            {catErro && <div style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginTop: 8, lineHeight: 1.45 }}>{catErro}</div>}
            <div style={{ fontSize: 11.5, color: C.faint, marginTop: 10, lineHeight: 1.45 }}>
              Categoria com item dentro não pode ser apagada — os itens ficariam sem aba, invisíveis pro garçom. Mova eles primeiro.
            </div>
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>{editId ? 'Editar item' : 'Adicionar item'}</div>
        <Field label="Item"><TextInput value={novo.nome} onChange={set('nome')} placeholder="Chopp 300ml, Porção de frango…" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
          <Field label="Preço (R$)"><NumInput value={novo.preco} onChange={set('preco')} /></Field>
          <Field label="Categoria"><Select value={novo.categoria} onChange={set('categoria')} options={CATS} /></Field>
        </div>

        {/* PROMOÇÃO COM HORÁRIO.
            "Hoje tive chopp a 9,99, fiz das 16h às 18h, aí 18h eu fui e
            desativei do cardápio." Agora ela marca uma vez e some da mão. */}
        <div style={{ marginTop: 4, marginBottom: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Promoção com horário (opcional)</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.45 }}>
            Tipo <b style={{ color: C.text }}>chopp a 9,99 das 16h às 18h</b>. Tu marca uma vez e ela <b style={{ color: C.text }}>liga e desliga sozinha</b> nos dias que tu escolher. Fora do horário o preço volta ao normal, sem tu precisar fazer nada.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 10 }}>
            <Field label="Preço na promoção"><NumInput value={(novo.promo || {}).preco || ''} onChange={setPromo('preco')} placeholder="9,99" /></Field>
            <Field label="Começa"><TextInput type="time" value={(novo.promo || {}).de || ''} onChange={setPromo('de')} /></Field>
            <Field label="Termina"><TextInput type="time" value={(novo.promo || {}).ate || ''} onChange={setPromo('ate')} /></Field>
          </div>
          <Label>Em quais dias</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            {CURTO.map((nome, d) => {
              const on = diasDaPromo.includes(d);
              return (
                <button key={d} onClick={() => alternarDia(d)}
                  style={{ border: `1px solid ${on ? C.accent : C.line}`, background: on ? `color-mix(in srgb, ${C.accent} 18%, transparent)` : 'transparent', color: on ? C.accent : C.muted, borderRadius: 999, padding: '6px 11px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>{nome}</button>
              );
            })}
            <button onClick={() => setPromo('dias')([0, 1, 2, 3, 4, 5, 6])}
              style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '6px 4px' }}>todo dia</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <Field label="Só até o dia (pode deixar vazio)"><TextInput type="date" value={(novo.promo || {}).fim || ''} onChange={setPromo('fim')} /></Field>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 12 }}>
              <button onClick={() => setPromo('ligada')((novo.promo || {}).ligada === false)}
                style={{ border: `1px solid ${(novo.promo || {}).ligada === false ? C.line : C.green}`, background: 'transparent', color: (novo.promo || {}).ligada === false ? C.muted : C.green, borderRadius: 10, padding: '9px 13px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
                {(novo.promo || {}).ligada === false ? 'Promoção desligada' : 'Promoção ligada'}
              </button>
            </div>
          </div>
          {erroPromo
            ? <div style={{ fontSize: 12.5, color: C.red, fontWeight: 700, lineHeight: 1.45 }}>{erroPromo}</div>
            : (() => {
              const e = estadoDaPromo({ ...novo, promo: limparPromo(novo.promo) });
              if (e.estado === 'nenhuma') return null;
              const cor = e.estado === 'valendo' ? C.green : e.estado === 'erro' ? C.red : C.muted;
              return (
                <div style={{ fontSize: 12.5, color: cor, fontWeight: 700, lineHeight: 1.45 }}>
                  {e.texto}{' '}
                  <span style={{ color: C.faint, fontWeight: 600 }}>
                    ({diasEmTexto((novo.promo || {}).dias)} · às {((novo.promo || {}).ate || '').slice(0, 5)} em ponto já voltou ao normal)
                  </span>
                </div>
              );
            })()}
        </div>

        {/* Sabores / variações (opcional) */}
        <div style={{ marginTop: 4, marginBottom: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Sabores / variações (opcional)</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.45 }}>
            Pra itens com sabores (caipirinha de limão, maracujá, morango…). O garçom escolhe o sabor na venda e o estoque baixa a <b style={{ color: C.text }}>fruta certa</b>. A base (cachaça/vodka, açúcar) fica na ficha técnica normal.
          </div>
          <Field label="Cliente escolhe quantas no total? (combo)">
            <NumInput value={novo.saboresTotal} onChange={set('saboresTotal')} placeholder="Ex.: 5 — deixe vazio p/ escolher 1 sabor só" />
          </Field>
          {num(novo.saboresTotal) > 0
            ? <div style={{ fontSize: 12, color: C.accent, marginBottom: 10, lineHeight: 1.45 }}>Modo combo: na venda o garçom distribui <b>{Math.floor(num(novo.saboresTotal))}</b> unidades entre os sabores (ex.: 3 + 2). Em cada sabor abaixo, ponha a quantidade de <b>1 unidade</b> (ex.: 1 lata).</div>
            : <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.45 }}>Vazio = o garçom escolhe <b>1 sabor</b> por item (ex.: caipirinha).</div>}
          {(novo.sabores || []).map((s, i) => (
            <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
              <Field label="Nome do sabor"><TextInput value={s.nome} onChange={(v) => setSabor(i, { nome: v })} placeholder="Ex.: Morango" /></Field>
              <Field label="Fruta (do estoque)">
                <select value={s.estoqueId} onChange={(e) => setSabor(i, { estoqueId: e.target.value })} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">Selecione…</option>
                  {estoqueOrdenado.map((it) => <option key={it.id} value={it.id}>{it.nome} ({it.unidade})</option>)}
                </select>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Quantidade"><NumInput value={s.qtd} onChange={(v) => setSabor(i, { qtd: v })} /></Field>
                <Field label="Unidade"><Select value={s.unidade} onChange={(v) => setSabor(i, { unidade: v })} options={UNIDADES} /></Field>
              </div>

              {/* O QUE ESSA QUANTIDADE SIGNIFICA — em dinheiro e em quantos
                  saem da embalagem.
                  ============================================================
                  "Uma caixa de essência vem 50 g, aí não sei quanto vai
                  exatamente."

                  Ela não tem como saber, e não deveria precisar: ninguém pesa
                  essência no meio do salão. O que ela SABE (ou consegue
                  observar numa noite) é quantos narguilés saem de uma caixa.

                  Então a tela passa a mostrar as duas leituras do mesmo número.
                  Ela digita uma grama qualquer, lê "a caixa rende 4" e "R$ 2,19
                  cada", e vai ajustando até bater com o que acontece no bar. O
                  palpite vira um botão de sintonia, em vez de um chute cego que
                  só aparece errado três meses depois, no CMV. */}
              {(() => {
                const it = estoque.find((x) => x && x.id === s.estoqueId);
                if (!it || !(num(s.qtd) > 0) || !s.unidade) return null;
                const conv = conversaoDaReceita(s.unidade, it);
                if (!conv.ok) {
                  return (
                    <div style={{ fontSize: 11.5, color: C.amber, lineHeight: 1.45, marginTop: -4, marginBottom: 6 }}>
                      Não dá pra converter <b>{s.unidade}</b> para <b>{it.unidade}</b> ({it.nome}).
                      {' '}Preenche o conteúdo de cada {it.unidade} em {s.unidade} no Estoque — senão a conta vira chute.
                    </div>
                  );
                }
                const naUnidade = qtdNaUnidadeDoItem(num(s.qtd), s.unidade, it);
                const custo = naUnidade * num(it.custo);
                const rende = naUnidade > 0 ? 1 / naUnidade : 0;
                const fmt = (v, casas = 2) => Number(v.toFixed(casas)).toLocaleString('pt-BR', { maximumFractionDigits: casas });
                return (
                  <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.5, marginTop: -4, marginBottom: 6 }}>
                    {fmt(num(s.qtd), 3)} {s.unidade} = <b style={{ color: C.muted }}>{fmt(naUnidade, 3)} {it.unidade}</b>
                    {num(it.custo) > 0
                      ? <> · <b style={{ color: C.green }}>{brl(custo)}</b> {num(novo.saboresTotal) > 0 ? 'por unidade' : 'por venda'}</>
                      : <> · <b style={{ color: C.amber }}>sem custo cadastrado</b> — o CMV ignora este sabor</>}
                    {rende > 0 && rende < 1000 && (num(novo.saboresTotal) > 0
                      // NO COMBO, "rende" precisa dizer rende O QUÊ.
                      //
                      // A dose de um narguilé é dividida em pedaços (2 metades,
                      // 4 quartos) pra o cliente poder misturar sabores. Aí
                      // "1 cx rende 8" é verdade e engana: são 8 PEDAÇOS, que
                      // dão 4 narguilés. O número que ela quer conferir é o
                      // segundo — é o que ela vê a caixa render no bar.
                      ? <> · 1 {it.unidade} rende <b style={{ color: C.muted }}>{fmt(rende, 1)}</b> unidade(s) = <b style={{ color: C.muted }}>{fmt(rende / Math.max(1, Math.floor(num(novo.saboresTotal))), 1)}</b> venda(s) inteira(s)</>
                      : <> · 1 {it.unidade} rende <b style={{ color: C.muted }}>{fmt(rende, 1)}</b></>
                    )}
                  </div>
                );
              })()}

              <button onClick={() => removerSabor(i)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '4px 0' }}>Remover sabor</button>
            </div>
          ))}
          <Btn kind="ghost" small onClick={addSabor}>+ Adicionar sabor</Btn>
        </div>

        {/* Adicionais pagos (opcional) */}
        <div style={{ marginTop: 4, marginBottom: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Adicionais pagos (opcional)</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.45 }}>
            Pra item que a pessoa incrementa (açaí + granola, leite condensado, morango…). Na venda o garçom marca os que ela quis e o <b style={{ color: C.text }}>preço soma sozinho</b>. Se ligar o adicional a um item do estoque, ele também <b style={{ color: C.text }}>baixa junto</b>.
          </div>
          {(novo.adicionais || []).map((a, i) => (
            <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 10 }}>
                <Field label="Nome do adicional"><TextInput value={a.nome} onChange={(v) => setAdicional(i, { nome: v })} placeholder="Ex.: Granola" /></Field>
                <Field label="Preço (R$)"><NumInput value={a.preco} onChange={(v) => setAdicional(i, { preco: v })} /></Field>
              </div>
              <Field label="Baixa do estoque (opcional)">
                <select value={a.estoqueId} onChange={(e) => setAdicional(i, { estoqueId: e.target.value })} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">Não baixa do estoque</option>
                  {estoqueOrdenado.map((it) => <option key={it.id} value={it.id}>{it.nome} ({it.unidade})</option>)}
                </select>
              </Field>
              {a.estoqueId && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Quantidade"><NumInput value={a.qtd} onChange={(v) => setAdicional(i, { qtd: v })} /></Field>
                  <Field label="Unidade"><Select value={a.unidade} onChange={(v) => setAdicional(i, { unidade: v })} options={UNIDADES} /></Field>
                </div>
              )}
              <button onClick={() => removerAdicional(i)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '4px 0' }}>Remover adicional</button>
            </div>
          ))}
          <Btn kind="ghost" small onClick={addAdicional}>+ Adicionar adicional</Btn>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={salvar}>{editId ? 'Salvar' : 'Adicionar'}</Btn>
          {editId && <Btn kind="ghost" onClick={cancelar}>Cancelar</Btn>}
        </div>
      </Card>

      <SecTitle>Itens do cardápio ({ativos})</SecTitle>
      {dados.length === 0 ? <Empty>Cardápio vazio.<br />Cadastre os itens que você vende — eles é que o garçom vai lançar nas comandas.</Empty> :
        grupos.map((g) => (
          <Card key={g.cat} style={{ marginBottom: 10, padding: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, color: C.accent }}>{g.cat}</div>
            {g.itens.map((it) => {
              const pausado = it.ativo === false;
              const ep = estadoDaPromo(it);
              const naPromo = ep.estado === 'valendo';
              return (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${C.line}`, paddingTop: 9, marginTop: 9, opacity: pausado ? 0.55 : 1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, textDecoration: pausado ? 'line-through' : 'none' }}>{it.nome}</div>
                    {Array.isArray(it.sabores) && it.sabores.length > 0 && <div style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>{it.sabores.length} sabor(es): {it.sabores.map((s) => s.nome).join(', ')}</div>}
                    {pausado && <div style={{ fontSize: 11, color: C.faint }}>pausado (não aparece pro garçom)</div>}
                    {ep.estado !== 'nenhuma' && (
                      <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.4, color: naPromo ? C.green : ep.estado === 'erro' ? C.red : C.faint }}>
                        {naPromo ? '● ' : ''}{ep.texto} <span style={{ fontWeight: 600 }}>({diasEmTexto(it.promo && it.promo.dias)})</span>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {naPromo && <div style={{ fontSize: 11, color: C.faint, fontWeight: 600, textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>{brl(num(it.preco))}</div>}
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.green, fontVariantNumeric: 'tabular-nums' }}>{brl(naPromo ? ep.preco : num(it.preco))}</div>
                  </div>
                  <button onClick={() => alternarAtivo(it)} title={pausado ? 'Reativar' : 'Pausar'} style={{ background: 'none', border: 'none', color: pausado ? C.green : C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 4 }}>{pausado ? 'Reativar' : 'Pausar'}</button>
                  <button onClick={() => editar(it)} title="Editar" style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 4 }}>Editar</button>
                  <button onClick={() => excluir(it.id)} title="Excluir" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>×</button>
                </div>
              );
            })}
          </Card>
        ))}
    </div>
  );
}
