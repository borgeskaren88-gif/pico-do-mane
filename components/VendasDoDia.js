'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, Empty, PageTitle, TextInput } from './ui';
import { brl, num, fmtDate, diaOperacional } from '../lib/util';

// O QUE FOI VENDIDO, COMANDA POR COMANDA, NO DIA QUE ELA ESCOLHER.
//
// "Eu quero ver exatamente o que vendi por comanda no dia tal, tem como?"
//
// Tinha — o dado estava guardado desde sempre, cada comanda fechada leva a lista
// de itens junto. O que não existia era tela. O mais perto disso vivia escondido
// dentro da Auditoria, que é a tela de caçar lançamento repetido e apagar venda
// de teste, e mesmo lá só dava pra ver "Mesa 5 · Pix · R$ 184,00": o total da
// mesa, nunca o que a mesa comeu.
//
// Então quando alguém perguntava "o que foi que a mesa 7 consumiu sábado?", a
// resposta do app era o total e mais nada — e ela ficava com a pergunta.
//
// Aqui a conta abre inteira: cada comanda com os itens, a hora que sentou e a
// hora que pagou, quem fechou, como pagou. Mais o resumo do dia por produto,
// que responde a outra pergunta ("quanto saiu de batata no sábado?") sem ter
// que somar as mesas na mão.

const horaDe = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
};

// Quanto tempo a mesa ficou sentada. Só aparece quando as duas pontas existem —
// comanda antiga não guardava a hora de abrir.
const duracao = (abertaEm, fechadaEm) => {
  if (!abertaEm || !fechadaEm) return '';
  const ms = new Date(fechadaEm) - new Date(abertaEm);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const min = Math.round(ms / 60000);
  const h = Math.floor(min / 60);
  return h > 0 ? `${h}h${min % 60 ? ` ${min % 60}min` : ''}` : `${min}min`;
};

// "Sábado, 26 de setembro". Às 12h nenhum fuso do Brasil muda o dia.
const diaPorExtenso = (iso) => {
  try {
    const t = new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    // Maiúscula só na primeira letra. O CSS `capitalize` escrevia "Sábado, 26
    // De Setembro", com o "De" no meio — que não é português, é etiqueta.
    return t.charAt(0).toUpperCase() + t.slice(1);
  } catch { return iso; }
};

const qtdDe = (it) => Number(it && it.qtd) || 0;
const precoDe = (it) => Number(it && it.preco) || 0;

// Junta linhas repetidas do mesmo produto dentro da comanda: duas batatas
// lançadas em momentos diferentes viram "2× Batata", que é como ela lê.
function itensJuntos(itens) {
  const m = new Map();
  for (const it of Array.isArray(itens) ? itens : []) {
    const q = qtdDe(it);
    if (q <= 0) continue;
    const nome = it.nome || '—';
    const chave = `${nome}|${precoDe(it)}`;
    const cur = m.get(chave) || { nome, preco: precoDe(it), qtd: 0 };
    cur.qtd += q;
    m.set(chave, cur);
  }
  return [...m.values()].sort((a, b) => b.qtd * b.preco - a.qtd * a.preco);
}

// Uma linha por produto, somando TODAS as comandas do dia.
function produtosDoDia(vendas) {
  const m = new Map();
  for (const v of vendas) {
    for (const it of Array.isArray(v.itens) ? v.itens : []) {
      const q = qtdDe(it);
      if (q <= 0) continue;
      const nome = it.nome || '—';
      const cur = m.get(nome) || { nome, qtd: 0, total: 0, comandas: new Set() };
      cur.qtd += q;
      cur.total += q * precoDe(it);
      cur.comandas.add(v.id);
      m.set(nome, cur);
    }
  }
  return [...m.values()].map((p) => ({ ...p, comandas: p.comandas.size })).sort((a, b) => b.total - a.total);
}

const Linha = ({ esq, dir, cor, forte }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, padding: '3px 0', lineHeight: 1.45 }}>
    <span style={{ minWidth: 0, color: cor || C.text, fontWeight: forte ? 700 : 400 }}>{esq}</span>
    <span style={{ flexShrink: 0, color: cor || C.muted, fontVariantNumeric: 'tabular-nums', fontWeight: forte ? 800 : 400 }}>{dir}</span>
  </div>
);

