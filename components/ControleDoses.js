'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, Btn, Empty, SecTitle, PageTitle, TextInput, QtdInput } from './ui';
import { brl, num, numQtd, todayISO, ymOf, fmtDate, uid, limparNome } from '../lib/util';
import {
  lerConfig, embalagemDe, quantoTem, doseDe, resultadoContagem, ultimoDe,
  padroes, resumoDoMes, vigiados, diasDesde, ehMedido, TOLERANCIA_PCT,
} from '../lib/controleDoses';

// A TELA DO CONTROLE DE DOSES. O porquê de cada regra está em
// lib/controleDoses.js; aqui é só o caminho dos dedos:
//
//   1. "Acabou a garrafa" — um toque na garrafa, um número (quantas fechadas
//      sobraram), e a resposta em doses e reais.
//   2. "Conferência da semana" — as 5 que mais giram: fechadas + a altura da
//      aberta, tocando na garrafa desenhada.
//
// Nenhum dos dois mostra o que o sistema espera ANTES de ela contar.

const COR = { partida: C.accent, bateu: C.green, pouco: C.amber, sumiu: C.red, sobrou: '#6AA9FF' };
const fmtQtd = (v) => String(Math.round((Number(v) || 0) * 100) / 100).replace('.', ',');
const plural = (n, um, varios) => (Math.abs(Number(n)) === 1 ? um : varios);

// "4 doses de Cuba" / "3 copos" — a palavra certa pra dose é a do produto.
const emDoses = (r) => {
  if (r.doses == null) return `${fmtQtd(Math.abs(r.diferenca))} ${r.unidade}`;
  const n = fmtQtd(r.doses);
  return `${n} ${plural(r.doses, 'dose', 'doses')}${r.doseNome ? ` de ${r.doseNome}` : ''}`;
};

// A frase do resultado. Uma por estado, em português de balcão.
function frase(r) {
  if (r.estado === 'partida') {
    return `Primeira contagem. O estoque dizia ${fmtQtd(r.esperado)} ${r.unidade} e tu contou ${fmtQtd(r.contado)} — acertei. Daqui pra frente eu vigio.`;
  }
  if (r.estado === 'bateu') return 'Bateu. O que saiu da garrafa passou pela comanda.';
  if (r.estado === 'sobrou') {
    return `Tem ${emDoses(r)} A MAIS do que devia. Quase sempre é compra que não foi lançada, ou ficha gastando mais do que o copo leva.`;
  }
  const dinheiro = r.venda > 0 ? `${brl(r.venda)} que não entrou no caixa` : `${brl(r.custo)} de custo`;
  const base = `Sumiram ${emDoses(r)} — ${dinheiro}.`;
  return r.estado === 'pouco'
    ? `${base} É ${fmtQtd(r.pct)}% do que saiu: dentro do que mão pesada explica.`
    : `${base} É ${fmtQtd(r.pct)}% do que saiu — acima dos ${TOLERANCIA_PCT}% que mão pesada explica.`;
}

// A GARRAFA DE TOCAR. Dez fatias: toca na altura do líquido. É assim que o
// mercado conta garrafa aberta — décimo é o que o olho consegue, e pedir
// mililitro seria pedir um número inventado com cara de exato.
function Garrafa({ nivel, onNivel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
      <div role="group" aria-label="Altura da garrafa aberta"
        style={{ width: 46, border: `2px solid ${C.line}`, borderRadius: '10px 10px 8px 8px', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse', background: C.panel2 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button key={n} onClick={() => onNivel(nivel === n ? n - 1 : n)} title={`${n} de 10`} aria-label={`${n} de 10`}
            style={{ height: 15, border: 'none', borderTop: n === 10 ? 'none' : `1px solid color-mix(in srgb, ${C.line} 60%, transparent)`, background: nivel != null && n <= nivel ? C.accent : 'transparent', cursor: 'pointer', padding: 0 }} />
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.45, paddingBottom: 2 }}>
        {nivel == null ? 'Toca na altura do líquido' : nivel === 0 ? 'Nenhuma aberta' : <><b style={{ color: C.text }}>{nivel} de 10</b> na aberta</>}
        <div>
          <button onClick={() => onNivel(0)} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '4px 0 0' }}>não tem aberta</button>
        </div>
      </div>
    </div>
  );
}

// O PASSO É CALCULADO EM CIMA DO VALOR DE AGORA, não do que a tela mostrava
// quando o botão foi desenhado. Dois toques rápidos no "+" liam o mesmo número
// velho e somavam um só — e contagem que come toque é contagem errada.
// O primeiro toque sai do "?" pro zero: zero precisa ser dito, não presumido.
const passo = (v, d) => {
  const n = (v === '' || v === undefined || v === null) ? null : Math.max(0, Math.floor(Number(v) || 0));
  return String(n == null ? 0 : Math.max(0, n + d));
};

