'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Empty, SecTitle } from './ui';
import { num, fmtDate, brl, todayISO, ymOf, mesLabel, diaOperacional } from '../lib/util';
import { saiuSemVender, listaSemVender, CATEGORIAS_SAIDA } from '../lib/fechamento';
import QuemPegou from './QuemPegou';

// Dar cortesia ou registrar consumo da casa de um PRODUTO do cardápio (ex.:
// narguilé, um drink). O sistema baixa os ingredientes da ficha técnica sozinho.
// Não vira venda nem toca no caixa/DRE.
// O que aconteceu com o produto pronto. 'Perda' é o drink que caiu no chão, o
// prato que voltou — sai do estoque igual, mas vai pro balde de perdas no
// resumo "Para onde foi o estoque", não pro de cortesia.
const MOTIVOS = [['Cortesia', 'Cortesia'], ['Consumo da casa', 'Consumo da casa'], ['Perda', 'Perda / derrubou']];

export default function CortesiaConsumo({ onFeito, estoque = [] }) {
  // O PLACAR. "Queria algo bem claro: quanto já foi gasto em cortesia, perda
  // ou consumo. Tipo bati o olho, já sei." É a mesma conta do Raio-X, pelo
  // mesmo caminho — as duas telas não podem dar números diferentes.
  const mesAtual = ymOf(todayISO());
  // O mês que ela está olhando (o placar e a lista andam juntos).
  const [mes, setMes] = useState(mesAtual);
  const ehMesAtual = mes === mesAtual;
  const placar = useMemo(() => saiuSemVender(estoque, { mes, hoje: ehMesAtual ? diaOperacional() : '' }), [estoque, mes, ehMesAtual]);
  const saidas = useMemo(() => listaSemVender(estoque, { mes }), [estoque, mes]);
  const [filtroCat, setFiltroCat] = useState('');
  const [verTudo, setVerTudo] = useState(false);
  const andaMes = (d) => { const [y, m] = mes.split('-').map(Number); const n = new Date(Date.UTC(y, m - 1 + d, 1)); setMes(n.toISOString().slice(0, 7)); setVerTudo(false); };
  const [cardapio, setCardapio] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [busca, setBusca] = useState('');
  const [selId, setSelId] = useState('');
  const [qtd, setQtd] = useState('1');
  const [motivo, setMotivo] = useState('Cortesia');
  const [sabor, setSabor] = useState('');
  const [quem, setQuem] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [ultimos, setUltimos] = useState([]);
  const [podeDesfazer, setPodeDesfazer] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/comandas', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) setCardapio(Array.isArray(j.cardapio) ? j.cardapio : []);
    } catch { /* offline */ }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // O HISTÓRICO, que é o que faltava.
  //
  // "Fui colocar uma Heineken como cortesia e acabei colocando 11, como
  // reverto isto?" Não revertia: lançou, saiu do estoque, acabou. A tela não
  // mostrava nem o que tinha acabado de ser lançado.
  const carregarUltimos = useCallback(async () => {
    try {
      const r = await fetch('/api/comandas?cortesias=1', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) { setUltimos(Array.isArray(j.cortesias) ? j.cortesias : []); setPodeDesfazer(!!j.podeDesfazer); }
    } catch { /* offline */ }
  }, []);
  useEffect(() => { carregarUltimos(); }, [carregarUltimos]);

  const desfazer = async (c) => {
    if (typeof window !== 'undefined'
      && !window.confirm(`Desfazer ${c.qtd}× ${c.prato}? O que saiu volta pro estoque.`)) return;
    setBusy(true); setErro(''); setMsg('');
    try {
      const r = await fetch('/api/comandas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'desfazerCortesia', id: c.id }),
      });
      const j = await r.json();
      if (!j.ok) setErro(j.erro || 'Não consegui desfazer.');
      else {
        setMsg(j.voltou
          ? `Desfeito: ${c.qtd}× ${c.prato}. O que saiu voltou pro estoque.`
          : `Lançamento removido. Nada voltou pro estoque — os itens dele já não estão mais lá.`);
        if (onFeito) onFeito();
      }
    } catch { setErro('Sem conexão.'); }
    finally { setBusy(false); await carregarUltimos(); }
  };

  const filtro = busca.trim().toLowerCase();
  const lista = filtro ? cardapio.filter((i) => (i.nome || '').toLowerCase().includes(filtro)) : cardapio;
  const sel = cardapio.find((i) => i.id === selId) || null;

  const registrar = async () => {
    if (!selId) { setErro('Escolha o produto.'); return; }
    if (!(num(qtd) > 0)) { setErro('Diga a quantidade.'); return; }
    setBusy(true); setErro(''); setMsg('');
    try {
      const r = await fetch('/api/comandas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'cortesia', cardapioId: selId, qtd: num(qtd), motivo, sabor, quem }) });
      const j = await r.json();
      if (!j.ok) setErro(j.erro || 'Não consegui registrar.');
      else { setMsg(`${motivo}: ${num(qtd)}× ${j.prato || sel?.nome || ''}${j.quem ? ` — ${j.quem}` : ''}. Ingredientes baixados do estoque.`); setSelId(''); setBusca(''); setQtd('1'); setSabor(''); setQuem(''); if (onFeito) onFeito(); carregarUltimos(); }
    } catch { setErro('Sem conexão.'); }
    finally { setBusy(false); }
  };

  // Os cinco baldes, na ordem que ela falou. `perdaSo` é a perda que não é
  // quebra nem congelou (desperdício, vencido, estragou, derrubou).
  const BALDES = [['cortesia', 'Cortesia', C.amber, 'cortesia'], ['consumo', 'Consumo da casa', C.amber, 'consumo'], ['quebra', 'Quebrou', C.red, 'quebra'], ['congelou', 'Congelou', C.red, 'congelou'], ['perdaSo', 'Perda', C.red, 'perda']];
  const NOME_CAT = Object.fromEntries(CATEGORIAS_SAIDA);
  const COR_CAT = { cortesia: C.amber, consumo: C.amber, quebra: C.red, congelou: C.red, perda: C.red };
  const filtrada = filtroCat ? saidas.filter((l) => l.categoria === filtroCat) : saidas;
  const somaFiltrada = Math.round(filtrada.reduce((s2, l) => s2 + (l.custo || 0), 0) * 100) / 100;
  const visiveis = verTudo ? filtrada : filtrada.slice(0, 12);
  const qtdTxt = (l) => (l.qtd == null ? '' : `${String(Math.round(l.qtd * 1000) / 1000).replace('.', ',')} ${l.unidade} · `);
  const quando = (l) => {
    const h = l.ts ? new Date(l.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '';
    return `${fmtDate(l.data).slice(0, 5)}${h ? ` ${h}` : ''}`;
  };

  return (
    <div>
      <Card data-placar="sem-vender" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', flex: 1 }}>Saiu sem vender em {mesLabel(mes)}</div>
          <button onClick={() => andaMes(-1)} aria-label="Mês anterior" style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 8, width: 30, height: 28, cursor: 'pointer' }}>‹</button>
          <button onClick={() => andaMes(1)} disabled={ehMesAtual} aria-label="Próximo mês" style={{ background: 'none', border: `1px solid ${C.line}`, color: ehMesAtual ? C.faint : C.muted, borderRadius: 8, width: 30, height: 28, cursor: ehMesAtual ? 'default' : 'pointer', opacity: ehMesAtual ? 0.4 : 1 }}>›</button>
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color: placar.mes.total > 0 ? C.red : C.green, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>{brl(placar.mes.total)}</div>
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 10 }}>
          a preço de custo{ehMesAtual && <> · hoje: <b style={{ color: placar.hoje.total > 0 ? C.text : C.faint }}>{brl(placar.hoje.total)}</b></>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 8 }}>
          {BALDES.map(([k, rot, cor, cat]) => (
            <div key={k} data-balde={cat} onClick={() => setFiltroCat(filtroCat === cat ? '' : cat)} role="button"
              style={{ background: C.panel2, borderRadius: 10, padding: '9px 10px', minWidth: 0, cursor: 'pointer', outline: filtroCat === cat ? `2px solid ${C.accent}` : 'none' }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, lineHeight: 1.2 }}>{rot}</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: placar.mes[k] > 0 ? cor : C.faint, fontVariantNumeric: 'tabular-nums' }}>{brl(placar.mes[k])}</div>
              <div style={{ fontSize: 10.5, color: C.faint }}>{placar.mes.vezes[k]} {placar.mes.vezes[k] === 1 ? 'vez' : 'vezes'}</div>
            </div>
          ))}
        </div>
        {placar.semCusto > 0 && (
          <div style={{ fontSize: 11.5, color: C.amber, lineHeight: 1.45, marginTop: 8 }}>
            {placar.semCusto} {placar.semCusto === 1 ? 'saída ficou' : 'saídas ficaram'} de fora dessa soma porque o item não tem custo cadastrado no estoque.
          </div>
        )}
      </Card>

      {/* A LISTA. "Uma lista de tudo que saiu sem vender, com nomes e valores
          de custo." Cada linha: o que foi, quanto, quem (se tem), quem
          lançou, quando e quanto custou. Tocar num balde do placar filtra. */}
      <Card data-lista-sem-vender style={{ marginBottom: 14, padding: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Tudo que saiu sem vender</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {[['', 'Tudo'], ...CATEGORIAS_SAIDA].map(([v, rot]) => (
            <button key={v || 'tudo'} data-filtro={v || 'tudo'} onClick={() => { setFiltroCat(v); setVerTudo(false); }} style={{
              border: `1px solid ${filtroCat === v ? C.accent : C.line}`, background: filtroCat === v ? C.accent : 'transparent',
              color: filtroCat === v ? '#06101F' : C.muted, borderRadius: 999, padding: '6px 11px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
            }}>{rot}</button>
          ))}
        </div>
        {filtrada.length === 0 ? (
          <div style={{ fontSize: 13, color: C.faint, padding: '6px 0' }}>{filtroCat ? `Nada de ${NOME_CAT[filtroCat].toLowerCase()} em ${mesLabel(mes)}.` : `Nada saiu sem vender em ${mesLabel(mes)}.`}</div>
        ) : (
          <>
            {visiveis.map((l) => (
              <div key={l.id} data-saida={l.categoria} style={{ display: 'flex', gap: 10, padding: '9px 0', borderTop: `1px solid ${C.hair}`, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, overflowWrap: 'anywhere' }}>{l.nome}</div>
                  <div style={{ fontSize: 11.5, color: C.faint, marginTop: 2, lineHeight: 1.45 }}>
                    <span style={{ color: COR_CAT[l.categoria], fontWeight: 800 }}>{NOME_CAT[l.categoria]}</span>
                    {l.motivo && l.motivo.toLowerCase() !== NOME_CAT[l.categoria].toLowerCase() && !/^cortesia$|^consumo da casa$/i.test(l.motivo) ? ` (${l.motivo.toLowerCase()})` : ''}
                    {' · '}{qtdTxt(l)}{l.quem ? `${l.quem} · ` : ''}{l.por ? `lançado por ${l.por} · ` : ''}{quando(l)}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: l.custo == null ? C.faint : C.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{l.custo == null ? 'sem custo' : brl(l.custo)}</div>
              </div>
            ))}
            {filtrada.length > visiveis.length && (
              <button onClick={() => setVerTudo(true)} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 13, fontWeight: 800, cursor: 'pointer', padding: '8px 0 0' }}>Ver todas as {filtrada.length}</button>
            )}
            <div data-lista-total style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.line}`, marginTop: 6, paddingTop: 9, fontSize: 13.5, fontWeight: 900 }}>
              <span>{filtrada.length} {filtrada.length === 1 ? 'saída' : 'saídas'}{filtroCat ? ` de ${NOME_CAT[filtroCat].toLowerCase()}` : ''}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{brl(somaFiltrada)}</span>
            </div>
          </>
        )}
      </Card>

      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Cortesia / Consumo da casa</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Deu um produto de graça (cortesia) ou a casa consumiu? Escolha o produto do cardápio (narguilé, drink…) e o sistema baixa os ingredientes da ficha sozinho. Não mexe no caixa nem no DRE.</div>
      </Card>

      {msg && <Card style={{ marginBottom: 12, borderColor: C.green }}><div style={{ color: C.green, fontSize: 14, fontWeight: 700 }}>✓ {msg}</div></Card>}
      {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{erro}</div>}

      <Field label="O que foi?">
        <div style={{ display: 'flex', gap: 6 }}>
          {MOTIVOS.map(([v, rot]) => (
            <button key={v} onClick={() => setMotivo(v)} style={{ flex: 1, border: `1px solid ${motivo === v ? C.accent : C.line}`, background: motivo === v ? C.accent : 'transparent', color: motivo === v ? '#06101F' : C.muted, borderRadius: 9, padding: '9px 8px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{rot}</button>
          ))}
        </div>
      </Field>

      <Field label="Qual produto?">
        <TextInput value={busca} onChange={setBusca} placeholder="Buscar (ex.: Narguilé)" />
      </Field>
      {!carregado ? <Empty>Carregando…</Empty> : (
        <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lista.length === 0 ? <Empty>Nenhum produto encontrado.</Empty> : lista.slice(0, 60).map((i) => (
            <button key={i.id} onClick={() => { setSelId(i.id); setSabor(''); setErro(''); }} style={{
              textAlign: 'left', border: `1px solid ${selId === i.id ? C.accent : C.line}`,
              background: selId === i.id ? C.accent : C.panel, color: selId === i.id ? '#06101F' : C.text,
              borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontSize: 14, fontWeight: 700,
            }}>{i.nome}</button>
          ))}
        </div>
      )}

      {sel && (
        <Card style={{ borderColor: C.accent }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{sel.nome}</div>
          {/* A fruta do sabor não está na ficha: numa venda ela é um "extra".
              Sem escolher aqui, o maracujá que foi pro copo continuaria
              contado no estoque. */}
          {Array.isArray(sel.sabores) && sel.sabores.length > 0 && (
            <Field label="Qual sabor?">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {sel.sabores.map((sv) => {
                  const nome = sv.nome || '';
                  const on = sabor === nome;
                  return (
                    <button key={nome} onClick={() => setSabor(on ? '' : nome)} style={{
                      border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accent : 'transparent',
                      color: on ? '#06101F' : C.muted, borderRadius: 999, padding: '7px 13px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}>{nome}</button>
                  );
                })}
              </div>
            </Field>
          )}
          <Field label="Quantas?"><NumInput value={qtd} onChange={setQtd} /></Field>
          {/* No consumo da casa o nome é obrigatório — é o motivo de a tela
              existir. Na cortesia ele ajuda a saber quem liberou. Na perda,
              não: o drink que caiu no chão às vezes não tem dono mesmo. */}
          {motivo !== 'Perda' && (
            <QuemPegou valor={quem} onChange={setQuem}
              titulo={motivo === 'Consumo da casa' ? 'Quem pegou?' : 'Quem liberou?'}
              aviso={motivo === 'Consumo da casa' ? '(precisa dizer)' : '(opcional)'} />
          )}
          <Btn onClick={registrar} disabled={busy || (motivo === 'Consumo da casa' && !quem.trim())}>
            {busy ? 'Registrando…' : `Registrar ${motivo.toLowerCase()}`}
          </Btn>
        </Card>
      )}

      {/* OS ÚLTIMOS LANÇAMENTOS, com o desfazer.
          Um erro de digitação aqui tira mercadoria do estoque e não tinha
          volta: nem a lista existia. Mostrar os últimos é metade do conserto —
          ela vê na hora que saiu 11 em vez de 1. */}
      {ultimos.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <SecTitle>Últimos lançamentos</SecTitle>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {ultimos.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderTop: i ? `1px solid ${C.hair}` : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.text, overflowWrap: 'anywhere' }}>
                    {c.qtd}× {c.prato}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.faint, fontWeight: 700, marginTop: 2 }}>
                    {c.motivo}{c.quem ? ` · ${c.quem}` : ''}{c.data ? ` · ${fmtDate(c.data)}` : ''}
                  </div>
                </div>
                {podeDesfazer && (
                  <Btn kind="ghost" small onClick={() => desfazer(c)} disabled={busy}>desfazer</Btn>
                )}
              </div>
            ))}
          </Card>
          {!podeDesfazer && (
            <div style={{ fontSize: 11.5, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
              Quem desfaz um lançamento desses é a dona.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