export default function VendasDoDia({ vendas = [] }) {
  const [dia, setDia] = useState(() => diaOperacional());
  const [visao, setVisao] = useState('comanda'); // 'comanda' | 'produto'
  const [busca, setBusca] = useState('');

  // Os dias que têm comanda fechada, do mais novo pro mais velho. Serve pras
  // setinhas: pular pro dia anterior COM movimento é o que ela quer, e não cair
  // numa segunda-feira fechada e achar que o app perdeu as vendas.
  const diasComVenda = useMemo(
    () => [...new Set(vendas.map((v) => v.data).filter(Boolean))].sort().reverse(),
    [vendas],
  );

  const doDia = useMemo(
    () => vendas.filter((v) => v.data === dia).sort((a, b) => (a.fechadaEm || '').localeCompare(b.fechadaEm || '')),
    [vendas, dia],
  );

  const termo = busca.trim().toLowerCase();
  // A busca vale pras duas visões: digitar "batata" mostra as comandas que
  // levaram batata; digitar "5" ou um nome mostra aquela mesa.
  const filtradas = useMemo(() => {
    if (!termo) return doDia;
    return doDia.filter((v) => {
      const cabecalho = `mesa ${v.mesa || ''} ${v.nome || ''} ${v.pagamento || ''}`.toLowerCase();
      if (cabecalho.includes(termo)) return true;
      return (Array.isArray(v.itens) ? v.itens : []).some((it) => String(it.nome || '').toLowerCase().includes(termo));
    });
  }, [doDia, termo]);

  const prods = useMemo(() => produtosDoDia(filtradas), [filtradas]);

  const resumo = useMemo(() => {
    const total = filtradas.reduce((s, v) => s + (Number(v.total) || 0), 0);
    const pessoas = filtradas.reduce((s, v) => s + (Number(v.pessoas) || 0), 0);
    const itens = prods.reduce((s, p) => s + p.qtd, 0);
    const fiado = filtradas.reduce((s, v) => s + (Number(v.fiado) || 0), 0);
    return { total, pessoas, itens, fiado, comandas: filtradas.length };
  }, [filtradas, prods]);

  const irPara = (passo) => {
    // Anda pela lista de dias QUE TÊM venda. Se o dia de hoje não está nela
    // (ainda não fechou comanda), entra pelo mais próximo.
    const i = diasComVenda.indexOf(dia);
    if (i === -1) { if (diasComVenda.length) setDia(diasComVenda[0]); return; }
    const alvo = diasComVenda[i + passo];
    if (alvo) setDia(alvo);
  };
  const i = diasComVenda.indexOf(dia);
  const temAnterior = i === -1 ? diasComVenda.length > 0 : i < diasComVenda.length - 1;
  const temSeguinte = i > 0;

  const seta = (ativo) => ({
    background: 'none', border: `1px solid ${C.line}`, color: ativo ? C.accent : C.faint,
    borderRadius: 9, padding: '8px 13px', fontSize: 15, fontWeight: 800,
    cursor: ativo ? 'pointer' : 'default', flexShrink: 0, lineHeight: 1,
  });

  return (
    <div>
      <PageTitle sub="Cada comanda fechada, com tudo o que saiu nela">Vendas do dia</PageTitle>

      <Card style={{ marginBottom: 12, padding: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => temAnterior && irPara(1)} style={seta(temAnterior)} aria-label="Dia anterior com venda">‹</button>
          <input
            type="date" value={dia} max={diaOperacional()} onChange={(e) => setDia(e.target.value)}
            style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 9, padding: '9px 10px', fontSize: 14, flex: 1, minWidth: 150 }}
          />
          <button type="button" onClick={() => temSeguinte && irPara(-1)} style={seta(temSeguinte)} aria-label="Dia seguinte com venda">›</button>
        </div>
        {/* O dia escrito por extenso. O campo de data desenha no formato do
            aparelho, e "09/26/2026" num celular configurado em inglês já é
            confusão garantida — aqui não sobra dúvida de que dia ela está
            olhando, nem de que dia da semana foi. */}
        <div style={{ fontSize: 14, fontWeight: 800, color: C.accent, marginTop: 8 }}>
          {diaPorExtenso(dia)}
        </div>
        <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4, lineHeight: 1.45 }}>
          As setinhas pulam direto pro dia anterior <b>que teve movimento</b> — segunda fechada não aparece como dia vazio.
          {' '}O dia vira às 6h da manhã, então a madrugada de sábado ainda conta como sábado.
        </div>
      </Card>

      {doDia.length === 0 ? (
        <Empty>
          Nenhuma comanda fechada em {fmtDate(dia)}.
          {diasComVenda.length > 0 && <><br />A última com movimento foi {fmtDate(diasComVenda[0])}.</>}
        </Empty>
      ) : (
        <>
          <Card style={{ marginBottom: 12, padding: '12px 14px' }}>
            {/* Grade, não fila que quebra: em tela de celular os quatro números
                se acomodam em duas colunas certinhas, em vez de o último cair
                sozinho numa linha órfã. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(86px, 1fr))', gap: 12 }}>
              {[
                ['Comandas', String(resumo.comandas)],
                ['Vendido', brl(resumo.total)],
                ['Itens', String(resumo.itens)],
                ['Pessoas', resumo.pessoas > 0 ? String(resumo.pessoas) : '—'],
              ].map(([t, v]) => (
                <div key={t}>
                  <div style={{ fontSize: 10.5, color: C.faint, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>{t}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: t === 'Vendido' ? C.green : C.text, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                </div>
              ))}
            </div>
            {resumo.fiado > 0.005 && (
              <div style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginTop: 8, lineHeight: 1.45 }}>
                Desse total, {brl(resumo.fiado)} ficou no fiado — não entrou no caixa.
              </div>
            )}
          </Card>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {[['comanda', 'Por comanda'], ['produto', 'Por produto']].map(([v, rot]) => (
              <button key={v} onClick={() => setVisao(v)} style={{
                border: `1px solid ${visao === v ? C.accent : C.line}`,
                background: visao === v ? C.accent : 'transparent',
                color: visao === v ? '#06101F' : C.muted,
                borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
              }}>{rot}</button>
            ))}
          </div>

          <div style={{ marginBottom: 12 }}>
            <TextInput value={busca} onChange={setBusca} placeholder="Buscar produto, mesa ou nome…" />
          </div>

          {filtradas.length === 0 && <Empty>Nada com “{busca}” em {fmtDate(dia)}.</Empty>}

          {visao === 'produto' && prods.length > 0 && (
            <Card style={{ padding: 14 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: C.accent, marginBottom: 8 }}>
                O que saiu em {fmtDate(dia)} ({resumo.itens} item(ns))
              </div>
              {prods.map((p) => (
                <div key={p.nome} style={{ borderTop: `1px solid ${C.hair}`, paddingTop: 7, marginTop: 7 }}>
                  <Linha
                    esq={<><b style={{ fontVariantNumeric: 'tabular-nums' }}>{p.qtd}×</b> {p.nome}</>}
                    dir={brl(p.total)}
                  />
                  <div style={{ fontSize: 11, color: C.faint }}>em {p.comandas} comanda(s)</div>
                </div>
              ))}
            </Card>
          )}

          {visao === 'comanda' && filtradas.map((v) => {
            const itens = itensJuntos(v.itens);
            const subtotal = Number(v.subtotal) || itens.reduce((s, it) => s + it.qtd * it.preco, 0);
            const servico = Number(v.servico) || 0;
            const desconto = Number(v.desconto) || 0;
            const fiado = Number(v.fiado) || 0;
            const tempo = duracao(v.abertaEm, v.fechadaEm);
            const pags = Array.isArray(v.pagamentos) ? v.pagamentos.filter((p) => p && (Number(p.valor) || 0) > 0.005) : [];
            return (
              <Card key={v.id} style={{ marginBottom: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 15.5, fontWeight: 900, minWidth: 0 }}>
                    Mesa {v.mesa || '—'}
                    {v.nome ? <span style={{ color: C.muted, fontWeight: 600, fontSize: 13 }}> · {v.nome}</span> : null}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: C.green, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {brl(Number(v.total) || 0)}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.5, marginTop: 1 }}>
                  {horaDe(v.abertaEm) ? `sentou ${horaDe(v.abertaEm)} · ` : ''}
                  {horaDe(v.fechadaEm) ? `pagou ${horaDe(v.fechadaEm)}` : 'hora não guardada'}
                  {tempo ? ` · ficou ${tempo}` : ''}
                  {Number(v.pessoas) > 0 ? ` · ${v.pessoas} pessoa(s)` : ''}
                  {v.fechadaPor ? ` · fechou ${v.fechadaPor}` : ''}
                </div>

                <div style={{ marginTop: 10, background: C.panel2, borderRadius: 10, padding: '9px 12px' }}>
                  {itens.length === 0 ? (
                    // Comanda fechada sem item é venda lançada direto no total
                    // (ou conta de teste). Dizer isso é melhor do que mostrar um
                    // quadrado vazio e deixar ela achando que o app perdeu algo.
                    <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.45 }}>
                      Esta comanda foi fechada sem item lançado — só o valor.
                    </div>
                  ) : itens.map((it, k) => (
                    <div key={`${it.nome}-${k}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, padding: '3px 0', lineHeight: 1.45 }}>
                      <span style={{ minWidth: 0 }}>
                        <b style={{ fontVariantNumeric: 'tabular-nums' }}>{it.qtd}×</b> {it.nome}
                        {it.preco > 0 && <span style={{ color: C.faint, fontSize: 11.5 }}> · {brl(it.preco)} cada</span>}
                      </span>
                      <span style={{ flexShrink: 0, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{brl(it.qtd * it.preco)}</span>
                    </div>
                  ))}
                </div>

                {/* A conta de chegar no total. Só aparece o que existiu nesta
                    comanda — linha de desconto zerado é ruído. */}
                <div style={{ marginTop: 8 }}>
                  {(servico > 0.005 || desconto > 0.005) && <Linha esq="Soma dos itens" dir={brl(subtotal)} />}
                  {servico > 0.005 && <Linha esq="Serviço 10%" dir={`+ ${brl(servico)}`} />}
                  {desconto > 0.005 && <Linha esq={`Desconto${v.descontoPct ? ` ${v.descontoPct}%` : ''}`} dir={`− ${brl(desconto)}`} cor={C.amber} />}
                  <Linha esq="Total" dir={brl(Number(v.total) || 0)} forte />
                </div>

                <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
                  {pags.length > 1
                    ? <>Pagou dividido: {pags.map((p) => `${p.forma} ${brl(Number(p.valor) || 0)}`).join(' · ')}</>
                    : <>Pagou em <b style={{ color: C.text }}>{v.pagamento || (pags[0] && pags[0].forma) || '—'}</b></>}
                  {fiado > 0.005 && <span style={{ color: C.amber, fontWeight: 700 }}> · {brl(fiado)} no fiado</span>}
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