function Passo({ valor, onDelta, rotulo }) {
  const n = (valor === '' || valor === undefined || valor === null) ? null : Math.max(0, Math.floor(Number(valor) || 0));
  const bt = { width: 38, height: 38, borderRadius: 10, border: `1px solid ${C.line}`, background: 'transparent', color: C.text, fontSize: 20, fontWeight: 800, cursor: 'pointer', lineHeight: 1 };
  return (
    <div>
      <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 700, marginBottom: 5 }}>{rotulo}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={bt} aria-label="menos" onClick={() => onDelta(-1)}>–</button>
        <span style={{ minWidth: 34, textAlign: 'center', fontSize: 20, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: n == null ? C.faint : C.text }}>{n == null ? '?' : n}</span>
        <button style={bt} aria-label="mais" onClick={() => onDelta(1)}>+</button>
      </div>
    </div>
  );
}

function Resultado({ r }) {
  const cor = COR[r.estado] || C.muted;
  return (
    <div style={{ borderLeft: `4px solid ${cor}`, background: `color-mix(in srgb, ${cor} 9%, transparent)`, borderRadius: 8, padding: '9px 12px', marginTop: 8 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{limparNome(r.nome)}</div>
      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginTop: 2 }}>{frase(r)}</div>
    </div>
  );
}

