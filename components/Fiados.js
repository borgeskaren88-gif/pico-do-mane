'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { C, Card, Btn, KPI, Empty, SecTitle, PageTitle } from './ui';
import { brl, num, fmtDate, uid, diaOperacional, fiadoDaVenda, abertoDaVenda, classificarFiado } from '../lib/util';

const norm = (s) => (s || '').trim().toLowerCase();

// O fiado do Pico fecha no fim do mês e se paga do dia 01 ao 10 do seguinte.
// Se a pessoa tem conta do mês passado em aberto, junta tudo o que ela deve
// nessa cobrança; se ela só começou a consumir depois do dia 1º, fica toda pro
// mês que vem. Quem faz essa conta é classificarFiado, em lib/util.
const DIA_LIMITE = 10;

// Link do WhatsApp com a mensagem pronta. Telefone brasileiro sem o 55 ganha o
// 55 na frente; sem telefone cadastrado não dá link (aí a gente copia o texto).
const zapLink = (telefone, msg) => {
  const d = String(telefone || '').replace(/\D/g, '');
  const numero = d.length >= 12 ? d : (d.length >= 10 ? '55' + d : '');
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(msg)}` : '';
};
// Só o primeiro nome: a cobrança fica pessoal sem ficar formal demais.
const primeiroNome = (n) => (String(n || '').trim().split(/\s+/)[0] || 'tudo bem');
// Data curtinha, do jeito que se lê no zap: 01/09.
const ddmm = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : '');
// O dia 10 de qual mês: o deste mês pra quem está na cobrança de agora, o do
// mês que vem pra quem só consumiu depois que o mês virou.
const diaDoVencimento = (hoje, cobrarAgora) => {
  const [ano, mes] = hoje.split('-').map(Number);
  if (cobrarAgora) return `${hoje.slice(0, 7)}-${String(DIA_LIMITE).padStart(2, '0')}`;
  const ym = mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, '0')}`;
  return `${ym}-${String(DIA_LIMITE).padStart(2, '0')}`;
};
const msgCobranca = (nome, total, ateISO, venceISO) => (
  `Olá ${nome}!\n`
  + `Informamos que o seu débito está em ${brl(total)} correspondendo até o dia ${ddmm(ateISO)}. `
  + 'O valor está sujeito a alteração até a data do pagamento.\n\n'
  + `Lembrando a todos que o débito deve ser quitado até o dia ${ddmm(venceISO)}, `
  + 'passando da data de pagamento a conta será encerrada.'
);

const FONTE_ATRASADO = 'Recebimento Atrasado';

// Como a pessoa pagou o fiado. Os nomes são os mesmos do caixa, senão o valor
// entra no balde errado no fechamento do turno.
const FORMAS = ['Dinheiro', 'Pix', 'Crédito', 'Débito'];

// Baixa sem entrar dinheiro: a conta some da lista de quem deve, mas nada entra
// no caixa nem vira receita. É o caso do consumo de funcionário que foi
// descontado do salário, da cortesia da casa e do que a gente já sabe que não
// vem mais. Sempre com motivo, pra depois dar pra explicar o que aconteceu.
const MOTIVOS_SEM = [
  'Desconto no salário',
  'Cortesia da casa',
  'Troca / acerto',
  'Lançado por engano',
  'Não vou receber (perda)',
];

