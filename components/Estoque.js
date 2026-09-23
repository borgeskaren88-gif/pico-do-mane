'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Select, Empty, Resumo, SecTitle, PageTitle, inputStyle, QtdInput } from './ui';
import { brl, num, fmtDate, limparNome, todayISO, diaOperacional, CATEGORIAS_PRODUTO, numQtd } from '../lib/util';
import { UNIDADES, UNIDADES_CONTEUDO, MOTIVOS_SAIDA, igualNome, diasParaVencer, nivelValidade, textoValidade, itensVencendo, gruposDuplicados, fatorEntre, leituraDeReposicao, curvaABC, ordenarLotes, coberturaEmDias, insumosComUnidadeSolta, conteudoContradiz, comprasComCustoEstranho, conversaoDaReceita, ehPorcionado, linhaDe, salvaDe } from '../lib/estoque';
import { painelDasPorcoes, consumoPorSaco, porcoesSemFicha } from '../lib/porcoes';
import { prazoDeEntregaDoProduto } from '../lib/cotacao';
import EntradaPorVoz from './EntradaPorVoz';

const itemVazio = () => ({ nome: '', categoria: '', unidade: 'un', saldo: '', minimo: '', custo: '', conteudo: '', conteudoUnid: '', validade: '',
  // Porcionamento: o item que e separado em sacos (batata 400 g) aponta
  // pro pacote fechado de onde ele sai, e diz quanto cada saco leva.
  sepAtivo: false, sepBrutoId: '', sepGramas: '', sepUnidade: 'g', sepMinLinha: '5', sepMinSalva: '5' });

// A regra de porcionamento montada a partir do formulario. `null` desliga — e e
// o null que faz o item voltar a ser um item comum, sem freezer nenhum.
const regraDeSeparar = (f) => ((f.sepAtivo && f.sepBrutoId && numQtd(f.sepGramas) > 0)
  ? { brutoId: f.sepBrutoId, gramas: numQtd(f.sepGramas), unidade: f.sepUnidade || 'g', minLinha: num(f.sepMinLinha), minSalva: num(f.sepMinSalva) }
  : null);

// A cor de quem está pra vencer. Vermelho é "usa hoje ou perde"; amarelo ainda
// dá pra encaixar num prato ou numa promoção.
const CORES_VAL = { vencido: '#FF5A5A', urgente: '#FF5A5A', atencao: '#F5A524' };

// Mostra a quantidade no jeito brasileiro: vírgula no decimal e ponto no milhar.
// Sem isso, um saldo fracionário (ex.: barril de chopp em 1.817) parecia "1817".
const fmtQtd = (v) => Number(num(v).toFixed(3)).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