export default function ControleDoses({ estoque = [], fichas = [], cardapio = [], vendas = [], compras = [], controle, onControle, onAcao, onRepor, antigas = [] }) {
  const cfg = useMemo(() => lerConfig(controle), [controle]);
  const hoje = todayISO();
  const [modo, setModo] = useState('acabou');       // 'acabou' | 'semana'
  const [busca, setBusca] = useState('');
  const [alvoId, setAlvoId] = useState('');          // a garrafa que acabou
  const [fechadas, setFechadas] = useState('');
  const [tamanhoDito, setTamanhoDito] = useState('');
  const [semana, setSemana] = useState({});          // { [id]: { cheias, nivel } }
  const [saidas, setSaidas] = useState([]);          // resultados desta sessão
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [reposto, setReposto] = useState('');

  const lista = useMemo(() => vigiados({ estoque, fichas, vendas, hoje, config: cfg }), [estoque, fichas, vendas, hoje, cfg]);
  const idsVigiados = useMemo(() => new Set(lista.map((x) => x.item.id)), [lista]);

  // Pra "acabou": as vigiadas primeiro, depois qualquer coisa do estoque que
  // tenha ficha (é o que a comanda baixa). A busca acha o resto.
  const comFicha = useMemo(() => {
    const ids = new Set();
    for (const f of fichas) for (const ing of (f && Array.isArray(f.itens) ? f.itens : [])) if (ing && ing.estoqueId) ids.add(ing.estoqueId);
    return ids;
  }, [fichas]);
  const candidatos = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const todos = estoque.filter((it) => it && it.id && !it.separar && (idsVigiados.has(it.id) || comFicha.has(it.id)));
    const filtrados = t ? todos.filter((it) => (it.nome || '').toLowerCase().includes(t)) : todos.filter((it) => idsVigiados.has(it.id));
    return filtrados.sort((a, b) => (idsVigiados.has(b.id) ? 1 : 0) - (idsVigiados.has(a.id) ? 1 : 0) || (a.nome || '').localeCompare(b.nome || '')).slice(0, 12);
  }, [estoque, busca, idsVigiados, comFicha]);

  const alvo = estoque.find((it) => it.id === alvoId) || null;
  const embAlvo = alvo ? embalagemDe(alvo, compras, cfg.tamanhos) : null;

  const salvarCfg = (parcial) => onControle({ ...cfg, ...parcial });

  // CONTA E GRAVA. O estoque é acertado pro que ela contou — senão a mesma
  // dose que faltou hoje faltaria de novo em toda contagem até o fim dos
  // tempos. E o registro guarda a diferença ANTES do acerto, que depois dele
  // não existe mais em lugar nenhum.
  const contar = async (itensContados, tipo, cfgBase) => {
    const novos = [];
    let estoqueVivo = estoque;
    for (const { item, contado, tamanho } of itensContados) {
      const atual = estoqueVivo.find((x) => x.id === item.id) || item;
      const r = resultadoContagem({
        item: atual, contado, tamanho,
        dose: doseDe(atual, fichas, cardapio, vendas, hoje),
        anterior: ultimoDe(cfgBase.registros, atual.id),
      });
      const j = await onAcao({ acao: 'mov', id: atual.id, tipo: 'contagem', qtd: contado, motivo: 'Controle de doses' });
      if (!j || !j.ok) { setErro((j && j.erro) || `Não consegui gravar a contagem de ${limparNome(atual.nome)}. Tenta de novo.`); break; }
      if (Array.isArray(j.itens)) estoqueVivo = j.itens;
      novos.push({ id: uid(), data: hoje, ts: Date.now() + novos.length, tipo, ...r });
    }
    if (novos.length) {
      // Guarda as 400 mais novas: dá uns anos de contagem semanal, e o painel
      // não cresce pra sempre.
      onControle({ ...cfgBase, registros: [...novos, ...cfgBase.registros].slice(0, 400) });
      setSaidas(novos);
    }
    return novos;
  };

  const confirmarAcabou = async () => {
    if (!alvo || busy) return;
    setErro(''); setReposto('');
    let cfgBase = cfg;
    let emb = embAlvo;
    if (!emb) {
      const t = numQtd(tamanhoDito);
      if (!(t > 0)) { setErro(`Diz quanto vem em cada embalagem de ${limparNome(alvo.nome)}.`); return; }
      cfgBase = { ...cfg, tamanhos: { ...cfg.tamanhos, [alvo.id]: t } };
      emb = { tamanho: t, origem: 'dito' };
    }
    if (fechadas === '') { setErro('Diz quantas fechadas sobraram — pode ser zero.'); return; }
    setBusy(true);
    // Acabou: a aberta vale zero, sem olhômetro.
    const feitos = await contar([{ item: alvo, contado: quantoTem({ cheias: fechadas, nivel: 0 }, emb.tamanho), tamanho: emb.tamanho }], 'acabou', cfgBase);
    setBusy(false);
    if (feitos.length) { setAlvoId(''); setFechadas(''); setTamanhoDito(''); setBusca(''); }
  };

  const prontosDaSemana = lista
    .map((x) => ({ ...x, emb: embalagemDe(x.item, compras, cfg.tamanhos), c: semana[x.item.id] || {} }))
    .filter((x) => x.emb && x.c.cheias !== undefined && x.c.cheias !== '' && x.c.nivel != null);

  const confirmarSemana = async () => {
    if (busy || !prontosDaSemana.length) return;
    setErro(''); setReposto('');
    setBusy(true);
    const feitos = await contar(prontosDaSemana.map((x) => ({ item: x.item, contado: quantoTem(x.c, x.emb.tamanho), tamanho: x.emb.tamanho })), 'semanal', cfg);
    setBusy(false);
    if (feitos.length) setSemana({});
  };

  const setS = (id, parcial) => setSemana((s) => ({ ...s, [id]: { ...(s[id] || {}), ...parcial } }));

  const repor = (r) => {
    if (!onRepor) return;
    const add = onRepor([{ id: uid(), nome: limparNome(r.nome), quantidade: '', categoria: 'Bebida alcoólica', comprado: false, criadoEm: Date.now() }]);
    setReposto(add === 0 ? `${limparNome(r.nome)} já estava na lista de compras.` : `${limparNome(r.nome)} foi pra lista de compras.`);
  };

  const mes = resumoDoMes(cfg.registros, ymOf(hoje));
  const repetidos = padroes(cfg.registros);
  const ultimaSemanal = cfg.registros.filter((r) => r.tipo === 'semanal').sort((a, b) => (b.ts || 0) - (a.ts || 0))[0] || null;
  const diasSemConferir = diasDesde(ultimaSemanal && ultimaSemanal.ts);
  const historico = cfg.registros.slice(0, 25);

  const pill = (on) => ({
    border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accent : 'transparent', color: on ? '#06101F' : C.muted,
    borderRadius: 999, padding: '8px 15px', fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
  });

  return (
    <div>
      <PageTitle sub="O que saiu da garrafa × o que passou pela comanda">Controle de doses</PageTitle>

      {/* O PLACAR DO MÊS. Só aparece depois que existe contagem de verdade —
          um "R$ 0,00 sumido" antes disso seria um elogio que ninguém mereceu. */}
      {mes.contagens > 0 && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Sumiu neste mês</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: mes.custo > 0 ? C.red : C.green, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>{brl(mes.custo)}</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2, lineHeight: 1.45 }}>
            de custo, em {mes.faltando} de {mes.contagens} {plural(mes.contagens, 'contagem', 'contagens')}
            {mes.venda > 0 && <> · a preço de venda, uns <b style={{ color: C.text }}>{brl(mes.venda)}</b></>}
          </div>
        </Card>
      )}

      {repetidos.length > 0 && (
        <Card style={{ marginBottom: 12, borderColor: C.red }}>
          <div style={{ fontSize: 12, color: C.red, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Faltando toda vez</div>
          {repetidos.map((p) => (
            <div key={p.estoqueId} style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 3 }}>
              <b>{limparNome(p.nome)}</b>: faltou nas últimas {p.seguidas} contagens — {fmtQtd(p.doses)} {plural(p.doses, 'dose', 'doses')}, {brl(p.custo)} de custo.
            </div>
          ))}
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.45, marginTop: 4 }}>
            Uma vez é ruído. Toda vez é dose servida sem comanda, dose maior que a da ficha, ou ficha errada.
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => { setModo('acabou'); setErro(''); }} style={pill(modo === 'acabou')}>Acabou a garrafa</button>
        <button onClick={() => { setModo('semana'); setErro(''); }} style={pill(modo === 'semana')}>Conferência da semana</button>
      </div>

      {erro && <div style={{ fontSize: 13, color: C.red, fontWeight: 700, marginBottom: 10 }}>{erro}</div>}

      {saidas.length > 0 && (
        <Card style={{ marginBottom: 14, padding: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.accent }}>Resultado</div>
          {saidas.map((r) => <Resultado key={r.id} r={r} />)}
          {reposto && <div style={{ fontSize: 12.5, color: C.green, fontWeight: 700, marginTop: 8 }}>{reposto}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {onRepor && saidas.length === 1 && saidas[0].tipo === 'acabou' && !reposto && (
              <Btn small onClick={() => repor(saidas[0])}>Pôr na lista de compras</Btn>
            )}
            <Btn kind="ghost" small onClick={() => { setSaidas([]); setReposto(''); }}>Fechar</Btn>
          </div>
        </Card>
      )}

      {modo === 'acabou' && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 10 }}>
            A garrafa ou o barril esvaziou? Toca nela e diz <b style={{ color: C.text }}>quantas fechadas sobraram</b>. Eu comparo com o que passou pela comanda.
          </div>
          {!alvo ? (
            <>
              <div style={{ marginBottom: 10 }}><TextInput value={busca} onChange={setBusca} placeholder="Procurar outra garrafa…" /></div>
              {candidatos.length === 0
                ? <Empty>{busca.trim() ? 'Nada com esse nome que tenha ficha técnica.' : 'Ainda não tem bebida girando com ficha técnica. Procura pelo nome aí em cima.'}</Empty>
                : candidatos.map((it) => (
                  <button key={it.id} data-acabou={it.id} onClick={() => { setAlvoId(it.id); setFechadas(''); setErro(''); setSaidas([]); }}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: 'none', border: 'none', borderTop: `1px solid ${C.line}`, padding: '11px 2px', cursor: 'pointer', textAlign: 'left', color: C.text }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, minWidth: 0 }}>{limparNome(it.nome)}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: C.accent, flexShrink: 0 }}>Acabou ›</span>
                  </button>
                ))}
            </>
          ) : (
            <div data-painel="acabou">
              <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 10 }}>{limparNome(alvo.nome)}</div>
              {!embAlvo && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12.5, color: C.amber, lineHeight: 1.45, marginBottom: 6 }}>
                    Esse item é guardado em <b>{alvo.unidade}</b> e eu não sei quanto vem em cada embalagem. Diz uma vez só:
                  </div>
                  <div style={{ maxWidth: 190 }}><QtdInput value={tamanhoDito} onChange={setTamanhoDito} placeholder={`quantos ${alvo.unidade} por embalagem`} /></div>
                </div>
              )}
              {embAlvo && ehMedido(alvo) && (
                <div style={{ fontSize: 12, color: C.faint, marginBottom: 10 }}>Cada embalagem: {fmtQtd(embAlvo.tamanho)} {alvo.unidade}</div>
              )}
              <Passo valor={fechadas} onDelta={(d) => setFechadas((v) => passo(v, d))} rotulo="Quantas FECHADAS sobraram na prateleira?" />
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <Btn onClick={confirmarAcabou} disabled={busy}>{busy ? 'Conferindo…' : 'Conferir'}</Btn>
                <Btn kind="ghost" onClick={() => { setAlvoId(''); setErro(''); }}>Voltar</Btn>
              </div>
            </div>
          )}
        </Card>
      )}

      {modo === 'semana' && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 4 }}>
            As garrafas que mais giraram no mês. Pra cada uma: <b style={{ color: C.text }}>quantas fechadas</b> e <b style={{ color: C.text }}>a altura da aberta</b>. A que tu não contar eu pulo.
          </div>
          <div style={{ fontSize: 12, color: diasSemConferir != null && diasSemConferir >= 7 ? C.amber : C.faint, marginBottom: 10 }}>
            {diasSemConferir == null ? 'Nenhuma conferência da semana feita ainda.'
              : diasSemConferir === 0 ? 'Última conferência: hoje.'
                : `Última conferência: há ${diasSemConferir} ${plural(diasSemConferir, 'dia', 'dias')}${diasSemConferir >= 7 ? ' — já passou da hora.' : '.'}`}
          </div>
          {lista.length === 0 ? (
            <Empty>Ainda não dá pra saber quais garrafas giram mais: falta venda de bebida com ficha técnica nos últimos 30 dias.</Empty>
          ) : lista.map((x) => {
            const it = x.item;
            const emb = embalagemDe(it, compras, cfg.tamanhos);
            const c = semana[it.id] || {};
            return (
              <div key={it.id} data-item={it.id} style={{ borderTop: `1px solid ${C.line}`, padding: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, minWidth: 0 }}>{limparNome(it.nome)}</div>
                  <button onClick={() => salvarCfg({ fora: [...cfg.fora.filter((i) => i !== it.id), it.id], extras: cfg.extras.filter((i) => i !== it.id) })}
                    style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>não vigiar</button>
                </div>
                {!emb ? (
                  <div style={{ fontSize: 12.5, color: C.amber, lineHeight: 1.45, marginTop: 4 }}>
                    Guardado em {it.unidade}, e eu não sei quanto vem em cada embalagem. Marca um "Acabou" dele uma vez, que lá eu pergunto.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 22, alignItems: 'flex-end', marginTop: 10, flexWrap: 'wrap' }}>
                    <Passo valor={c.cheias} onDelta={(d) => setSemana((m) => ({ ...m, [it.id]: { ...(m[it.id] || {}), cheias: passo((m[it.id] || {}).cheias, d) } }))} rotulo="Fechadas" />
                    <Garrafa nivel={c.nivel == null ? null : c.nivel} onNivel={(n) => setS(it.id, { nivel: n })} />
                  </div>
                )}
              </div>
            );
          })}
          {lista.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Btn onClick={confirmarSemana} disabled={busy || !prontosDaSemana.length}>
                {busy ? 'Conferindo…' : prontosDaSemana.length ? `Conferir ${prontosDaSemana.length} ${plural(prontosDaSemana.length, 'garrafa', 'garrafas')}` : 'Conta pelo menos uma'}
              </Btn>
            </div>
          )}
          {cfg.fora.length > 0 && (
            <button onClick={() => salvarCfg({ fora: [] })} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '12px 0 0', display: 'block' }}>
              voltar a vigiar as {cfg.fora.length} que eu tirei
            </button>
          )}
        </Card>
      )}

      <SecTitle>Últimas contagens</SecTitle>
      {historico.length === 0 ? (
        <Empty>Nenhuma contagem ainda.<br />A primeira de cada garrafa só acerta o estoque. Da segunda em diante eu te digo o que sumiu.</Empty>
      ) : historico.map((r) => (
        <div key={r.id} style={{ borderLeft: `4px solid ${COR[r.estado] || C.line}`, padding: '7px 11px', marginBottom: 7, background: C.panel, borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5 }}>
            <b style={{ minWidth: 0 }}>{limparNome(r.nome)}</b>
            <span style={{ color: C.faint, fontSize: 11.5, flexShrink: 0 }}>{fmtDate(r.data)} · {r.tipo === 'acabou' ? 'acabou' : 'semana'}</span>
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.45, marginTop: 1 }}>{frase(r)}</div>
        </div>
      ))}

      {/* O diário antigo não some: o que ela anotou continua aqui, só de leitura. */}
      {antigas.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ fontSize: 12.5, color: C.faint, fontWeight: 700, cursor: 'pointer' }}>Anotações antigas de garrafa ({antigas.length})</summary>
          {antigas.slice(0, 40).map((g) => (
            <div key={g.id} style={{ fontSize: 12.5, color: C.muted, borderTop: `1px solid ${C.line}`, padding: '6px 0' }}>
              <b style={{ color: C.text }}>{g.produto}</b> · {num(g.volume)} ml · aberta {fmtDate(g.dataAbertura)}{g.dataTermino ? ` · encerrada ${fmtDate(g.dataTermino)}` : ' · sem data de fim'}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