export default function Fiados({ onMudou, clientes = [], receitas = null, onReceitas = null }) {
  const [vendas, setVendas] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [verPagos, setVerPagos] = useState(false);
  const [itensAbertos, setItensAbertos] = useState({}); // { [vendaId]: true } — mostra os itens
  const [abertoCliente, setAbertoCliente] = useState({}); // { [chave]: true } — abre o histórico do cliente
  const [pagarAberto, setPagarAberto] = useState({}); // { [chave]: true } — abre o campo "receber valor"
  const [valorPago, setValorPago] = useState({}); // { [chave]: 'texto do valor' }
  const [caixaAberto, setCaixaAberto] = useState(null); // null=ainda não sei, true/false
  const [ultima, setUltima] = useState(null); // última baixa: { ref, nome, valor, semDinheiro, motivo } — pra desfazer
  const [forma, setForma] = useState({}); // { [chave]: 'Pix' } — como o cliente pagou
  const [recebendo, setRecebendo] = useState({}); // { [vendaId]: true } — escolhendo a forma de uma compra
  const [semAberto, setSemAberto] = useState({}); // { [chave]: true } — painel "baixar sem dinheiro"
  const [motivoSem, setMotivoSem] = useState({}); // { [chave]: 'Desconto no salário' }
  const [valorSem, setValorSem] = useState({}); // { [chave]: 'texto do valor' }

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/vendas', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) { setVendas(Array.isArray(j.vendas) ? j.vendas : []); setErro(''); }
      else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Sem conexão.'); }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // Saber se há caixa aberto — pra avisar antes de dar baixa (o fiado recebido só
  // entra no caixa do dia se o caixa estiver aberto na hora).
  const verCaixa = useCallback(async () => {
    try { const r = await fetch('/api/caixa', { cache: 'no-store' }); const j = await r.json(); if (j.ok) setCaixaAberto(!!j.aberto); } catch { /* ignora */ }
  }, []);
  useEffect(() => { verCaixa(); }, [verCaixa]);

  // Se não há caixa aberto, avisa e deixa a dona escolher receber assim mesmo.
  // Retorna true se pode seguir.
  const confirmaSemCaixa = () => {
    if (caixaAberto) return true;
    if (typeof window === 'undefined') return true;
    return window.confirm('Não há caixa aberto agora. Se receber assim, o valor NÃO vai entrar no caixa do dia.\n\nO ideal é abrir o caixa antes (aba Caixa) e depois dar baixa no fiado.\n\nReceber mesmo assim?');
  };

  const acao = async (payload) => {
    setBusy(true);
    try {
      const r = await fetch('/api/vendas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Erro.'); return j; }
      await carregar();
      verCaixa();
      if (onMudou) onMudou();
      return j;
    } catch { setErro('Sem conexão.'); return null; }
    finally { setBusy(false); }
  };
  // Toda baixa de fiado já entra em Receitas como "Recebimento Atrasado", na
  // data de hoje (dia operacional: madrugada conta como a noite anterior). A
  // etiqueta (ref) liga o lançamento à baixa, pra o Desfazer levar os dois.
  const lancarReceita = (ref, nome, valor, comoPagou) => {
    if (!onReceitas || !Array.isArray(receitas) || !(valor > 0.005)) return;
    onReceitas([{
      id: uid(), data: diaOperacional(), categoria: FONTE_ATRASADO,
      descricao: `Fiado recebido — ${nome}${comoPagou ? ` (${comoPagou})` : ''}`,
      valor: Math.round(valor * 100) / 100, obs: '', refFiado: ref, forma: comoPagou || 'Dinheiro',
    }, ...receitas]);
  };

  const desfazerUltima = async () => {
    if (!ultima) return;
    const alvo = ultima;
    setBusy(true);
    try {
      const r = await fetch('/api/vendas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'desfazer', ref: alvo.ref }) });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Não consegui desfazer.'); return; }
      // Tira também o lançamento que essa baixa criou em Receitas.
      if (onReceitas && Array.isArray(receitas)) onReceitas(receitas.filter((x) => x && x.refFiado !== alvo.ref));
      setUltima(null);
      await carregar();
      verCaixa();
      if (onMudou) onMudou();
    } catch { setErro('Sem conexão.'); }
    finally { setBusy(false); }
  };

  const receber = async (id, comoPagou) => {
    setRecebendo((m) => ({ ...m, [id]: false }));
    if (!confirmaSemCaixa()) return;
    const v = vendas.find((x) => x.id === id);
    const nome = v ? rotulo(v.nome, v.mesa) : 'cliente';
    const valor = v ? abertoDaVenda(v) : 0;
    const pg = comoPagou || 'Dinheiro';
    const ref = uid();
    const j = await acao({ acao: 'receber', id, ref, formaRecebida: pg });
    if (j && j.ok) {
      const entrou = num(j.aplicado) || valor;
      lancarReceita(ref, nome, entrou, pg);
      setUltima({ ref, nome, valor: entrou, forma: pg });
    }
  };
  // Excluir apaga a VENDA inteira — some também do histórico do dia em que foi
  // feita. Só serve pra comanda lançada por engano. Pra tirar a dívida sem
  // mexer no passado, o certo é "Baixar sem dinheiro".
  const excluir = (id) => {
    if (typeof window !== 'undefined' && !window.confirm(
      'Excluir apaga a comanda INTEIRA — some da lista de fiados e também do movimento do dia em que ela foi feita. Isso não dá pra desfazer.\n\n'
      + 'Se o que você quer é só tirar a dívida (desconto no salário, cortesia), volte e use "Baixar sem dinheiro".\n\n'
      + 'Excluir mesmo assim?')) return;
    acao({ acao: 'excluir', id });
  };
  const toggleItens = (id) => setItensAbertos((m) => ({ ...m, [id]: !m[id] }));

  // Recebe um VALOR do cliente e abate dos fiados dele (do mais antigo pro mais
  // novo). Se o valor cobre tudo, quita todos; senão deixa o resto em aberto.
  const receberValor = async (g) => {
    const valor = num(valorPago[g.chave]);
    if (!(valor > 0)) { setErro('Digite quanto o cliente pagou.'); return; }
    if (valor > g.total + 0.005 && typeof window !== 'undefined' &&
        !window.confirm(`O valor (${brl(valor)}) é maior que a dívida (${brl(g.total)}). Vou quitar tudo e o resto (${brl(valor - g.total)}) fica como troco. Continuar?`)) return;
    if (!confirmaSemCaixa()) return;
    const pg = forma[g.chave] || 'Dinheiro';
    const ref = uid();
    const j = await acao({ acao: 'receberValor', ids: g.vendas.map((v) => v.id), valor, ref, formaRecebida: pg });
    if (j && j.ok) {
      const entrou = num(j.aplicado) || valor;
      lancarReceita(ref, g.nome, entrou, pg);
      setUltima({ ref, nome: g.nome, valor: entrou, forma: pg });
    }
    setValorPago((m) => ({ ...m, [g.chave]: '' }));
    setPagarAberto((m) => ({ ...m, [g.chave]: false }));
  };

  // Tirar a dívida da lista SEM entrar dinheiro (desconto no salário, cortesia,
  // engano). Usa a mesma baixa do "receber valor", só que marcada — então não
  // entra no caixa, não vira receita e o Desfazer funciona igual.
  const baixarSemDinheiro = async (g) => {
    const motivo = motivoSem[g.chave] || MOTIVOS_SEM[0];
    const digitado = String(valorSem[g.chave] || '').trim();
    const valor = digitado ? num(digitado) : g.total;
    if (!(valor > 0)) { setErro('Digite um valor maior que zero.'); return; }
    if (typeof window !== 'undefined' && !window.confirm(
      `Baixar ${brl(valor)} de ${g.nome} como "${motivo}"?\n\n`
      + 'A conta sai da lista de quem deve e NÃO entra dinheiro nenhum: não vai pro caixa nem pras receitas.\n\n'
      + 'Se errar, dá pra desfazer no aviso verde que aparece em cima.')) return;
    const ref = uid();
    const j = await acao({ acao: 'receberValor', ids: g.vendas.map((v) => v.id), valor, ref, semDinheiro: true, motivo });
    if (j && j.ok) setUltima({ ref, nome: g.nome, valor: num(j.aplicado) || valor, semDinheiro: true, motivo });
    setValorSem((m) => ({ ...m, [g.chave]: '' }));
    setSemAberto((m) => ({ ...m, [g.chave]: false }));
  };

  const limiteDe = (nome) => { const c = clientes.find((x) => norm(x.nome) === norm(nome)); return c ? num(c.limite) : 0; };
  const telefoneDe = (nome) => { const c = clientes.find((x) => norm(x.nome) === norm(nome)); return (c && c.telefone) || ''; };

  // Cobrar no WhatsApp: abre a conversa da pessoa com o texto pronto. Sem
  // telefone cadastrado, copia a mensagem pra ela colar onde quiser.
  const cobrar = async (g) => {
    // Cobra o que já venceu; se não venceu nada ainda, fala do total mesmo.
    const cobrarAgora = g.agora > 0.005;
    // "correspondendo até o dia X" = o último consumo que entrou nessa conta.
    // É a data que explica o valor — e o que vier depois dela muda o total, por
    // isso a frase avisa que o valor pode mudar até o pagamento.
    const ultima = g.vendas[0] || null;
    const ateISO = String((ultima && (ultima.data || ultima.fechadaEm)) || hojeISO).slice(0, 10);
    const msg = msgCobranca(primeiroNome(g.nome), cobrarAgora ? g.agora : g.total, ateISO, diaDoVencimento(hojeISO, cobrarAgora));
    const link = zapLink(telefoneDe(g.nome), msg);
    if (link) { try { window.open(link, '_blank', 'noopener'); } catch { /* ignora */ } return; }
    try {
      await navigator.clipboard.writeText(msg);
      setErro(`${g.nome} não tem telefone cadastrado (aba Clientes). Copiei a mensagem pra você colar no WhatsApp.`);
    } catch {
      setErro(`${g.nome} não tem telefone cadastrado. A mensagem seria: ${msg}`);
    }
  };
  const rotulo = (nome, mesa) => (nome && nome.trim()) || `Mesa ${mesa}`;

  const fiados = vendas.filter((v) => fiadoDaVenda(v) > 0.005);
  const abertos = fiados.filter((v) => !v.pago);
  const pagos = fiados.filter((v) => v.pago).sort((a, b) => (b.pagoEm || '').localeCompare(a.pagoEm || ''));
  const totalDevido = abertos.reduce((s, v) => s + abertoDaVenda(v), 0);
  // Hoje, no fuso do bar — é o que decide o que já venceu e o que ainda não.
  const hojeISO = diaOperacional();
  const ymAtual = hojeISO.slice(0, 7);
  const diaDoMes = Number(hojeISO.slice(8, 10)) || 1;
  // A idade de cada fiado sai do histórico de pagamento de cada cliente.
  const idade = useMemo(() => classificarFiado(vendas, ymAtual), [vendas, ymAtual]);
  const venceAgora = (v) => idade.balde.get(v.id) !== 'proximo';
  const totalAgora = abertos.filter(venceAgora).reduce((s, v) => s + abertoDaVenda(v), 0);
  const totalProximo = Math.round((totalDevido - totalAgora) * 100) / 100;
  const dentroDoPrazo = diaDoMes <= DIA_LIMITE;
  const faltamDias = DIA_LIMITE - diaDoMes;

  // Agrupa os fiados em aberto por cliente (nome), com as compras por data.
  const grupos = useMemo(() => {
    const map = new Map();
    for (const v of abertos) {
      const k = norm(v.nome) || `mesa:${v.mesa}:${v.id}`;
      let g = map.get(k);
      if (!g) { g = { chave: k, nome: rotulo(v.nome, v.mesa), total: 0, agora: 0, proximo: 0, doMesPassado: 0, desteMes: 0, vendas: [] }; map.set(k, g); }
      const aberto = abertoDaVenda(v);
      g.total += aberto;
      if (venceAgora(v)) g.agora += aberto; else g.proximo += aberto;
      if (idade.atrasada.get(v.id)) g.doMesPassado += aberto; else g.desteMes += aberto;
      g.vendas.push(v);
    }
    for (const g of map.values()) {
      g.vendas.sort((a, b) => (b.fechadaEm || b.data || '').localeCompare(a.fechadaEm || a.data || ''));
      g.limite = limiteDe(g.nome);
      g.ultimoPag = idade.ultimoPag.get(idade.chaveDe(g.vendas[0])) || '';
      g.acertou = !!g.ultimoPag && g.ultimoPag.slice(0, 7) === ymAtual;
    }
    return [...map.values()].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
  }, [vendas, clientes, ymAtual, idade]);

  const itensDe = (v) => (Array.isArray(v.itens) ? v.itens : []);

  return (
    <div>
      <PageTitle sub="Quem está devendo (contas fechadas no fiado)">Fiados</PageTitle>

      {/* O fiado tem duas idades: o que já venceu (consumo dos meses passados,
          que se paga até o dia 10) e o que ainda está correndo neste mês. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 9 }}>
        <KPI
          titulo={dentroDoPrazo ? `A receber até dia ${DIA_LIMITE}` : `Vencido (era até dia ${DIA_LIMITE})`}
          valor={brl(totalAgora)}
          cor={totalAgora > 0 ? (dentroDoPrazo ? C.roxo : C.red) : C.faint}
          sub={totalAgora > 0
            ? (dentroDoPrazo
              ? (faltamDias > 0 ? `quem tem conta do mês passado · faltam ${faltamDias} dia(s)` : 'quem tem conta do mês passado · o prazo acaba hoje')
              : 'quem tem conta do mês passado · o prazo já passou')
            : 'ninguém com conta do mês passado em aberto'}
        />
        <KPI
          titulo="Cai só mês que vem"
          valor={brl(totalProximo)}
          cor={totalProximo > 0 ? C.accent2 : C.faint}
          sub={`quem só consumiu depois que o mês virou · vence dia 01 a ${DIA_LIMITE} do mês que vem`}
        />
      </div>
      <KPI titulo="Total em aberto" valor={brl(totalDevido)} cor={totalDevido > 0 ? C.text : C.faint} sub={`${grupos.length} cliente(s) · ${abertos.length} fiado(s)`} />

      {ultima && (
        <div style={{ background: C.panel2, border: `1px solid ${C.green}`, borderRadius: 10, padding: '11px 14px', marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: C.text, lineHeight: 1.45, flex: 1, minWidth: 180 }}>
            {ultima.semDinheiro
              ? <>Baixei <b>{brl(ultima.valor)}</b> de <b>{ultima.nome}</b> como <b>{ultima.motivo}</b> — saiu da lista e <b>não entrou dinheiro</b>.</>
              : <>Recebi <b>{brl(ultima.valor)}</b> de <b>{ultima.nome}</b>{ultima.forma ? <> em <b>{ultima.forma}</b></> : null} — já lancei em Receitas como <b>Recebimento Atrasado</b>.</>}
          </span>
          <Btn kind="ghost" small onClick={desfazerUltima} disabled={busy}>Desfazer</Btn>
          <button onClick={() => setUltima(null)} aria-label="Fechar aviso" style={{ background: 'none', border: 'none', color: C.faint, fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: '0 2px' }}>×</button>
        </div>
      )}

      {caixaAberto === false && grupos.length > 0 && (
        <div style={{ background: C.panel2, border: `1px solid ${C.amber}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: C.text, marginTop: 12, lineHeight: 1.45 }}>
          <b style={{ color: C.amber }}>Caixa fechado.</b> Pra o dinheiro recebido entrar no caixa do dia, abra o caixa (aba Caixa) antes de dar baixa no fiado.
        </div>
      )}

      {erro && <div style={{ fontSize: 13, color: C.red, margin: '10px 0' }}>{erro}</div>}

      <div style={{ marginTop: 16 }}>
        <SecTitle>Em aberto ({grupos.length})</SecTitle>
        {!carregado ? <Empty>Carregando…</Empty> :
          grupos.length === 0 ? <Empty>Ninguém devendo.<br />Contas fechadas no fiado aparecem aqui pra você cobrar.</Empty> :
            grupos.map((g) => {
              const pct = g.limite > 0 ? Math.min(1, g.total / g.limite) : 0;
              const noLimite = g.limite > 0 && g.total >= g.limite - 0.005;
              // Azul enquanto o fiado está dentro do limite; vermelho ao encostar nele.
              const cor = noLimite ? C.red : C.accent;
              return (
                <Card key={g.chave} style={{ marginBottom: 10, padding: 14 }}>
                  {/* Clicar no nome abre/fecha o histórico (datas + consumo) do cliente. */}
                  <button onClick={() => setAbertoCliente((m) => ({ ...m, [g.chave]: !m[g.chave] }))} style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, textAlign: 'left' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, minWidth: 0, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: C.accent, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{abertoCliente[g.chave] ? '▾' : '▸'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.nome}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(g.total)}</div>
                  </button>
                  {/* Gráfico do limite: o quanto está chegando no teto de fiado. */}
                  {g.limite > 0 ? (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ height: 8, background: C.panel2, borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: (pct * 100) + '%', height: '100%', background: cor, borderRadius: 999 }} />
                      </div>
                      <div style={{ fontSize: 11, marginTop: 4, color: noLimite ? C.red : C.faint, fontWeight: noLimite ? 700 : 400 }}>
                        {Math.round(pct * 100)}% de {brl(g.limite)}{noLimite ? ' · no limite' : ` · falta ${brl(Math.max(0, g.limite - g.total))}`}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>sem limite cadastrado</div>
                  )}

                  {/* Este cliente entra na cobrança de agora ou fica pra próxima? */}
                  {g.agora > 0.005 ? (
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: dentroDoPrazo ? C.roxo : C.red, marginTop: 8, lineHeight: 1.45 }}>
                      {dentroDoPrazo ? `Cobrar até o dia ${DIA_LIMITE}` : `Vencido — passou do dia ${DIA_LIMITE}`}
                      {g.desteMes > 0.005 && (
                        <span style={{ fontWeight: 500, color: C.faint }}>
                          {' '}· {brl(g.doMesPassado)} do mês passado + {brl(g.desteMes)} deste mês, tudo junto
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: C.accent2, marginTop: 8, lineHeight: 1.45 }}>
                      Só consumiu depois que o mês virou{g.acertou ? ` (acertou a conta em ${fmtDate(g.ultimoPag)})` : ''} — paga do dia 01 ao {DIA_LIMITE} do mês que vem.
                    </div>
                  )}

                  {/* Receber um valor e abater da conta do cliente (sem ir compra por compra). */}
                  <div style={{ marginTop: 12 }}>
                    {!pagarAberto[g.chave] ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Btn kind="ok" small onClick={() => setPagarAberto((m) => ({ ...m, [g.chave]: true }))} disabled={busy}>Receber valor</Btn>
                        {/* Cobrança pronta: abre a conversa da pessoa no WhatsApp com o texto escrito. */}
                        <Btn kind="ghost" small onClick={() => cobrar(g)}>Cobrar no WhatsApp</Btn>
                        {/* Tirar da lista sem entrar dinheiro (desconto no salário, cortesia…). */}
                        <Btn kind="ghost" small onClick={() => setSemAberto((m) => ({ ...m, [g.chave]: true }))} disabled={busy}>Baixar sem dinheiro</Btn>
                      </div>
                    ) : (
                      <div style={{ background: C.panel2, borderRadius: 10, padding: 10 }}>
                        {/* Como a pessoa pagou — vai pro caixa no balde certo. */}
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Como {g.nome} pagou?</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                          {FORMAS.map((f) => {
                            const ativo = (forma[g.chave] || 'Dinheiro') === f;
                            return (
                              <button
                                key={f}
                                onClick={() => setForma((x) => ({ ...x, [g.chave]: f }))}
                                style={{
                                  background: ativo ? C.accent : C.panel, color: ativo ? '#0b0b0c' : C.text,
                                  border: `1px solid ${ativo ? C.accent : C.line}`, borderRadius: 999,
                                  padding: '7px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                                }}
                              >{f}</button>
                            );
                          })}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Quanto {g.nome} pagou agora? (abate do total de {brl(g.total)})</div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="text" inputMode="decimal" placeholder="R$ 0,00" autoFocus
                            value={valorPago[g.chave] || ''}
                            onChange={(e) => setValorPago((m) => ({ ...m, [g.chave]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') receberValor(g); }}
                            style={{ flex: 1, minWidth: 0, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: '9px 12px', color: C.text, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}
                          />
                          <Btn kind="ok" small onClick={() => receberValor(g)} disabled={busy}>Pagar</Btn>
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                          <button onClick={() => setValorPago((m) => ({ ...m, [g.chave]: String(g.total).replace('.', ',') }))} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>quitar tudo ({brl(g.total)})</button>
                          <button onClick={() => { setPagarAberto((m) => ({ ...m, [g.chave]: false })); setValorPago((m) => ({ ...m, [g.chave]: '' })); }} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>cancelar</button>
                        </div>
                      </div>
                    )}

                    {/* Baixa sem entrar dinheiro: escolhe o motivo e quanto tirar. */}
                    {semAberto[g.chave] && (
                      <div style={{ background: C.panel2, borderRadius: 10, padding: 10, marginTop: 8 }}>
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, lineHeight: 1.45 }}>
                          Tirar a conta de <b>{g.nome}</b> da lista <b>sem entrar dinheiro</b>. Por quê?
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                          {MOTIVOS_SEM.map((m) => {
                            const ativo = (motivoSem[g.chave] || MOTIVOS_SEM[0]) === m;
                            return (
                              <button
                                key={m}
                                onClick={() => setMotivoSem((x) => ({ ...x, [g.chave]: m }))}
                                style={{
                                  background: ativo ? C.accent : C.panel, color: ativo ? '#0b0b0c' : C.text,
                                  border: `1px solid ${ativo ? C.accent : C.line}`, borderRadius: 999,
                                  padding: '6px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                }}
                              >{m}</button>
                            );
                          })}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Quanto tirar? (vazio = tudo, {brl(g.total)})</div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="text" inputMode="decimal" placeholder={`R$ ${brl(g.total).replace('R$ ', '')} (tudo)`}
                            value={valorSem[g.chave] || ''}
                            onChange={(e) => setValorSem((m) => ({ ...m, [g.chave]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') baixarSemDinheiro(g); }}
                            style={{ flex: 1, minWidth: 0, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: '9px 12px', color: C.text, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}
                          />
                          <Btn kind="danger" small onClick={() => baixarSemDinheiro(g)} disabled={busy}>Baixar</Btn>
                        </div>
                        <div style={{ fontSize: 11, color: C.faint, marginTop: 8, lineHeight: 1.45 }}>
                          Não vai pro caixa nem pras receitas — some só da lista de quem deve. Dá pra desfazer logo depois.
                        </div>
                        <button onClick={() => { setSemAberto((m) => ({ ...m, [g.chave]: false })); setValorSem((m) => ({ ...m, [g.chave]: '' })); }} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0, marginTop: 8 }}>cancelar</button>
                      </div>
                    )}
                  </div>

                  {/* Histórico (datas + consumo): fica escondido e abre ao clicar no nome. */}
                  {!abertoCliente[g.chave] ? (
                    <div style={{ fontSize: 12, color: C.faint, marginTop: 10 }}>{g.vendas.length} fiado(s) · toque no nome pra ver as datas e o que consumiu</div>
                  ) : (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 4 }}>
                    {g.vendas.map((v) => {
                      const aberto = itensAbertos[v.id];
                      const itens = itensDe(v);
                      return (
                        <div key={v.id} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 9, marginTop: 9 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtDate(v.data)} · mesa {v.mesa}</div>
                              {itens.length > 0 && (
                                <button onClick={() => toggleItens(v.id)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '2px 0' }}>
                                  {aberto ? 'ocultar itens' : `ver itens (${itens.length})`}
                                </button>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontWeight: 800, color: C.accent, fontVariantNumeric: 'tabular-nums' }}>{brl(abertoDaVenda(v))}</div>
                              {num(v.abatido) > 0.005 && <div style={{ fontSize: 11, color: C.green, fontVariantNumeric: 'tabular-nums' }}>já pagou {brl(num(v.abatido))}</div>}
                            </div>
                          </div>
                          {aberto && itens.length > 0 && (
                            <div style={{ marginTop: 6, marginLeft: 2, padding: '8px 10px', background: C.panel2, borderRadius: 8 }}>
                              {itens.map((it, i) => (
                                <div key={it.id || i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '2px 0' }}>
                                  <span style={{ color: C.text, minWidth: 0 }}>{it.qtd}× {it.nome}</span>
                                  <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl((Number(it.qtd) || 0) * num(it.preco))}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {!recebendo[v.id] ? (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
                              <Btn kind="ok" small onClick={() => setRecebendo((m) => ({ ...m, [v.id]: true }))} disabled={busy}>Recebi</Btn>
                              <Btn kind="danger" small onClick={() => excluir(v.id)} disabled={busy}>Excluir</Btn>
                            </div>
                          ) : (
                            /* Um toque a mais só pra dizer como entrou o dinheiro. */
                            <div style={{ background: C.panel2, borderRadius: 10, padding: 10, marginTop: 8 }}>
                              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Recebi {brl(abertoDaVenda(v))} — como {g.nome} pagou?</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {FORMAS.map((f) => (
                                  <button
                                    key={f}
                                    onClick={() => receber(v.id, f)}
                                    disabled={busy}
                                    style={{ background: C.panel, color: C.text, border: `1px solid ${C.line}`, borderRadius: 999, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                                  >{f}</button>
                                ))}
                              </div>
                              <button onClick={() => setRecebendo((m) => ({ ...m, [v.id]: false }))} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0, marginTop: 8 }}>cancelar</button>
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
      </div>

      {pagos.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <button onClick={() => setVerPagos((x) => !x)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0 }}>
            {verPagos ? '▾' : '▸'} Já recebidos ({pagos.length})
          </button>
          {verPagos && (
            <div style={{ marginTop: 10 }}>
              {pagos.slice(0, 40).map((v) => {
                const semGrana = !!v.semDinheiro || (Array.isArray(v.recebimentos) && v.recebimentos.some((r) => r && r.semDinheiro));
                return (
                <Card key={v.id} style={{ marginBottom: 6, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.faint }}>{rotulo(v.nome, v.mesa)}</div>
                      <div style={{ fontSize: 12, color: C.faint }}>
                        {semGrana ? 'Baixado' : 'Recebido'} {v.pagoEm ? fmtDate(v.pagoEm) : ''}
                        {!semGrana && v.formaRecebida ? ` em ${v.formaRecebida}` : ''} · compra {fmtDate(v.data)}
                      </div>
                      {semGrana && (
                        <div style={{ fontSize: 11, color: C.amber, fontWeight: 700, marginTop: 2 }}>
                          sem entrada de dinheiro{v.formaRecebida ? ` · ${v.formaRecebida}` : ''}
                        </div>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, color: semGrana ? C.faint : C.green, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(fiadoDaVenda(v))}</div>
                  </div>
                </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