// Aba Estoque: catálogo de itens com saldo, mínimo, custo e "conteúdo por
// unidade" (pra diluir garrafa em doses). Toda mudança de saldo passa por ações
// atômicas na API (/api/estoque), pra ficar em sincronia com a baixa feita ao
// fechar as comandas — nada é sobrescrito.
// Pente fino: o mesmo produto cadastrado duas vezes com nomes diferentes.
// Só aponta — juntar é decisão dela, porque "Coca Cola" e "Coca Cola Zero"
// são parecidos e não são a mesma coisa.
function PenteFino({ grupos, onJuntar, onIgnorar, ocupado }) {
  const [escolha, setEscolha] = useState({}); // { [chave]: principalId }
  if (!grupos.length) return null;
  const certos = grupos.filter((g) => g.nivel === 'certo').length;
  return (
    <Card style={{ marginBottom: 14, borderColor: C.amber }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.amber, marginBottom: 4 }}>
        Produtos repetidos ({grupos.length})
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
        O mesmo produto cadastrado mais de uma vez racha o saldo: a receita baixa de um e a compra soma no outro, e
        nenhum dos dois diz a verdade. {certos > 0 && <>{certos} {certos > 1 ? 'são nomes iguais' : 'é nome igual'} — esses podem juntar sem medo. </>}
        Escolha qual nome fica e junte. Nada se perde: o saldo soma, o histórico vem junto e as receitas passam a apontar pro que ficou.
      </div>
      {grupos.map((g) => {
        const principalId = escolha[g.chave] || g.principalId;
        const principal = g.itens.find((x) => x.id === principalId) || g.itens[0];
        const somaria = g.itens.reduce((s, it) => {
          const f = it.unidade === principal.unidade ? 1 : fatorEntre(it.unidade, principal.unidade);
          return f == null ? s : s + num(it.saldo) * f;
        }, 0);
        const travados = g.itens.filter((it) => it.id !== principalId && it.unidade !== principal.unidade && fatorEntre(it.unidade, principal.unidade) == null);
        const podeJuntar = g.itens.some((it) => it.id !== principalId && !travados.includes(it));
        return (
          <div key={g.chave} style={{ borderTop: `1px solid ${C.hair}`, paddingTop: 10, marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', color: g.nivel === 'certo' ? C.red : C.amber, marginBottom: 6 }}>
              {g.nivel === 'certo' ? 'MESMO NOME' : 'NOMES PARECIDOS — CONFERE'}
            </div>
            {g.itens.map((it) => (
              <label key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                <input
                  type="radio" name={`dup-${g.chave}`} checked={it.id === principalId}
                  onChange={() => setEscolha((m) => ({ ...m, [g.chave]: it.id }))}
                  style={{ width: 15, height: 15, accentColor: C.accent, flexShrink: 0 }}
                />
                <span style={{ fontSize: 13.5, color: it.id === principalId ? C.text : C.muted, fontWeight: it.id === principalId ? 700 : 400, minWidth: 0 }}>
                  {it.nome}
                  <span style={{ color: C.faint, fontWeight: 400 }}>
                    {' · '}{fmtQtd(it.saldo)} {it.unidade || 'un'}{num(it.custo) > 0 ? ` · ${brl(num(it.custo))}` : ''}
                  </span>
                </span>
              </label>
            ))}
            <div style={{ fontSize: 12, color: C.muted, margin: '6px 0 8px', lineHeight: 1.5 }}>
              Fica <b style={{ color: C.text }}>{principal.nome}</b> com <b style={{ color: C.text }}>{fmtQtd(somaria)} {principal.unidade || 'un'}</b>.
              {travados.length > 0 && (
                <span style={{ color: C.amber }}>
                  {' '}{travados.map((t) => t.nome).join(', ')} fica{travados.length > 1 ? 'm' : ''} de fora: está em {travados.map((t) => t.unidade || 'un').join('/')} e não dá pra somar com {principal.unidade || 'un'}.
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn small onClick={() => onJuntar(g, principalId)} kind={podeJuntar ? 'primary' : 'ghost'}>
                Juntar em {principal.nome}
              </Btn>
              <Btn small kind="ghost" onClick={() => onIgnorar(g)}>Não são iguais</Btn>
            </div>
          </div>
        );
      })}
      {ocupado && <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>Juntando…</div>}
    </Card>
  );
}

export default function Estoque({ itens = [], carregado = true, onAcao, compras = [], cotacoes = [], fichas = [], cardapio = [], duplicadosIgnorados = [], onRepor }) {
  const [novo, setNovo] = useState(itemVazio());
  const [editId, setEditId] = useState(null);
  const [acao, setAcao] = useState(null);   // { id, tipo: 'entrada'|'saida'|'contagem' }
  const [acaoQtd, setAcaoQtd] = useState('');
  const [acaoMotivo, setAcaoMotivo] = useState(MOTIVOS_SAIDA[0]);
  const [acaoVal, setAcaoVal] = useState(''); // validade informada ao abastecer
  const [verMov, setVerMov] = useState(null);
  const [menuMov, setMenuMov] = useState(null); // id do movimento com o menu corrigir/desfazer aberto
  const [busca, setBusca] = useState('');
  const [reposto, setReposto] = useState('');
  const [busy, setBusy] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [msgCorrige, setMsgCorrige] = useState('');
  const [catAberta, setCatAberta] = useState({}); // { [categoria]: true } — categoria expandida
  const hoje = diaOperacional(); // mesmo 'hoje' do Darci: a madrugada conta como ontem
  const toggleCat = (cat) => setCatAberta((m) => ({ ...m, [cat]: !m[cat] }));
  const set = (k) => (v) => setNovo((f) => ({ ...f, [k]: v }));

  const corrigirCustos = async () => {
    if (corrigindo) return;
    if (typeof window !== 'undefined' && !window.confirm('Recalcular os custos do estoque pelo preço da compra mais recente de cada item?\n\nUse para consertar valores que ficaram inflados. Itens sem compra correspondente não mudam.')) return;
    setCorrigindo(true); setMsgCorrige('');
    const j = await onAcao({ acao: 'corrigirCustos' });
    setCorrigindo(false);
    if (j && j.ok) setMsgCorrige(j.corrigidos > 0 ? `${j.corrigidos} custo(s) corrigido(s) pelas compras.` : 'Nenhum custo precisou de ajuste (ou faltam compras pra comparar).');
    else setMsgCorrige('Não consegui corrigir agora. Tente de novo.');
    setTimeout(() => setMsgCorrige(''), 6000);
  };

  const totais = useMemo(() => {
    let valor = 0, baixo = 0;
    for (const it of itens) {
      valor += num(it.saldo) * num(it.custo);
      if (num(it.minimo) > 0 && num(it.saldo) <= num(it.minimo)) baixo += 1;
    }
    return { valor, baixo };
  }, [itens]);

  // Pente fino dos repetidos. Roda sobre o catálogo inteiro (não sobre o
  // filtro da busca): produto repetido não se acha procurando, se acha olhando.
  const [msgDup, setMsgDup] = useState('');
  const [fundindo, setFundindo] = useState(false);
  const duplicados = useMemo(
    () => gruposDuplicados(itens, fichas, duplicadosIgnorados),
    [itens, fichas, duplicadosIgnorados],
  );

  const juntarGrupo = async (g, principalId) => {
    if (fundindo) return;
    const principal = g.itens.find((x) => x.id === principalId) || g.itens[0];
    const outros = g.itens.filter((x) => x.id !== principalId);
    if (!outros.length) return;
    if (typeof window !== 'undefined' && !window.confirm(
      `Juntar ${outros.map((o) => o.nome).join(', ')} dentro de "${principal.nome}"?\n\n`
      + 'O saldo soma, o histórico vem junto e as receitas passam a apontar pro item que fica. Isso não tem desfazer.',
    )) return;
    setFundindo(true); setMsgDup('');
    const j = await onAcao({ acao: 'fundir', principalId, absorvidos: outros.map((o) => o.id) });
    setFundindo(false);
    if (j && j.ok) {
      const sobrou = (j.naoDeu || []).map((x) => `${x.nome} (${x.motivo})`).join('; ');
      setMsgDup(j.fundidos
        ? `Pronto: ${j.fundidos} item(ns) juntado(s) em "${principal.nome}".${sobrou ? ` Ficou de fora: ${sobrou}.` : ''}`
        : `Não juntei nada.${sobrou ? ` Motivo: ${sobrou}.` : ''}`);
    } else setMsgDup('Não consegui juntar agora. Tenta de novo.');
    setTimeout(() => setMsgDup(''), 12000);
  };

  const ignorarGrupo = async (g) => {
    await onAcao({ acao: 'ignorarDuplicado', chave: g.chave });
  };

  // ---- Onde o dinheiro está, e quando repor ----
  const [verDinheiro, setVerDinheiro] = useState(false);
  const abc = useMemo(() => curvaABC(itens, hoje), [itens, hoje]);
  // Mínimos que não batem com o consumo real. Só entram os que têm cotação com
  // prazo de entrega — sem saber quanto o fornecedor demora, o sugerido seria
  // chute com cara de conta.
  const reposicao = useMemo(() => itens.map((it) => {
    const prazo = prazoDeEntregaDoProduto(cotacoes, it.nome);
    if (!(prazo > 0)) return null;
    const l = leituraDeReposicao(it, prazo, hoje);
    return (l.estado === 'baixo' || l.estado === 'sem-minimo' || l.estado === 'alto') ? { it, prazo, ...l } : null;
  }).filter(Boolean).sort((a, b) => (a.cobertura ?? 999) - (b.cobertura ?? 999)), [itens, cotacoes, hoje]);

  const aplicarSugerido = async (r) => {
    if (busy) return;
    await onAcao({ acao: 'edit', id: r.it.id, campos: { nome: r.it.nome, categoria: r.it.categoria, unidade: r.it.unidade, minimo: r.sugerido, custo: num(r.it.custo), conteudo: num(r.it.conteudo), conteudoUnid: r.it.conteudoUnid, validade: r.it.validade } });
  };

  const abaixoDoMin = useMemo(() => itens.filter((it) => num(it.minimo) > 0 && num(it.saldo) <= num(it.minimo)), [itens]);
  // O que está pra vencer nos próximos 7 dias (e o que já venceu).
  const vencendo = useMemo(() => itensVencendo(itens, hoje, 7), [itens, hoje]);

  // "Para onde foi o estoque" no mês atual: junta as saídas de todos os itens e
  // separa por tipo (venda, perda/quebra, consumo da casa, outros), com o valor
  // em R$ (qtd baixada × custo do item). Lê o histórico que cada item já guarda.
  const [periodoSaidas, setPeriodoSaidas] = useState('mes'); // 'hoje' | 'mes'
  const saidasMes = useMemo(() => {
    // Aqui é o dia do CALENDÁRIO de propósito: compara com a data gravada em
    // cada movimento, que é do calendário. Usar o dia operacional faria o
    // filtro "hoje" não achar nada entre meia-noite e as 6h.
    const hoje = todayISO();
    const ym = hoje.slice(0, 7);
    const noPeriodo = (data) => (periodoSaidas === 'hoje' ? data === hoje : data.slice(0, 7) === ym);
    const cats = {
      vendas: { valor: 0, n: 0, itens: {} },
      perdas: { valor: 0, n: 0, itens: {} },
      consumo: { valor: 0, n: 0, itens: {} },
      cortesia: { valor: 0, n: 0, itens: {} },
      outros: { valor: 0, n: 0, itens: {} },
    };
    const catDe = (m) => {
      if (m.tipo === 'venda') return 'vendas';
      if (m.tipo !== 'saida') return null;
      const mo = (m.motivo || '').toLowerCase();
      if (/(perda|desperd|quebr|congel|estrag|venc)/.test(mo)) return 'perdas';
      if (/cortesia/.test(mo)) return 'cortesia';
      if (/(consumo|uso|casa)/.test(mo)) return 'consumo';
      if (/venda/.test(mo)) return 'vendas';
      return 'outros';
    };
    for (const it of itens) {
      for (const m of (it.movimentos || [])) {
        if (!m.data || !noPeriodo(m.data)) continue;
        const c = catDe(m);
        if (!c) continue;
        const val = num(m.qtd) * num(it.custo);
        cats[c].valor += val; cats[c].n += 1;
        const e = cats[c].itens[it.nome] || { valor: 0, qtd: 0, unidade: it.unidade || '' };
        e.valor += val; e.qtd += num(m.qtd);
        cats[c].itens[it.nome] = e;
      }
    }
    const total = cats.vendas.valor + cats.perdas.valor + cats.consumo.valor + cats.cortesia.valor + cats.outros.valor;
    const listaDe = (c) => Object.entries(c.itens).map(([nome, d]) => ({ nome, ...d })).sort((a, b) => b.valor - a.valor);
    return { cats, total, listaDe, temAlgo: (cats.vendas.n + cats.perdas.n + cats.consumo.n + cats.cortesia.n + cats.outros.n) > 0 };
  }, [itens, periodoSaidas]);
  const [verSaidas, setVerSaidas] = useState(false);
  const [catSaidaAberta, setCatSaidaAberta] = useState('');

  // Produtos já comprados que ainda não estão no estoque (sugestões).
  const sugestoes = useMemo(() => {
    const noEstoque = new Set(itens.map((it) => limparNome(it.nome).toLowerCase()));
    const map = new Map();
    for (const c of compras) {
      const nome = limparNome(c.produto);
      if (!nome) continue;
      const chave = nome.toLowerCase();
      if (noEstoque.has(chave)) continue;
      const anterior = map.get(chave);
      if (!anterior || (c.data || '') >= (anterior.data || '')) map.set(chave, { nome, categoria: c.categoria || '', custo: c.valorUnit || '', data: c.data || '' });
    }
    return [...map.values()].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [compras, itens]);

  const grupos = useMemo(() => {
    const filtro = busca.trim().toLowerCase();
    const ordem = [...CATEGORIAS_PRODUTO, ''];
    const map = new Map();
    for (const it of itens) {
      if (filtro && !(it.nome || '').toLowerCase().includes(filtro)) continue;
      const cat = it.categoria || '';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(it);
    }
    return [...map.entries()].sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
      .map(([cat, is]) => ({ cat: cat || 'Sem categoria', itens: is.sort((x, y) => (x.nome || '').localeCompare(y.nome || '')) }));
  }, [itens, busca]);

  const salvarItem = async () => {
    if (!novo.nome.trim() || busy) return;
    setBusy(true);
    if (editId) {
      await onAcao({ acao: 'edit', id: editId, campos: { nome: novo.nome, categoria: novo.categoria, unidade: novo.unidade || 'un', minimo: num(novo.minimo), custo: num(novo.custo), conteudo: num(novo.conteudo), conteudoUnid: novo.conteudoUnid, validade: novo.validade, separar: regraDeSeparar(novo) } });
    } else {
      await onAcao({ acao: 'add', item: { nome: novo.nome, categoria: novo.categoria, unidade: novo.unidade || 'un', saldo: num(novo.saldo), minimo: num(novo.minimo), custo: num(novo.custo), conteudo: num(novo.conteudo), conteudoUnid: novo.conteudoUnid, validade: novo.validade, separar: regraDeSeparar(novo), salva: num(novo.saldo) } });
    }
    setNovo(itemVazio()); setEditId(null); setBusy(false);
  };

  const editar = (it) => {
    setEditId(it.id);
    setNovo({ nome: it.nome || '', categoria: it.categoria || '', unidade: it.unidade || 'un', saldo: '', minimo: String(it.minimo ?? ''), custo: String(it.custo ?? ''), conteudo: String(it.conteudo ?? ''), conteudoUnid: it.conteudoUnid || '', validade: it.validade || '',
      sepAtivo: !!(it.separar && it.separar.brutoId), sepBrutoId: it.separar?.brutoId || '', sepGramas: String(it.separar?.gramas ?? ''),
      sepUnidade: it.separar?.unidade || 'g', sepMinLinha: String(it.separar?.minLinha ?? '5'), sepMinSalva: String(it.separar?.minSalva ?? '5') });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelar = () => { setNovo(itemVazio()); setEditId(null); };
  const excluir = async (id) => { if (!window.confirm('Excluir este item do estoque?')) return; if (id === editId) cancelar(); await onAcao({ acao: 'del', id }); };
  // "Desfazer": reverte o movimento no saldo (o que saiu volta; o que entrou
  // sai) E tira a linha. É o que usar quando o lançamento foi errado.
  const desfazerMov = async (itemId, movId) => {
    if (typeof window !== 'undefined' && !window.confirm('Desfazer este movimento?\n\nA quantidade volta ao estoque (ou sai, se era uma entrada). Use quando o lançamento foi errado.')) return;
    await onAcao({ acao: 'estornarMov', id: itemId, movId });
    setMenuMov(null);
  };
  // "Só apagar": tira a linha do histórico mas NÃO mexe no saldo — pra limpar um
  // registro antigo cujo saldo já foi acertado no Contar (ex.: some do resumo).
  const excluirMov = async (itemId, movId) => {
    if (typeof window !== 'undefined' && !window.confirm('Só apagar esta linha do histórico?\n\nO saldo de hoje NÃO muda — isso só tira o registro do resumo "Para onde foi". (Se você quer a quantidade de volta, use "Desfazer".)')) return;
    await onAcao({ acao: 'delMov', id: itemId, movId });
    setMenuMov(null);
  };

  const adicionarSugestao = async (s) => {
    if (itens.some((it) => igualNome(it.nome, s.nome)) || busy) return;
    setBusy(true);
    const j = await onAcao({ acao: 'add', item: { nome: s.nome, categoria: s.categoria, unidade: 'un', saldo: 0, custo: num(s.custo) } });
    setBusy(false);
    if (j && j.novoId) abrirAcao(j.novoId, 'contagem');
  };

  const abrirAcao = (id, tipo, motivo) => { setAcao({ id, tipo }); setAcaoQtd(''); setAcaoMotivo(motivo || MOTIVOS_SAIDA[0]); setAcaoVal(''); };
  const fecharAcao = () => { setAcao(null); setAcaoQtd(''); setAcaoVal(''); };
  const confirmarAcao = async () => {
    if (String(acaoQtd).trim() === '' || busy) return;
    const q = numQtd(acaoQtd);
    if (acao.tipo !== 'contagem' && !(q > 0)) return;
    setBusy(true);
    await onAcao({ acao: 'mov', id: acao.id, tipo: acao.tipo, qtd: q, motivo: acao.tipo === 'saida' ? acaoMotivo : undefined, validade: acao.tipo === 'entrada' ? acaoVal : undefined });
    setBusy(false); fecharAcao();
  };

  // Conteúdo que briga com a própria unidade do item, conferido enquanto ela
  // digita — o campo é opcional e errá-lo não dá erro nenhum na hora.
  const contradiz = useMemo(() => {
    const r = conteudoContradiz({ unidade: novo.unidade, conteudo: numQtd(novo.conteudo), conteudoUnid: novo.conteudoUnid });
    return r ? { ...r, conteudo: numQtd(novo.conteudo) } : null;
  }, [novo.unidade, novo.conteudo, novo.conteudoUnid]);

  // Itens onde a NOTA diz um custo e o item diz outro. O CMV usa o da nota, e
  // esse segundo custo não aparecia em tela nenhuma.
  const custoEstranho = useMemo(() => comprasComCustoEstranho(itens, compras), [itens, compras]);

  // O quadro das porções: onde estão os sacos e o que falta separar.
  const porcoes = useMemo(() => painelDasPorcoes(itens), [itens]);

  // Porção que a ficha ainda não usa: e a venda continua comendo do pacote
  // fechado, contando a mesma batata duas vezes.
  const semFichaPorcao = useMemo(() => porcoesSemFicha(itens, fichas), [itens, fichas]);

  // Só faz sentido sair de um item que NÃO é ele mesmo e que não é, ele
  // próprio, um saco já separado — senão o pacote viraria filho do saco.
  const opcoesBruto = useMemo(() => itens
    .filter((it) => it.id !== editId && !ehPorcionado(it))
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
    .map((it) => ({ value: it.id, label: `${it.nome} (${it.unidade || 'un'})` })), [itens, editId]);

  // A prévia do rendimento, conferida enquanto ela digita. É aqui que um erro
  // de unidade aparece ANTES de virar custo errado: se o saco de 400 g sai de
  // um item contado em `un`, não existe conversão e o sistema chutaria 1 por 1.
  const previaSeparar = useMemo(() => {
    if (!novo.sepAtivo || !novo.sepBrutoId || !(numQtd(novo.sepGramas) > 0)) return null;
    const bruto = itens.find((i) => i.id === novo.sepBrutoId);
    if (!bruto) return null;
    const unidade = novo.sepUnidade || 'g';
    const conv = conversaoDaReceita(unidade, bruto);
    const porSaco = consumoPorSaco({ separar: { brutoId: bruto.id, gramas: numQtd(novo.sepGramas), unidade } }, bruto);
    const rende = porSaco > 0 ? Math.floor(num(bruto.saldo) / porSaco) : 0;
    return { bruto, porSaco, rende, chute: !conv.ok, unidade };
  }, [novo.sepAtivo, novo.sepBrutoId, novo.sepGramas, novo.sepUnidade, itens]);

  // Insumos cujo cálculo de custo está saindo por chute de unidade.
  const unidadeSolta = useMemo(() => insumosComUnidadeSolta(fichas, itens, cardapio), [fichas, itens, cardapio]);

  // Abastecer falando: todas as linhas conferidas entram numa gravação só.
  const lancarLote = (entradas) => onAcao({ acao: 'movLote', entradas, motivo: 'Entrada por voz' });

  const reporNaLista = (lista) => {
    if (!onRepor) return;
    const add = onRepor(lista.map((it) => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), nome: it.nome, quantidade: '', categoria: it.categoria || '', comprado: false, criadoEm: Date.now() })));
    setReposto(add === 0 ? 'Já estavam na Lista de Compras.' : `${add} item(ns) adicionado(s) à Lista de Compras.`);
    setTimeout(() => setReposto(''), 3000);
  };

  const rotuloAcao = { entrada: 'Entrada', saida: 'Saída', contagem: 'Contagem' };

  return (
    <div>
      <Resumo items={[
        { t: 'Itens', v: itens.length },
        { t: 'Abaixo do mínimo', v: totais.baixo, c: totais.baixo ? C.red : C.faint },
        { t: 'Valor em estoque', v: brl(totais.valor), c: C.green },
      ]} />

      <PageTitle sub="Quanto você tem, o que está acabando e quanto está parado em mercadoria">Estoque</PageTitle>

      {reposto && <Card style={{ marginBottom: 12, borderColor: C.green }}><div style={{ fontSize: 14, color: C.green, fontWeight: 700 }}>{reposto}</div></Card>}

      {/* UNIDADE SOLTA — o erro mais caro que o sistema consegue cometer em
          silêncio. A receita pede ml, o item está em pote, e ninguém disse
          quantos ml tem o pote: aí 300 ml viram 300 POTES e um prato de R$ 30
          passa a custar vinte e um mil reais. O conserto é no ITEM (preencher
          o conteúdo), por isso o aviso mora aqui e não na tela das fichas. */}
      {unidadeSolta.length > 0 && (
        <Card style={{ marginBottom: 12, borderColor: C.red }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.red, marginBottom: 4 }}>
            Falta dizer o conteúdo ({unidadeSolta.length})
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
            A receita pede <b style={{ color: C.text }}>uma medida</b> (ml, g) e o item está cadastrado por <b style={{ color: C.text }}>embalagem</b> (pote, pacote).
            Sem dizer quanto cabe na embalagem, o sistema conta cada mililitro como um pote inteiro — e o custo do prato estoura.
          </div>
          {unidadeSolta.map((p) => {
            const it = itens.find((x) => x.id === p.estoqueId);
            return (
              <div key={p.estoqueId} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10, marginTop: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{limparNome(p.nome)}</div>
                {/* O conselho TEM que ser específico. "Preenche o conteúdo"
                    é conselho errado quando a receita pede em grama e o item
                    está em litro: peso e volume não se convertem, e nenhum
                    conteúdo em ml resolve isso. */}
                <div style={{ fontSize: 12, color: C.muted, margin: '4px 0 6px', lineHeight: 1.5 }}>
                  A receita pede em <b style={{ color: C.text }}>{p.unidadeReceita}</b> e o item está em <b style={{ color: C.text }}>{p.unidadeItem}</b>.
                  {p.temConteudo && ` O conteúdo está em ${p.conteudoUnid}, que não é o que a receita pede.`}
                </div>
                <div style={{ fontSize: 12, color: C.muted, margin: '0 0 6px', lineHeight: 1.5 }}>
                  Dois caminhos, escolhe um: cadastrar o item <b style={{ color: C.text }}>em {p.unidadeReceita}</b> (com o custo por {p.unidadeReceita}),
                  ou preencher o conteúdo de cada {p.unidadeItem} <b style={{ color: C.text }}>em {p.unidadeReceita}</b> — tem que ser nessa medida, que é a que a receita usa.
                </div>
                <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 8, lineHeight: 1.45 }}>
                  Está inflando <b style={{ color: C.red }}>{brl(p.custoGerado)}</b> em {p.produtos.length} produto(s): {p.produtos.slice(0, 4).join(', ')}{p.produtos.length > 4 ? '…' : ''}.
                </div>
                {it && <Btn small onClick={() => editar(it)}>Arrumar {limparNome(p.nome)}</Btn>}
              </div>
            );
          })}
        </Card>
      )}

      {/* A NOTA BRIGANDO COM O ITEM. Vem antes do resto porque envergava o CMV
          inteiro sem aparecer em lugar nenhum: o item mostrava um custo e o
          CMV calculava com outro, reconstruído das notas. */}
      {custoEstranho.length > 0 && (
        <Card style={{ marginBottom: 12, borderColor: C.red }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.red, marginBottom: 4 }}>
            A nota discorda do item ({custoEstranho.length})
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
            O CMV não usa o custo que tu cadastrou aqui — ele refaz o custo de cada mês <b style={{ color: C.text }}>pelas notas de compra daquele mês</b>, pra cada mês sair com o preço da época.
            Quando os dois brigam muito, quase sempre é a <b style={{ color: C.text }}>embalagem faltando na nota</b>.
          </div>
          {custoEstranho.map((p) => (
            <div key={p.estoqueId} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10, marginTop: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{limparNome(p.nome)}</div>
              <div style={{ fontSize: 12, color: C.muted, margin: '5px 0 6px', lineHeight: 1.5 }}>
                Aqui está <b style={{ color: C.text }}>{brl(p.custoItem)}</b> por {p.unidade} · a nota diz <b style={{ color: C.red }}>{brl(p.custoCompras)}</b> por {p.unidade}
                {' '}— <b style={{ color: C.text }}>{p.vezes}×</b> {p.notaMaisCara ? 'mais caro' : 'mais barato'}. O CMV está usando o da nota.
              </div>
              {p.semEmbalagem > 0 ? (
                <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.45 }}>
                  {p.semEmbalagem} de {p.totalNotas} nota(s) deste produto estão <b style={{ color: C.muted }}>sem dizer o que vem na embalagem</b>.
                  {' '}Vai em <b style={{ color: C.muted }}>Compras</b> e preenche “Cada um tem” nelas — barril de 30 L, caixa de 12 un.
                </div>
              ) : (
                <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.45 }}>
                  As notas têm embalagem preenchida, então o preço mudou mesmo. Confere o custo cadastrado aqui — ou roda “Corrigir custos”.
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      <EntradaPorVoz itens={itens} onLote={lancarLote} />

      <Card style={{ marginBottom: 12, background: C.panel2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Custos com valor estranho?</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>Recalcula o custo de cada item pelo preço da compra mais recente. Conserta valores inflados de uma vez.</div>
          </div>
          <Btn small onClick={corrigirCustos}>{corrigindo ? 'Corrigindo…' : 'Corrigir custos'}</Btn>
        </div>
        {msgCorrige && <div style={{ fontSize: 13, color: C.green, fontWeight: 700, marginTop: 8 }}>{msgCorrige}</div>}
      </Card>

      {/* Para onde foi o estoque este mês: venda x perda x consumo da casa. */}
      <Card style={{ marginBottom: 14 }}>
        <button onClick={() => setVerSaidas((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
          <span style={{ color: C.accent, fontSize: 12, fontWeight: 800, width: 12, flexShrink: 0 }}>{verSaidas ? '▾' : '▸'}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Para onde foi o estoque</span>
            <span style={{ fontSize: 12, color: C.muted, display: 'block', marginTop: 1 }}>{periodoSaidas === 'hoje' ? 'Hoje' : 'Este mês'} · saídas por venda, perda e consumo da casa</span>
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(saidasMes.total)}</span>
        </button>
        {verSaidas && (
          <div style={{ marginTop: 12, borderTop: `1px solid ${C.hair}`, paddingTop: 10 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[['hoje', 'Hoje'], ['mes', 'Este mês']].map(([v, rot]) => (
                <button key={v} onClick={() => setPeriodoSaidas(v)} style={{ border: `1px solid ${periodoSaidas === v ? C.accent : C.line}`, background: periodoSaidas === v ? C.accent : 'transparent', color: periodoSaidas === v ? '#06101F' : C.muted, borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{rot}</button>
              ))}
            </div>
            {!saidasMes.temAlgo ? (
              <div style={{ fontSize: 13, color: C.faint }}>Nenhuma saída registrada {periodoSaidas === 'hoje' ? 'hoje' : 'este mês'} ainda.</div>
            ) : (
              [
                { k: 'vendas', rot: 'Vendas', desc: 'virou prato/drink vendido', cor: C.green },
                { k: 'perdas', rot: 'Perdas e desperdício', desc: 'desperdício, vencido, quebra', cor: C.red },
                { k: 'consumo', rot: 'Consumo da casa', desc: 'consumo próprio da casa', cor: C.amber },
                { k: 'cortesia', rot: 'Cortesias', desc: 'liberadas de graça pro cliente', cor: C.accent2 },
                { k: 'outros', rot: 'Outros ajustes', desc: 'ajustes e saídas diversas', cor: C.muted },
              ].map(({ k, rot, desc, cor }) => {
                const c = saidasMes.cats[k];
                if (c.n === 0) return null;
                const aberta = catSaidaAberta === k;
                return (
                  <div key={k} style={{ borderTop: `1px solid ${C.hair}`, paddingTop: 8, marginTop: 8 }}>
                    <button onClick={() => setCatSaidaAberta(aberta ? '' : k)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: cor, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{rot}</span>
                        <span style={{ fontSize: 11, color: C.faint, display: 'block' }}>{desc} · {c.n} saída(s)</span>
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(c.valor)}</span>
                    </button>
                    {aberta && (
                      <div style={{ marginTop: 8, marginLeft: 19 }}>
                        {saidasMes.listaDe(c).map((x) => (
                          <div key={x.nome} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '3px 0', color: C.muted }}>
                            <span style={{ minWidth: 0 }}>{x.nome}</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{Number((x.qtd || 0).toFixed(3)).toLocaleString('pt-BR')} {x.unidade} · {brl(x.valor)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div style={{ fontSize: 11, color: C.faint, marginTop: 10, lineHeight: 1.4 }}>Valores estimados pelo custo de cada item. Isso não é o DRE — é só pra você ver para onde a mercadoria está indo.</div>
          </div>
        )}
      </Card>

      {msgDup && (
        <div style={{ fontSize: 13, color: C.green, fontWeight: 700, marginBottom: 12, lineHeight: 1.5 }}>{msgDup}</div>
      )}
      <PenteFino grupos={duplicados} onJuntar={juntarGrupo} onIgnorar={ignorarGrupo} ocupado={fundindo} />

      {/* ---- Quando repor: o mínimo contra o consumo de verdade ---- */}
      {reposicao.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: C.accent }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.accent, marginBottom: 4 }}>Mínimo fora do lugar ({reposicao.length})</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
            O ponto de repor não é um número redondo — é <b style={{ color: C.text }}>quanto sai por dia × quanto o fornecedor demora</b>, com folga pro
            atraso e pro fim de semana. Só aparecem aqui os produtos que têm cotação com prazo de entrega.
          </div>
          {reposicao.slice(0, 8).map((r) => (
            <div key={r.it.id} style={{ borderTop: `1px solid ${C.hair}`, padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{r.it.nome}</span>
                <span style={{ fontSize: 12, color: r.cobertura != null && r.cobertura <= r.prazo ? C.red : C.muted, flexShrink: 0 }}>
                  {r.cobertura != null ? `dura ${r.cobertura} dia(s)` : ''}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: C.faint, marginTop: 2, lineHeight: 1.45 }}>
                sai {fmtQtd(r.porDia)} {r.it.unidade || 'un'}/dia · entrega em {r.prazo} dia(s) ·
                {r.estado === 'sem-minimo' ? ' sem mínimo cadastrado' : ` mínimo hoje ${fmtQtd(r.atual)}`}
                {r.estado === 'alto' && ' — alto demais, é dinheiro parado'}
                {r.estado === 'baixo' && ' — baixo demais, vai faltar'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, color: C.text }}>sugerido: <b style={{ color: C.accent }}>{fmtQtd(r.sugerido)} {r.it.unidade || 'un'}</b></span>
                <Btn small kind="ghost" onClick={() => aplicarSugerido(r)} disabled={busy}>usar esse</Btn>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* ---- Curva ABC: onde o dinheiro está ---- */}
      {abc.linhas.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <button onClick={() => setVerDinheiro((x) => !x)} style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{verDinheiro ? '▾' : '▸'} Onde teu dinheiro está</span>
            <span style={{ fontSize: 12, color: C.muted }}>{abc.porClasse[0].itens} produto(s) são {abc.total > 0 ? Math.round((abc.porClasse[0].valor / abc.total) * 100) : 0}% do consumo</span>
          </button>
          {verDinheiro && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
                Classificado pelo que cada produto <b style={{ color: C.text }}>consome de dinheiro</b> em {abc.janela} dias — não pelo que é caro.
                Os <b style={{ color: C.red }}>A</b> mandam no teu caixa: é neles que vale negociar preço e contar o estoque.
              </div>
              {abc.porClasse.filter((c) => c.itens > 0).map((c) => (
                <div key={c.classe} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, padding: '3px 0', color: C.muted }}>
                  <span><b style={{ color: c.classe === 'A' ? C.red : c.classe === 'B' ? C.amber : C.faint }}>{c.classe}</b> · {c.itens} produto(s)</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{brl(c.valor)} em {abc.janela} dias</span>
                </div>
              ))}
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.hair}` }}>
                {abc.linhas.slice(0, 10).map((l) => (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, padding: '3px 0' }}>
                    <span style={{ minWidth: 0 }}>
                      <b style={{ color: l.classe === 'A' ? C.red : l.classe === 'B' ? C.amber : C.faint, fontSize: 11 }}>{l.classe}</b>{' '}
                      <span style={{ color: C.text }}>{l.nome}</span>
                      <span style={{ color: C.faint }}>{l.cobertura != null ? ` · dura ${l.cobertura}d` : ''}</span>
                    </span>
                    <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(l.consumoValor)}</span>
                  </div>
                ))}
              </div>
              {abc.parados.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.hair}` }}>
                  <div style={{ fontSize: 12.5, color: C.amber, fontWeight: 700 }}>
                    Parado: {brl(abc.paradoTotal)} em {abc.parados.length} produto(s)
                  </div>
                  <div style={{ fontSize: 11.5, color: C.faint, marginTop: 3, lineHeight: 1.45 }}>
                    Não saiu nada em {abc.janela} dias: {abc.parados.slice(0, 5).map((p) => `${p.nome} (${brl(p.parado)})`).join(', ')}.
                    Isso é dinheiro teu na prateleira — vale promoção ou parar de comprar.
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {vencendo.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: CORES_VAL[vencendo[0].nivel] }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: CORES_VAL[vencendo[0].nivel], marginBottom: 8 }}>
            Vencendo ({vencendo.length})
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, lineHeight: 1.45 }}>
            Usa, encaixa num prato ou faz promoção — o que vence é dinheiro que tu já pagou.
          </div>
          {/* Quando o produto tem mais de um lote, mostra os dois: "vence
              amanhã" numa lata de 14 é alarme falso se 12 vencem só em
              dezembro — e alarme falso repetido faz ela parar de olhar. */}
          {vencendo.map(({ item, dias, nivel }) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTop: `1px solid ${C.hair}`, padding: '7px 0', fontSize: 14 }}>
              <span style={{ minWidth: 0 }}>
                {item.nome}
                {(() => {
                  // Quantas unidades vencem NESTA data — e não o saldo inteiro.
                  const lotes = ordenarLotes(item.lotes);
                  if (lotes.length < 2) return null;
                  const oLote = lotes[0];
                  const resto = lotes.slice(1).reduce((t, l) => t + numQtd(l.qtd), 0);
                  return (
                    <span style={{ display: 'block', fontSize: 11.5, color: C.faint, lineHeight: 1.4 }}>
                      só {fmtQtd(oLote.qtd)} {item.unidade} deste lote — as outras {fmtQtd(resto)} vencem depois
                    </span>
                  );
                })()}
              </span>
              <span style={{ flexShrink: 0, textAlign: 'right' }}>
                <span style={{ color: CORES_VAL[nivel], fontWeight: 800 }}>{textoValidade(dias)}</span>
                <span style={{ color: C.faint, fontSize: 12 }}> · {fmtQtd(item.saldo)} {item.unidade}</span>
              </span>
            </div>
          ))}
        </Card>
      )}

      {abaixoDoMin.length > 0 && (
        <Card style={{ marginBottom: 14, borderColor: C.red }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.red }}>Acabando ({abaixoDoMin.length})</div>
            {onRepor && <Btn small onClick={() => reporNaLista(abaixoDoMin)}>Repor todos na lista</Btn>}
          </div>
          {abaixoDoMin.map((it) => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTop: `1px solid ${C.hair}`, padding: '7px 0', fontSize: 14 }}>
              <span>{it.nome}</span>
              <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{fmtQtd(it.saldo)} / mín. {fmtQtd(it.minimo)} {it.unidade}</span>
            </div>
          ))}
        </Card>
      )}

      {sugestoes.length > 0 && (
        <Card style={{ marginBottom: 14, background: C.panel2 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.accent, marginBottom: 4 }}>Começar a controlar ({sugestoes.length})</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.4 }}>
            Produtos que já apareceram nas Compras mas ainda não estão no estoque. Toque para começar a controlar (o app já pergunta quanto você tem hoje).
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sugestoes.slice(0, 24).map((s) => (
              <button key={s.nome} onClick={() => adicionarSugestao(s)} disabled={busy} style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text, borderRadius: 999, padding: '7px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: C.accent, fontWeight: 800 }}>+</span> {s.nome}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* OS DOIS FREEZERS, na visão dela.
          A cozinha tem a tela de fazer; esta é a de conferir. Mostra os mesmos
          números que eles veem, com o recado idêntico — foi o pedido: "pra eu
          poder cobrar". Cobrar por um número diferente do que a outra pessoa
          está vendo não é cobrança, é briga. */}
      {porcoes.lista.length > 0 && (
        <Card style={{ marginBottom: 18, borderColor: porcoes.aFazer.length ? C.amber : C.cardBorder }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
            Porções separadas ({porcoes.lista.length})
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.45 }}>
            {porcoes.aFazer.length === 0
              ? 'Os dois freezers estão nos mínimos. Nada pendente com a cozinha.'
              : `${porcoes.aFazer.length} produto(s) abaixo do mínimo. A cozinha está vendo esta mesma lista, com o mesmo recado.`}
          </div>
          {semFichaPorcao.length > 0 && (
            <div style={{ fontSize: 12, color: C.red, background: C.panel2, borderRadius: 10, padding: '10px 12px', marginBottom: 12, lineHeight: 1.5, fontWeight: 600 }}>
              {semFichaPorcao.map((f) => (
                <div key={f.id} style={{ marginBottom: 4 }}>
                  Nenhuma ficha técnica usa <b>{f.nome}</b> ainda
                  {f.brutoEmUso
                    ? <> — e tem ficha usando <b>{f.brutoNome}</b> direto. Enquanto for assim, a venda come do pacote fechado <b>além</b> do que a cozinha ensacou, e a mesma comida é contada duas vezes.</>
                    : <>. Põe <b>1 saco</b> de {f.nome} na ficha da porção pra venda começar a baixar da Linha de Frente.</>}
                </div>
              ))}
            </div>
          )}

          {porcoes.lista.map((p) => {
            const cor = { vazio: C.red, critico: C.red, atencao: C.amber, ok: C.green }[p.nivel];
            return (
              <div key={p.id} style={{ borderTop: `1px solid ${C.hair}`, padding: '10px 0 2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, minWidth: 0 }}>{p.nome}</div>
                  <div style={{ fontSize: 12.5, color: C.faint, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    frente <b style={{ color: p.linha < p.minLinha ? C.red : C.text }}>{fmtQtd(p.linha)}</b>
                    {' · '}fundo <b style={{ color: p.salva < p.minSalva ? C.amber : C.text }}>{fmtQtd(p.salva)}</b>
                    {p.rendeDoBruto != null && <>{' · '}dá +{p.rendeDoBruto}</>}
                  </div>
                </div>
                {p.recado && <div style={{ fontSize: 12, color: cor, fontWeight: 600, marginTop: 4, lineHeight: 1.45 }}>{p.recado}</div>}
              </div>
            );
          })}
        </Card>
      )}

      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{editId ? 'Editar item' : 'Novo item de estoque'}</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
          {editId ? 'Ajuste os dados. Para mudar a quantidade, use os botões Entrada / Saída / Contar.' : 'Cadastre um item pra controlar. Depois, as Compras somam sozinhas no saldo.'}
        </div>
        <Field label="Produto"><TextInput value={novo.nome} onChange={set('nome')} placeholder="Cerveja Original 600ml, Carne, Gin…" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
          <Field label="Categoria"><Select value={novo.categoria} onChange={set('categoria')} options={CATEGORIAS_PRODUTO} /></Field>
          <Field label="Unidade"><Select value={novo.unidade} onChange={set('unidade')} options={UNIDADES} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: editId ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
          {!editId && <Field label="Qtd que tem hoje"><QtdInput value={novo.saldo} onChange={set('saldo')} /></Field>}
          <Field label="Estoque mínimo"><NumInput value={novo.minimo} onChange={set('minimo')} /></Field>
          <Field label="Custo un. (R$)"><NumInput value={novo.custo} onChange={set('custo')} /></Field>
        </div>
        {/* Validade: opcional. Item sem data nunca entra nos avisos — cachaça
            e descartável não estragam. */}
        <Field label="Vence em (opcional)">
          <input type="date" value={novo.validade} onChange={(e) => set('validade')(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
        </Field>
        <div style={{ fontSize: 11, color: C.faint, margin: '-6px 0 12px', lineHeight: 1.4 }}>
          Só pra o que estraga. Tendo dois lotes com datas diferentes, põe <b>a mais próxima</b> — é a que vai vencer primeiro.
        </div>

        {/* Conteúdo por unidade: pra diluir garrafa em doses/taças. */}
        <Field label="Conteúdo por unidade (opcional)">
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}><NumInput value={novo.conteudo} onChange={set('conteudo')} placeholder="ex.: 1000" /></div>
            <div style={{ width: 90 }}><Select value={novo.conteudoUnid} onChange={set('conteudoUnid')} options={UNIDADES_CONTEUDO} placeholder="—" /></div>
          </div>
        </Field>
        <div style={{ fontSize: 11, color: C.faint, margin: '-6px 0 12px', lineHeight: 1.4 }}>
          Pra quem vende em fração ou usa parte da embalagem: garrafa de <b>1000 ml</b> → a ficha da taça usa <b>ml</b>; pacote de <b>50 un</b> (alumínio) → a ficha usa <b>1 un</b> e o estoque baixa o pacote certinho.
        </div>
        {/* "1 litro contém 5000 ml" é impossível, e ficava guardado em
            silêncio. O conteúdo só serve pra dizer o que tem DENTRO de uma
            embalagem — quando ele está na mesma grandeza da unidade, dá pra
            conferir a conta na hora. */}
        {contradiz && (
          <div style={{ fontSize: 12, color: C.red, background: C.panel2, borderRadius: 10, padding: '9px 12px', margin: '-6px 0 12px', lineHeight: 1.5, fontWeight: 600 }}>
            Isso diz que <b>1 {contradiz.unidade} tem {fmtQtd(contradiz.conteudo)} {contradiz.conteudoUnid}</b> — mas 1 {contradiz.unidade} são {fmtQtd(contradiz.certo)} {contradiz.conteudoUnid}.
            {' '}Se o que tu quer é dizer o tamanho da embalagem, a unidade do item tem que ser a embalagem (pote, pacote), não {contradiz.unidade}.
          </div>
        )}
        {/* PORCIONAMENTO — o pacote fechado que vira saco pronto.
            Fica no fim do formulário de propósito: é o campo mais raro, e quem
            não separa nada não precisa nem saber que ele existe. */}
        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12, marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!novo.sepAtivo} onChange={(e) => set('sepAtivo')(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--c-accent)' }} />
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>Esse item é separado em sacos</span>
          </label>
          <div style={{ fontSize: 11, color: C.faint, margin: '6px 0 0', lineHeight: 1.45 }}>
            Pra quem compra fechado e separa antes do serviço: pacote de batata → sacos de 400 g.
            O saco passa a morar em <b>dois freezers</b> (Linha de Frente e Salva-Vidas), e a cozinha
            recebe sozinha o aviso de quando separar mais.
          </div>

          {novo.sepAtivo && (
            <div style={{ marginTop: 12 }}>
              <Field label="Sai de qual pacote fechado?">
                <Select value={novo.sepBrutoId} onChange={set('sepBrutoId')} options={opcoesBruto} placeholder="Escolhe o item do estoque…" />
              </Field>
              <Field label="Cada saco leva quanto?">
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}><NumInput value={novo.sepGramas} onChange={set('sepGramas')} placeholder="ex.: 400" /></div>
                  <div style={{ width: 90 }}><Select value={novo.sepUnidade} onChange={set('sepUnidade')} options={UNIDADES_CONTEUDO} placeholder="g" /></div>
                </div>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Mínimo na Linha de Frente"><NumInput value={novo.sepMinLinha} onChange={set('sepMinLinha')} /></Field>
                <Field label="Mínimo no Salva-Vidas"><NumInput value={novo.sepMinSalva} onChange={set('sepMinSalva')} /></Field>
              </div>

              {/* A conta feita na frente dela, antes de salvar. Um erro de
                  unidade aqui é o mesmo erro do açaí e do alumínio: silencioso,
                  e só aparece semanas depois como custo estranho. */}
              {previaSeparar && (
                previaSeparar.chute ? (
                  <div style={{ fontSize: 12, color: C.red, background: C.panel2, borderRadius: 10, padding: '9px 12px', lineHeight: 1.5, fontWeight: 600 }}>
                    <b>{previaSeparar.bruto.nome}</b> é contado em <b>{previaSeparar.bruto.unidade}</b>, e não dá pra converter
                    {' '}{previaSeparar.unidade} nisso. Cadastra o pacote em kg (ou em L), ou preenche o
                    {' '}&quot;Conteúdo por unidade&quot; dele <b>em {previaSeparar.unidade}</b> — senão cada saco vai
                    {' '}descontar um pacote inteiro.
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: C.muted, background: C.panel2, borderRadius: 10, padding: '9px 12px', lineHeight: 1.5 }}>
                    Cada saco tira <b style={{ color: C.text }}>{fmtQtd(previaSeparar.porSaco)} {previaSeparar.bruto.unidade}</b> de {previaSeparar.bruto.nome}.
                    {' '}O que tem hoje ({fmtQtd(num(previaSeparar.bruto.saldo))} {previaSeparar.bruto.unidade}) dá
                    {' '}<b style={{ color: previaSeparar.rende > 0 ? C.text : C.red }}>{previaSeparar.rende} saco{previaSeparar.rende === 1 ? '' : 's'}</b>.
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={salvarItem}>{editId ? 'Salvar item' : 'Adicionar ao estoque'}</Btn>
          {editId && <Btn kind="ghost" onClick={cancelar}>Cancelar</Btn>}
        </div>
      </Card>

      <SecTitle>Meu estoque ({itens.length})</SecTitle>
      {itens.length > 6 && <div style={{ marginBottom: 12 }}><TextInput value={busca} onChange={setBusca} placeholder="Buscar item…" /></div>}
      {!carregado ? <Empty>Carregando…</Empty> : itens.length === 0 ? (
        <Empty>Seu estoque está vazio.<br />Cadastre um item acima, ou use as sugestões das suas compras. 👆</Empty>
      ) : grupos.map((g) => {
        const buscando = busca.trim().length > 0;
        const aberto = buscando || !!catAberta[g.cat];
        const valorCat = g.itens.reduce((s, it) => s + num(it.saldo) * num(it.custo), 0);
        const baixoCat = g.itens.some((it) => num(it.minimo) > 0 && num(it.saldo) <= num(it.minimo));
        return (
        <div key={g.cat} style={{ marginBottom: aberto ? 14 : 8 }}>
          <button onClick={() => toggleCat(g.cat)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: C.panel, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', boxShadow: C.cardShadow }}>
            <span style={{ color: C.accent, fontSize: 12, fontWeight: 800, width: 12, flexShrink: 0 }}>{aberto ? '▾' : '▸'}</span>
            <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em', color: C.accent, fontWeight: 800, flex: 1, minWidth: 0 }}>{g.cat}</span>
            {baixoCat && <span title="Tem item acabando" style={{ width: 8, height: 8, borderRadius: 999, background: C.red, flexShrink: 0 }} />}
            <span style={{ fontSize: 12, color: C.faint, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{g.itens.length} · {brl(valorCat)}</span>
          </button>
          {aberto && <div style={{ marginTop: 8 }}>
          {g.itens.map((it) => {
            const saldo = num(it.saldo), minimo = num(it.minimo), custo = num(it.custo);
            const baixo = minimo > 0 && saldo <= minimo;
            const aberto = verMov === it.id;
            const conteudoTxt = num(it.conteudo) > 0 && it.conteudoUnid ? ` · ${num(it.conteudo)} ${it.conteudoUnid}/${it.unidade}` : '';
            // Saco separado: o saldo grande do lado é a soma, e sozinho ele
            // não diz o que importa — se o que falta está na frente ou no fundo.
            const freezerTxt = ehPorcionado(it) ? ` · ${fmtQtd(linhaDe(it))} na frente, ${fmtQtd(salvaDe(it))} no fundo` : '';
            // Validade só conta se ainda tem o produto: o que zerou não estraga.
            const dias = saldo > 0 ? diasParaVencer(it, hoje) : null;
            const nvVal = nivelValidade(dias);
            const corVal = CORES_VAL[nvVal] || '';
            return (
              <Card key={it.id} style={{ marginBottom: 8, padding: 14, borderColor: corVal || (baixo ? C.red : C.cardBorder) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{it.nome}</div>
                    <div style={{ fontSize: 12, color: C.faint, marginTop: 3 }}>
                      {custo > 0 ? `${brl(custo)}/${it.unidade} · em estoque ${brl(saldo * custo)}` : `unidade: ${it.unidade}`}
                      {minimo > 0 ? ` · mín. ${fmtQtd(minimo)}` : ''}{conteudoTxt}{freezerTxt}
                    </div>
                    {corVal ? (
                      <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, background: `color-mix(in srgb, ${corVal} 18%, transparent)`, border: `1px solid ${corVal}`, borderRadius: 999, padding: '3px 10px' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: corVal }}>
                          {nvVal === 'vencido' ? '⚠ ' : ''}{textoValidade(dias)}
                        </span>
                        <span style={{ fontSize: 11, color: C.faint }}>{fmtDate(it.validade)}</span>
                      </div>
                    ) : null}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: baixo ? C.red : C.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fmtQtd(saldo)}</div>
                    <div style={{ fontSize: 11, color: C.faint }}>{it.unidade}{baixo ? ' · acabando' : ''}</div>
                  </div>
                </div>

                {acao && acao.id === it.id ? (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8 }}>
                      {rotuloAcao[acao.tipo]}{acao.tipo === 'contagem' ? ' — quanto tem AGORA?' : acao.tipo === 'entrada' ? ' — quanto entrou?' : ' — quanto saiu?'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ width: 170 }}><QtdInput value={acaoQtd} onChange={setAcaoQtd} placeholder={acao.tipo === 'contagem' ? String(saldo) : '0'} /></div>
                      {acao.tipo === 'saida' && <div style={{ flex: 1, minWidth: 150 }}><Select value={acaoMotivo} onChange={setAcaoMotivo} options={MOTIVOS_SAIDA} /></div>}
                      {/* Abastecendo: a hora certa de anotar a validade é essa,
                          com a embalagem na mão. */}
                      {acao.tipo === 'entrada' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 12.5, color: C.faint }}>vence em</span>
                          <input type="date" value={acaoVal} onChange={(e) => setAcaoVal(e.target.value)} style={{ ...inputStyle, width: 165, padding: '9px 10px', fontSize: 13 }} />
                        </div>
                      )}
                    </div>
                    {/* Prévia do que o sistema entendeu. Digitar "12.992" pensando
                        em 12 kg e 992 g virava doze mil — agora dá pra ver antes. */}
                    {(() => {
                      const q = numQtd(acaoQtd);
                      if (!(q > 0)) return null;
                      const depois = acao.tipo === 'contagem' ? q : acao.tipo === 'entrada' ? saldo + q : saldo - q;
                      const absurdo = q >= 1000 && saldo > 0 && q > saldo * 50;
                      return (
                        <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.5, color: absurdo ? C.amber : C.muted }}>
                          Entendi <b style={{ color: absurdo ? C.amber : C.text }}>{fmtQtd(q)} {it.unidade}</b>
                          {acao.tipo === 'contagem' ? ` — o saldo vai de ${fmtQtd(saldo)} pra ${fmtQtd(depois)} ${it.unidade}.` : ` — o saldo fica em ${fmtQtd(depois)} ${it.unidade}.`}
                          {absurdo && <><br /><b>Confere:</b> isso é bem mais que o saldo de agora. Se são gramas, escreve com <b>vírgula</b> (12,992 = 12 kg e 992 g). Com ponto, o sistema lê 12.992 como doze mil novecentos e noventa e dois.</>}
                        </div>
                      );
                    })()}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <Btn small onClick={confirmarAcao}>Confirmar</Btn>
                      <Btn kind="ghost" small onClick={fecharAcao}>Cancelar</Btn>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                    {/* Item porcionado não tem entrada nem contagem por aqui: o
                        saldo dele é a soma dos dois freezers, e mexer só no
                        total faria o item discordar de si mesmo. Quem mexe é a
                        cozinha, na tela de Porções. */}
                    {!ehPorcionado(it) && <>
                      <Btn kind="ok" small onClick={() => abrirAcao(it.id, 'entrada')}>+ Entrada</Btn>
                      <Btn kind="danger" small onClick={() => abrirAcao(it.id, 'saida')}>− Saída</Btn>
                      <Btn kind="ghost" small onClick={() => abrirAcao(it.id, 'contagem')}>Contar</Btn>
                    </>}
                    <Btn kind="ghost" small onClick={() => editar(it)}>Editar</Btn>
                    {nvVal === 'vencido' && !ehPorcionado(it) && (
                      <Btn kind="danger" small onClick={() => abrirAcao(it.id, 'saida', 'Vencido')}>jogar fora</Btn>
                    )}
                    {(it.movimentos || []).length > 0 && (
                      <button onClick={() => setVerMov(aberto ? null : it.id)} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '7px 6px' }}>{aberto ? 'ocultar' : 'histórico'}</button>
                    )}
                    <button onClick={() => excluir(it.id)} title="Excluir" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '4px 6px', marginLeft: 'auto' }}>×</button>
                  </div>
                )}

                {aberto && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${C.hair}`, paddingTop: 8 }}>
                    {(it.movimentos || []).slice(0, 15).map((m) => {
                      const podeDesfazer = ['saida', 'venda', 'entrada', 'compra'].includes(m.tipo);
                      const menu = menuMov === m.id;
                      return (
                      <div key={m.id} style={{ padding: '3px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.muted, alignItems: 'center' }}>
                          <span style={{ minWidth: 0 }}>{fmtDate(m.data)} · {m.motivo}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span style={{ fontVariantNumeric: 'tabular-nums', color: (m.tipo === 'saida' || m.tipo === 'venda') ? C.red : m.tipo === 'contagem' ? C.muted : C.green }}>
                              {(m.tipo === 'saida' || m.tipo === 'venda') ? '−' : m.tipo === 'contagem' ? '=' : '+'}{m.tipo === 'contagem' ? m.saldoDepois : num(m.qtd)} → {m.saldoDepois}
                            </span>
                            <button onClick={() => setMenuMov(menu ? null : m.id)} title="Corrigir esta linha" style={{ background: 'none', border: 'none', color: menu ? C.accent : C.faint, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>×</button>
                          </span>
                        </div>
                        {menu && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 6, marginBottom: 4 }}>
                            {podeDesfazer && <Btn kind="ok" small onClick={() => desfazerMov(it.id, m.id)}>Desfazer (volta o estoque)</Btn>}
                            <Btn kind="ghost" small onClick={() => excluirMov(it.id, m.id)}>Só apagar do histórico</Btn>
                            <Btn kind="ghost" small onClick={() => setMenuMov(null)}>Cancelar</Btn>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
          </div>}
        </div>
        );
      })}
    </div>
  );
}
