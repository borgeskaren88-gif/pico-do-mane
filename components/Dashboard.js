'use client';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { C, LogoMark, pageBg } from './ui';
import { ymOf, todayISO, limparNome, fiadoDaVenda } from '../lib/util';
import SEED_DATA from '../data/seed.json';

import Brain from './Brain';
import Darci from './Darci';
import DarciFlutuante from './DarciFlutuante';
import Hoje from './Hoje';
import Diario from './Diario';
import Marketing from './Marketing';
import PontoDona from './PontoDona';
import CortesiaConsumo from './CortesiaConsumo';
import ListaCompras from './ListaCompras';
import Lancamentos from './Lancamentos';
import Compras from './Compras';
import ContasPagar from './ContasPagar';
import Garrafas from './Garrafas';
import Cotacoes from './Cotacoes';
import Relatorios from './Relatorios';
import RaioX from './RaioX';
import Backup from './Backup';
import Cardapio from './Cardapio';
import Comandas from './Comandas';
import Caixa from './Caixa';
import Fiados from './Fiados';
import Clientes from './Clientes';
import Estoque from './Estoque';
import Margem from './Margem';
import FichasTecnicas from './FichasTecnicas';
import ConferenciaEstoque from './ConferenciaEstoque';
import Auditoria from './Auditoria';
import TrocarSenha from './TrocarSenha';
import Notificacoes from './Notificacoes';
import DespesaRapida from './DespesaRapida';
import Widget from './Widget';
import Previsao from './Previsao';
import BotaoAtualizar from './BotaoAtualizar';
import PullToRefresh from './PullToRefresh';

const arr = (v) => (Array.isArray(v) ? v : []);

// Carrega o painel com TENTATIVAS (rede/cold start falham às vezes). Devolve
// { ok, dados }: ok=false quando NÃO conseguiu ler de jeito nenhum — nesse caso
// o app NUNCA deve semear/salvar por cima, senão apaga os dados reais.
async function apiCarregar() {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    try {
      const res = await fetch('/api/data', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.ok) return { ok: true, dados: json.dados };
      }
    } catch { /* rede: tenta de novo */ }
    await new Promise((r) => setTimeout(r, 500 * (tentativa + 1)));
  }
  return { ok: false, dados: null };
}

// Os salvamentos deste aparelho rodam UM DE CADA VEZ (fila). Como o servidor
// agora mescla só os campos enviados, salvar em ordem garante que um não
// sobrescreva o outro (ex.: marcar tarefa não reverte conta paga).
let filaSalvar = Promise.resolve();
// A tela avisa aqui quando um salvamento falha de vez (pra mostrar um aviso e a
// dona saber que a última alteração NÃO gravou — antes falhava em silêncio e o
// dado "sumia" ao recarregar).
let notificarSalvamento = null;
function apiSalvar(dados) {
  const run = async () => {
    // Tenta VÁRIAS vezes: internet/cold start falham às vezes, e um salvamento
    // que falha em silêncio faz o dado sumir depois. Só considera salvo quando o
    // servidor confirma (res.ok + json.ok).
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      try {
        const res = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados),
        });
        if (res.ok) {
          const j = await res.json().catch(() => ({}));
          if (j && j.ok !== false) { if (notificarSalvamento) notificarSalvamento(true); return true; }
        }
      } catch (e) { /* rede: tenta de novo */ }
      await new Promise((r) => setTimeout(r, 700 * (tentativa + 1)));
    }
    if (notificarSalvamento) notificarSalvamento(false); // avisou: não gravou
    return false;
  };
  filaSalvar = filaSalvar.then(run, run);
  return filaSalvar;
}

// Passa um "trim" em produto/fornecedor de compras e cotações. Retorna os
// dados possivelmente ajustados e se algo mudou (pra salvar só quando precisa).
function normalizarNomes(dados) {
  let mudou = false;
  const limpaLista = (lista) => (lista || []).map((item) => {
    let novo = item;
    for (const campo of ['produto', 'fornecedor']) {
      const v = item[campo];
      if (typeof v === 'string') {
        const limpo = limparNome(v);
        if (limpo !== v) { if (novo === item) novo = { ...item }; novo[campo] = limpo; mudou = true; }
      }
    }
    return novo;
  });
  return { dados: { ...dados, compras: limpaLista(dados.compras), cotacoes: limpaLista(dados.cotacoes) }, mudou };
}

export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState('hoje');
  const [loaded, setLoaded] = useState(false);
  const [erroLoad, setErroLoad] = useState(false);
  const [salvarFalhou, setSalvarFalhou] = useState(false);
  // Trava de segurança: só permite SALVAR depois que os dados carregaram de
  // verdade. Sem isso, um salvamento com o estado ainda vazio apagava tudo.
  const loadedRef = useRef(false);
  // Liga o aviso de salvamento (apiSalvar chama isto): false = falhou de vez.
  useEffect(() => { notificarSalvamento = (ok) => setSalvarFalhou(!ok); return () => { notificarSalvamento = null; }; }, []);
  const [diario, setDiario] = useState([]);
  const [ideias, setIdeias] = useState([]);
  const [receitas, setReceitas] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [cotacoes, setCotacoes] = useState([]);
  const [garrafas, setGarrafas] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [marketing, setMarketing] = useState([]);
  const [visitantes, setVisitantes] = useState([]);
  const [listaCompras, setListaCompras] = useState([]);
  const [listaCozinha, setListaCozinha] = useState([]);
  const [listasModelo, setListasModelo] = useState([]);
  const [tarefasCozinha, setTarefasCozinha] = useState([]);
  const [cardapio, setCardapio] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [fichas, setFichas] = useState([]);         // fichas técnicas (fonte: /api/estoque)
  const [estCarregado, setEstCarregado] = useState(false);
  const [subEstoque, setSubEstoque] = useState('itens'); // 'itens' | 'fichas'
  const [subAbast, setSubAbast] = useState('estoque'); // 'estoque' | 'lista' | 'compras' | 'cotacoes'
  const [subFinancas, setSubFinancas] = useState('receitas'); // 'receitas' | 'despesas' | 'relatorios'
  const [avisoBaixa, setAvisoBaixa] = useState(''); // resumo da última baixa automática
  const [vendas, setVendas] = useState([]); // vendas do salão (comandas fechadas)
  const [qualLista, setQualLista] = useState('minha'); // 'minha' | 'cozinha'
  const [subSalao, setSubSalao] = useState('comandas'); // 'comandas' | 'cardapio' | 'fiados'
  const [googleOn, setGoogleOn] = useState(false);
  const [mes, setMes] = useState(ymOf(todayISO()));

  useEffect(() => {
    (async () => {
      const r = await apiCarregar();
      // Falhou ao ler (rede/servidor): NÃO carrega seed e NÃO salva nada — assim
      // uma falha de rede nunca apaga os dados reais gravando por cima. Mostra a
      // tela de erro com "tentar de novo".
      if (!r.ok) { setErroLoad(true); return; }
      const salvo = r.dados;
      // Só é "primeira vez" quando o servidor está de fato vazio (sem linha /
      // objeto vazio) — aí semear é seguro. Se há dados, usa EXATAMENTE o que veio
      // (sem misturar seed campo a campo, que era outra forma de "reverter").
      const primeiraVez = !salvo || typeof salvo !== 'object' || Object.keys(salvo).length === 0;
      const dados = primeiraVez ? SEED_DATA : {
        diario: arr(salvo.diario), receitas: arr(salvo.receitas), despesas: arr(salvo.despesas),
        compras: arr(salvo.compras), cotacoes: arr(salvo.cotacoes), garrafas: arr(salvo.garrafas),
      };
      // Limpa nomes de produto/fornecedor (espaços sobrando) uma vez, ao abrir.
      const { dados: limpos, mudou } = normalizarNomes(dados);
      setDiario(limpos.diario); setReceitas(limpos.receitas); setDespesas(limpos.despesas);
      setCompras(limpos.compras); setCotacoes(limpos.cotacoes); setGarrafas(limpos.garrafas);
      setTarefas(arr(salvo && salvo.tarefas));
      setIdeias(arr(salvo && salvo.ideias));
      setMarketing(arr(salvo && salvo.marketing));
      setVisitantes(arr(salvo && salvo.visitantes));
      setListaCompras(arr(salvo && salvo.listaCompras));
      setListaCozinha(arr(salvo && salvo.listaCozinha));
      setListasModelo(arr(salvo && salvo.listasModelo));
      setTarefasCozinha(arr(salvo && salvo.tarefasCozinha));
      setCardapio(arr(salvo && salvo.cardapio));
      setClientes(arr(salvo && salvo.clientes));
      // Grava SÓ em dois casos seguros: (1) primeira vez de verdade (servidor
      // vazio) pra semear; (2) a limpeza de nomes mudou algo — e aí a base é o
      // `salvo` REAL, nunca o seed. Fora isso, abrir o app não escreve nada.
      loadedRef.current = true;
      if (primeiraVez) {
        await apiSalvar({ ...SEED_DATA });
      } else if (mudou) {
        await apiSalvar({ ...salvo, ...limpos });
      }
      setLoaded(true);
    })();
  }, []);

  // Descobre se o Google Agenda já está conectado, pra ligar a sincronização
  // automática quando boletos/tarefas mudarem.
  useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/google/status', { cache: 'no-store' }); const j = await r.json(); if (j.ok) setGoogleOn(!!j.conectado); } catch { /* ignora */ }
    })();
  }, []);

  // Vendas do salão (comandas fechadas). Ficam separadas das receitas digitadas
  // à mão (não entram no bloco salvo), mas são somadas como receita no resumo e
  // nos relatórios. Recarrega ao abrir e ao entrar nas telas que mostram receita.
  const carregarVendas = async () => {
    try { const r = await fetch('/api/vendas', { cache: 'no-store' }); const j = await r.json(); if (j.ok) setVendas(Array.isArray(j.vendas) ? j.vendas : []); } catch { /* ignora */ }
  };
  useEffect(() => { carregarVendas(); }, []);
  // Backup automático diário na nuvem: dispara uma cópia quando a dona abre o
  // app (o servidor não refaz se a de hoje já existe). Guarda no aparelho o dia
  // pra não repetir o pedido. Best-effort — nunca atrapalha o uso.
  useEffect(() => {
    try {
      const hoje = todayISO();
      if (typeof localStorage !== 'undefined' && localStorage.getItem('picoos-backup-dia') === hoje) return;
      fetch('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'auto' }) })
        .then((r) => r.ok && (() => { try { localStorage.setItem('picoos-backup-dia', hoje); } catch { /* ignora */ } })())
        .catch(() => { /* ignora */ });
    } catch { /* ignora */ }
  }, []);
  useEffect(() => { if (['hoje', 'darci', 'relatorios', 'marketing', 'receitas', 'salao', 'caixa', 'diario', 'backup', 'abastecimento', 'previsao'].includes(tab)) carregarVendas(); }, [tab]);
  useEffect(() => { if (tab === 'salao' && subSalao === 'fiados') carregarVendas(); }, [subSalao]);


  // FONTE DO FATURAMENTO: manual. As comandas são só operacionais (salão +
  // conferência de gaveta + fiados) e NÃO entram no DRE/Relatórios/Hoje. O caixa
  // oficial é o que a dona lança à mão, verificado nas máquinas. Por isso o
  // financeiro usa só `receitas` (o que ela digita), não as vendas do salão.
  // Pessoas atendidas por dia (somado do nº de pessoas de cada mesa fechada).
  const pessoasPorDia = useMemo(() => {
    const m = {};
    for (const v of vendas) { if (!v.data) continue; m[v.data] = (m[v.data] || 0) + (Number(v.pessoas) || 0); }
    return m;
  }, [vendas]);
  // Nº de pedidos (comandas fechadas) e de fiados por dia — pra preencher o Log.
  const pedidosPorDia = useMemo(() => {
    const m = {};
    for (const v of vendas) { if (!v.data) continue; m[v.data] = (m[v.data] || 0) + 1; }
    return m;
  }, [vendas]);
  const fiadosPorDia = useMemo(() => {
    const m = {};
    for (const v of vendas) { if (!v.data || fiadoDaVenda(v) <= 0.005) continue; m[v.data] = (m[v.data] || 0) + 1; }
    return m;
  }, [vendas]);

  const salvarTudo = (parcial) => {
    // Nunca salva antes de os dados carregarem: evita gravar um estado ainda
    // vazio por cima do que está no servidor (era uma das formas de "sumir tudo").
    if (!loadedRef.current) return;
    // Envia SÓ os campos que realmente mudaram. O servidor mescla esses campos
    // no que já está salvo e PRESERVA todo o resto. Antes, cada salvamento
    // reenviava TODO o painel a partir da memória do aparelho — então uma tela
    // (ou outro aparelho) com uma cópia velha podia sobrescrever o que outra
    // acabou de gravar (ex.: uma conta marcada como paga voltava a aberta).
    apiSalvar({ ...parcial });
  };

  // Se o Google Agenda estiver conectado, sincroniza (com um pequeno atraso pra
  // agrupar várias mudanças seguidas num só envio). Chamado quando boletos ou
  // tarefas mudam.
  const googleSyncTimer = useRef(null);
  const syncGoogle = () => {
    if (!googleOn) return;
    clearTimeout(googleSyncTimer.current);
    googleSyncTimer.current = setTimeout(() => { fetch('/api/google/sync', { method: 'POST' }).catch(() => { }); }, 2500);
  };

  const upd = {
    diario: (v) => { setDiario(v); salvarTudo({ diario: v }); },
    receitas: (v) => { setReceitas(v); salvarTudo({ receitas: v }); },
    despesas: (v) => { setDespesas(v); salvarTudo({ despesas: v }); },
    compras: (v) => { setCompras(v); salvarTudo({ compras: v }); syncGoogle(); },
    cotacoes: (v) => { setCotacoes(v); salvarTudo({ cotacoes: v }); },
    garrafas: (v) => { setGarrafas(v); salvarTudo({ garrafas: v }); },
    tarefas: (v) => { setTarefas(v); salvarTudo({ tarefas: v }); syncGoogle(); },
    ideias: (v) => { setIdeias(v); salvarTudo({ ideias: v }); },
    marketing: (v) => { setMarketing(v); salvarTudo({ marketing: v }); },
    visitantes: (v) => { setVisitantes(v); salvarTudo({ visitantes: v }); },
    listaCompras: (v) => { setListaCompras(v); salvarTudo({ listaCompras: v }); },
    tarefasCozinha: (v) => { setTarefasCozinha(v); salvarTudo({ tarefasCozinha: v }); },
    cardapio: (v) => { setCardapio(v); salvarTudo({ cardapio: v }); },
    clientes: (v) => { setClientes(v); salvarTudo({ clientes: v }); },
  };

  // Marca/desfaz pagamento de contas aplicando a mudança no estado ATUAL (fresco)
  // — nunca numa lista reconstruída pela tela, que podia estar um passo atrás e
  // apagar uma compra/despesa recém-lançada. Recebe a INTENÇÃO (quais ids pagar/
  // estornar, a despesa a lançar/remover) e aplica sobre compras/despesas atuais.
  const aplicarPagamento = (op) => {
    const parcial = {};
    if (op.pagarIds && op.pagarIds.length) {
      const ids = new Set(op.pagarIds);
      const nc = compras.map((x) => (ids.has(x.id) ? { ...x, pago: 'Sim', dataPagamento: op.hoje, despesaId: op.despId } : x));
      setCompras(nc); parcial.compras = nc;
      if (op.despesaNova) { const nd = [op.despesaNova, ...despesas]; setDespesas(nd); parcial.despesas = nd; }
    }
    if (op.estornarIds && op.estornarIds.length) {
      const ids = new Set(op.estornarIds);
      const nc = compras.map((x) => (ids.has(x.id) ? { ...x, pago: 'Não', dataPagamento: '', despesaId: '' } : x));
      setCompras(nc); parcial.compras = nc;
      if (op.removerDespesaIds && op.removerDespesaIds.length) {
        const rm = new Set(op.removerDespesaIds);
        const nd = despesas.filter((d) => !rm.has(d.id)); setDespesas(nd); parcial.despesas = nd;
      }
    }
    if (Object.keys(parcial).length) { salvarTudo(parcial); syncGoogle(); }
  };

  // Registro de compra que alimenta compras + cotações + despesas de uma vez
  // (uma compra vira cotação de preço e, se paga, vira despesa), sem um save
  // sobrescrever o outro. Só aplica as listas que vierem no objeto.
  const aplicarCompra = ({ comprasNovas, despesaNova, cotacoesNovas }) => {
    // Junta os itens novos ao estado ATUAL (fresco) e salva só esses campos.
    // Nunca reconstrói a lista inteira a partir de uma cópia da tela, que podia
    // estar um passo atrás e apagar o que a compra anterior acabou de gravar.
    const parcial = {};
    if (comprasNovas && comprasNovas.length) { const next = [...comprasNovas, ...compras]; setCompras(next); parcial.compras = next; }
    if (cotacoesNovas && cotacoesNovas.length) { const next = [...cotacoesNovas, ...cotacoes]; setCotacoes(next); parcial.cotacoes = next; }
    if (despesaNova) { const next = [despesaNova, ...despesas]; setDespesas(next); parcial.despesas = next; }
    if (Object.keys(parcial).length) salvarTudo(parcial);
    // Entradas automáticas no estoque (via API dedicada): os itens comprados que
    // já estão no catálogo têm o saldo somado. Fire-and-forget — não trava a
    // compra se o estoque falhar. Produtos não cadastrados viram sugestão.
    if (comprasNovas && comprasNovas.length) {
      fetch('/api/estoque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'entradaCompras', comprasNovas }) })
        .then((r) => r.json()).then((j) => {
          if (j?.ok && Array.isArray(j.itens)) setEstoque(j.itens);
          // Avisa se algum produto comprado não achou item no estoque (não entrou sozinho).
          if (j?.ok && Array.isArray(j.naoEntraram) && j.naoEntraram.length) {
            setAvisoBaixa(`Compra registrada. Só que ${j.naoEntraram.length > 1 ? 'estes não estão no estoque' : 'este não está no estoque'}: ${j.naoEntraram.join(', ')}. Cadastre com esse nome (Abastecimento → Estoque) pra entrar automático nas próximas.`);
            setTimeout(() => setAvisoBaixa(''), 12000);
          }
        }).catch(() => {});
    }
    if (comprasNovas && comprasNovas.length) syncGoogle();
  };

  // Estoque e fichas técnicas: fonte é a API dedicada /api/estoque (para ficar
  // em sincronia com a baixa feita ao fechar comandas por qualquer login).
  const carregarEstoque = useCallback(async ({ sincronizar = false } = {}) => {
    try {
      if (sincronizar) {
        const r = await fetch('/api/estoque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'sincronizar' }) });
        const j = await r.json();
        if (j?.ok) { setEstoque(j.itens || []); if (Array.isArray(j.fichas)) setFichas(j.fichas); setEstCarregado(true); if (j.resumo && j.resumo.itens > 0) { setAvisoBaixa(`Estoque atualizado com ${j.resumo.vendas} venda(s).`); setTimeout(() => setAvisoBaixa(''), 6000); } return; }
      }
      const r = await fetch('/api/estoque', { cache: 'no-store' });
      const j = await r.json();
      if (j?.ok) { setEstoque(j.itens || []); setFichas(j.fichas || []); }
    } catch { /* ignora */ }
    finally { setEstCarregado(true); }
  }, []);

  // Ao abrir a aba Estoque, recarrega e reconcilia (rede de segurança) as vendas.
  // Na Central de Operações (salão), carrega o estoque SÓ pra leitura (GET) — o
  // Cardápio precisa da lista de itens no seletor de "Fruta (do estoque)" dos
  // sabores/combos. Sem isso, quem ia direto pro Cardápio via a lista vazia.
  useEffect(() => {
    if (tab === 'abastecimento') carregarEstoque({ sincronizar: true });
    else if (tab === 'salao' || tab === 'financas' || tab === 'previsao' || tab === 'hoje' || tab === 'darci') carregarEstoque({});
  }, [tab, carregarEstoque]);

  // Uma ação do estoque (add/mov/edit/del/fichas): chama a API e atualiza o
  // estado com a resposta. Retorna o JSON pra quem precisa (ex.: id do novo item).
  const estoqueAcao = async (payload) => {
    try {
      const r = await fetch('/api/estoque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (j?.ok) { if (Array.isArray(j.itens)) setEstoque(j.itens); if (Array.isArray(j.fichas)) setFichas(j.fichas); }
      return j;
    } catch { return { ok: false }; }
  };

  // Lista de compras: um único save aplica listaCompras/modelos e, quando um
  // item é "lançado", também compras/despesas/cotações — sem corrida de estado.
  const aplicarLista = (parcial) => {
    // A Lista de Compras usa sempre a chave "listaCompras"; se a lista aberta é
    // a da cozinha, redireciona pra "listaCozinha" sem mudar o componente.
    const p = { ...parcial };
    if (qualLista === 'cozinha' && 'listaCompras' in p) { p.listaCozinha = p.listaCompras; delete p.listaCompras; }
    // Listas: substituição direta (é a própria lista, gerida aqui). Financeiro
    // (compras/despesas/cotações): junta só os NOVOS ao estado atual, pra não
    // apagar lançamentos recentes com uma cópia velha da tela.
    const salvar = {};
    if (p.listaCompras) { setListaCompras(p.listaCompras); salvar.listaCompras = p.listaCompras; }
    if (p.listaCozinha) { setListaCozinha(p.listaCozinha); salvar.listaCozinha = p.listaCozinha; }
    if (p.listasModelo) { setListasModelo(p.listasModelo); salvar.listasModelo = p.listasModelo; }
    if (p.comprasNovas && p.comprasNovas.length) { const next = [...p.comprasNovas, ...compras]; setCompras(next); salvar.compras = next; }
    if (p.cotacoesNovas && p.cotacoesNovas.length) { const next = [...p.cotacoesNovas, ...cotacoes]; setCotacoes(next); salvar.cotacoes = next; }
    if (p.despesaNova) { const next = [p.despesaNova, ...despesas]; setDespesas(next); salvar.despesas = next; }
    if (Object.keys(salvar).length) salvarTudo(salvar);
    if (salvar.compras) syncGoogle();
  };

  // Repor na Lista de Compras a partir de outras abas (estoque crítico no
  // fechamento, garrafa encerrada no Controle). Ignora itens que já estão na
  // lista em aberto e devolve quantos foram realmente adicionados.
  const reporLista = (itens) => {
    const existentes = new Set(listaCompras.filter((i) => !i.comprado).map((i) => (i.nome || '').trim().toLowerCase()));
    const novos = itens.filter((i) => !existentes.has((i.nome || '').trim().toLowerCase()));
    if (novos.length) upd.listaCompras([...novos, ...listaCompras]);
    return novos.length;
  };

  const sair = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  // Tema claro/escuro. O tema inicial já é aplicado no <html> por um script no
  // layout (sem piscar); aqui só lemos o valor atual e deixamos a Karen trocar.
  const [tema, setTema] = useState('escuro');
  useEffect(() => {
    const atual = document.documentElement.getAttribute('data-theme') === 'claro' ? 'claro' : 'escuro';
    setTema(atual);
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', atual === 'claro' ? '#F6F9FD' : '#0A1220');
  }, []);
  const trocarTema = () => {
    const novo = tema === 'claro' ? 'escuro' : 'claro';
    setTema(novo);
    document.documentElement.setAttribute('data-theme', novo);
    try { localStorage.setItem('picoos-tema', novo); } catch { /* ignora */ }
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', novo === 'claro' ? '#F6F9FD' : '#0A1220');
  };

  const tabs = [
    ['darci', 'Darci'], ['brain', 'Brain'], ['hoje', 'Dashboard'], ['diario', 'Log Operacional'], ['financas', 'Finanças'],
    ['abastecimento', 'Abastecimento'], ['previsao', 'Previsão'], ['garrafas', 'Controle'],
    ['salao', 'Central de Operações'], ['despesarapida', 'Despesa Rápida'],
    ['ponto', 'Ponto'], ['marketing', 'Marketing'], ['notificacoes', 'Notificações'], ['widget', 'Widget'], ['backup', 'Backup'],
  ];

  // Barra lateral: as áreas agrupadas por assunto (no PC fica fixa na lateral;
  // no celular abre com o botão de menu ☰).
  const [menuAberto, setMenuAberto] = useState(false);
  // No PC, dá pra recolher a lateral (ganha espaço) e mostrar de novo. Lembra a
  // preferência no aparelho.
  const [lateralRecolhida, setLateralRecolhida] = useState(false);
  useEffect(() => { try { if (localStorage.getItem('picoos-lateral') === 'recolhida') setLateralRecolhida(true); } catch { /* ignora */ } }, []);
  // Tela larga = a lateral cabe. Serve pra saber onde encaixar o Darci: na
  // lateral (computador) ou na barra de cima (celular).
  const [telaLarga, setTelaLarga] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 820px)');
    const ver = () => setTelaLarga(mq.matches);
    ver();
    mq.addEventListener ? mq.addEventListener('change', ver) : mq.addListener(ver);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', ver) : mq.removeListener(ver); };
  }, []);
  const recolherLateral = (v) => setLateralRecolhida((cur) => { const nv = v == null ? !cur : v; try { localStorage.setItem('picoos-lateral', nv ? 'recolhida' : 'aberta'); } catch { /* ignora */ } return nv; });
  const grupos = [
    { titulo: 'Início', itens: [['hoje', 'Dashboard'], ['darci', 'Darci'], ['brain', 'Brain']] },
    { titulo: 'Operação', itens: [['salao', 'Central de Operações'], ['garrafas', 'Controle'], ['ponto', 'Ponto']] },
    { titulo: 'Estoque', itens: [['abastecimento', 'Abastecimento'], ['previsao', 'Previsão']] },
    { titulo: 'Financeiro', itens: [['despesarapida', 'Despesa Rápida'], ['financas', 'Finanças'], ['diario', 'Log Operacional']] },
    { titulo: 'Gestão', itens: [['marketing', 'Marketing'], ['notificacoes', 'Notificações'], ['widget', 'Widget'], ['backup', 'Backup']] },
  ];

  // Lembra a última área aberta (no aparelho), pra que atualizar a página caia na
  // mesma aba em vez de voltar pro início. Restaura só na montagem.
  useEffect(() => {
    try { const t = localStorage.getItem('picoos-tab'); if (t && tabs.some(([id]) => id === t)) setTab(t); } catch { /* ignora */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try { localStorage.setItem('picoos-tab', tab); } catch { /* ignora */ }
  }, [tab]);

  // Atalho externo (ex.: Botão de Ação do iPhone). Abre direto a Despesa Rápida,
  // e se vier um texto ditado (?despesa=...), já preenche pra confirmar.
  // Aceita: ?despesa=texto, ?tela=despesa, ?add=despesa.
  const [despesaInicial, setDespesaInicial] = useState('');
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const txt = q.get('despesa');
      const tela = (q.get('tela') || q.get('add') || '').toLowerCase();
      if (txt != null || tela === 'despesa' || tela === 'despesarapida') {
        if (txt) setDespesaInicial(txt);
        setTab('despesarapida');
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch { /* ignora */ }
  }, []);

  // Navegação que entende os sub-destinos do setor Abastecimento: se pedirem
  // 'compras'/'estoque'/'lista'/'cotacoes', abre a aba Abastecimento já na
  // parte certa (usado pelos atalhos "Ver / + Compra" do Hoje).
  const irParaTab = (destino) => {
    if (['estoque', 'lista', 'compras', 'cotacoes'].includes(destino)) { setSubAbast(destino); setTab('abastecimento'); return; }
    if (['caixa', 'comandas', 'fiados', 'clientes', 'cardapio'].includes(destino)) { setSubSalao(destino); setTab('salao'); return; }
    if (['receitas', 'despesas', 'pagar', 'relatorios'].includes(destino)) { setSubFinancas(destino); setTab('financas'); return; }
    setTab(destino);
  };

  // Selo do Diário: tarefas com data até hoje ainda não feitas.
  const hojeIso = todayISO();
  const tarefasAlerta = tarefas.filter((t) => !t.feito && t.data && t.data <= hojeIso).length;
  // Fiado não vira "notificação" no topo: com vários em aberto pareceria alarme.
  // A conta de quem está devendo aparece na própria tela de Fiados.
  const badges = { diario: tarefasAlerta };

  const tabBarRef = useRef(null);
  // Mantém a aba ativa visível na barra ao trocar (só pelo botão da aba agora;
  // o gesto de deslizar pra trocar de aba foi removido, porque trocava sem querer).
  useEffect(() => {
    const bar = tabBarRef.current;
    if (!bar) return;
    const el = bar.querySelector(`[data-tab="${tab}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [tab]);

  // Falha ao carregar: mostra erro e botão de tentar de novo — NUNCA segue pro
  // app com dados vazios (senão qualquer edição salvaria por cima do que existe).
  if (erroLoad) return (
    <div style={{ minHeight: '100vh', background: C.ink, color: C.text, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', fontFamily: 'system-ui' }}>
      <div style={{ fontSize: 40 }}>📡</div>
      <div style={{ fontSize: 17, fontWeight: 800 }}>Não consegui carregar seus dados agora.</div>
      <div style={{ fontSize: 14, color: C.muted, maxWidth: 320, lineHeight: 1.5 }}>Pode ser a internet. Seus dados estão salvos e seguros — só não consegui buscá-los. Toque pra tentar de novo.</div>
      <button onClick={() => { try { window.location.reload(); } catch { /* ignora */ } }} style={{ background: C.accent, color: '#06101F', border: 'none', borderRadius: 12, padding: '13px 22px', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>Tentar de novo</button>
    </div>
  );

  if (!loaded) return (
    <div style={{ minHeight: '100vh', background: C.ink, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>Carregando seus dados…</div>
  );

  // O Darci fica encaixado numa barra que já existe: na lateral, no computador;
  // na barra de cima, no celular. Assim ele fica sempre alinhado com o resto.
  const propsDarci = {
    receitas, despesas, compras, vendas, estoque, tarefas, clientes,
    onAbrir: () => { carregarVendas(); carregarEstoque({}); },
  };
  const darciNaLateral = telaLarga && !lateralRecolhida;

  return (
    <div style={{ minHeight: '100vh', background: pageBg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <PullToRefresh />
      {salvarFalhou && (
        <div style={{ position: 'fixed', zIndex: 200, left: 0, right: 0, top: 0, background: C.red, color: '#fff', padding: 'calc(8px + env(safe-area-inset-top)) 14px 8px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', textAlign: 'center', lineHeight: 1.35 }}>
          <span>⚠️ Não consegui salvar sua última alteração (internet). Refaça quando a conexão voltar.</span>
          <button onClick={() => setSalvarFalhou(false)} style={{ background: 'rgba(255,255,255,.25)', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>OK</button>
        </div>
      )}
      <style>{`
.pos-shell{display:flex;align-items:stretch;min-height:100vh}
.pos-sidebar{width:236px;flex-shrink:0;box-sizing:border-box;display:flex;flex-direction:column;background:${C.panel};border-right:1px solid ${C.hair};position:sticky;top:0;height:100vh}
.pos-side-head{display:flex;align-items:center;gap:10px;padding:calc(16px + env(safe-area-inset-top)) 16px 14px;border-bottom:1px solid ${C.hair}}
.pos-nav{flex:1;overflow-y:auto;padding:12px 10px}
.pos-group{margin-bottom:12px}
.pos-group-title{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:${C.faint};font-weight:800;padding:4px 10px 6px}
.pos-navitem{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;border:none;background:transparent;color:${C.muted};border-radius:10px;padding:10px 12px;font-size:14px;font-weight:700;cursor:pointer;text-align:left;margin-bottom:2px}
.pos-navitem:hover{background:${C.panel2};color:${C.text}}
.pos-navitem.pos-active{background:${C.accent};color:#06101F}
.pos-badge{background:${C.red};color:#fff;font-size:11px;font-weight:800;min-width:18px;height:18px;border-radius:999px;padding:0 5px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.pos-navitem.pos-active .pos-badge{background:#06101F}
.pos-side-foot{border-top:1px solid ${C.hair};padding:12px;display:flex;align-items:center;gap:8px}
.pos-content{flex:1;min-width:0}
.pos-shell:not(.pos-recolhida) .pos-content{padding-top:env(safe-area-inset-top)}
.pos-topbar{display:none}
.pos-overlay{display:none}
.pos-shell.pos-recolhida .pos-sidebar{display:none}
.pos-shell.pos-recolhida .pos-topbar{display:flex;align-items:center;gap:12px;padding:calc(12px + env(safe-area-inset-top)) 16px 12px;border-bottom:1px solid ${C.hair};position:sticky;top:0;background:${C.barBg};backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);z-index:10}
.pos-recolher{background:transparent;border:none;color:${C.faint};border-radius:8px;width:30px;height:30px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pos-recolher:hover{background:${C.panel2};color:${C.text}}
.pos-burger{background:transparent;border:1px solid ${C.line};color:${C.text};border-radius:10px;width:42px;height:42px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
@media (max-width:819px){
.pos-sidebar{position:fixed;top:0;left:0;z-index:60;transform:translateX(-100%);transition:transform .22s ease;box-shadow:0 0 40px rgba(0,0,0,.4)}
.pos-sidebar.pos-open{transform:translateX(0)}
.pos-shell.pos-recolhida .pos-sidebar{display:flex}
.pos-shell:not(.pos-recolhida) .pos-content{padding-top:0}
.pos-recolher{display:none}
.pos-overlay{display:block;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:55}
.pos-topbar{display:flex;align-items:center;gap:12px;padding:calc(12px + env(safe-area-inset-top)) 16px 12px;border-bottom:1px solid ${C.hair};position:sticky;top:0;background:${C.barBg};backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);z-index:10}
}
`}</style>

      <div className={`pos-shell${lateralRecolhida ? ' pos-recolhida' : ''}`}>
        {menuAberto && <div className="pos-overlay" onClick={() => setMenuAberto(false)} />}
        <aside className={`pos-sidebar${menuAberto ? ' pos-open' : ''}`}>
          <div className="pos-side-head">
            <LogoMark size={34} radius={10} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>PicoOS</div>
              <div style={{ fontSize: 10, color: C.accent, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 2, fontWeight: 600 }}>Central de Gestão</div>
            </div>
            <button className="pos-recolher" onClick={() => recolherLateral(true)} title="Recolher a lateral" aria-label="Recolher a lateral" style={{ marginLeft: 'auto' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
          </div>
          <nav className="pos-nav">
            {grupos.map((g) => (
              <div key={g.titulo} className="pos-group">
                <div className="pos-group-title">{g.titulo}</div>
                {g.itens.map(([id, nome]) => (
                  <button key={id} onClick={() => { setTab(id); setMenuAberto(false); }} className={`pos-navitem${tab === id ? ' pos-active' : ''}`}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
                    {badges[id] > 0 && <span className="pos-badge">{badges[id]}</span>}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          {tab !== 'darci' && darciNaLateral && (
            <div style={{ padding: '0 12px 10px' }}>
              <DarciFlutuante cheio {...propsDarci} />
            </div>
          )}
          <div className="pos-side-foot">
            <BotaoAtualizar />
            <button onClick={trocarTema} title={tema === 'claro' ? 'Mudar para escuro' : 'Mudar para claro'} aria-label="Trocar tema"
              style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {tema === 'claro' ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.4 19.6l1.6-1.6M18 6l1.6-1.6" /></svg>
              )}
            </button>
            <button onClick={sair} style={{ flex: 1, background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Sair</button>
          </div>
        </aside>
        <div className="pos-content">
          <div className="pos-topbar">
            <button className="pos-burger" onClick={() => { if (typeof window !== 'undefined' && window.innerWidth >= 820) recolherLateral(false); else setMenuAberto(true); }} aria-label="Abrir menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 }}>
              <LogoMark size={28} radius={9} />
              <div style={{ fontSize: 16, fontWeight: 900 }}>PicoOS</div>
            </div>
            {tab !== 'darci' && !darciNaLateral && <DarciFlutuante {...propsDarci} />}
            {tab !== 'despesarapida' && (
              <button onClick={() => setTab('despesarapida')} aria-label="Despesa rápida" title="Despesa rápida"
                style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.accent, borderRadius: 10, padding: '7px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            )}
            <BotaoAtualizar />
          </div>

      <div style={{ maxWidth: tab === 'brain' ? 1180 : 760, margin: '0 auto', padding: '18px calc(16px + env(safe-area-inset-right)) calc(60px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))' }}>
        {tab === 'darci' && <Darci receitas={receitas} despesas={despesas} compras={compras} vendas={vendas} estoque={estoque} tarefas={tarefas} clientes={clientes} />}
        {tab === 'brain' && <Brain tarefas={tarefas} onTarefas={upd.tarefas} ideias={ideias} onIdeias={upd.ideias} />}
        {tab === 'hoje' && <Hoje diario={diario} receitas={receitas} despesas={despesas} compras={compras} garrafas={garrafas} tarefas={tarefas} estoque={estoque} vendas={vendas} setTab={irParaTab} />}
        {tab === 'diario' && <Diario dados={diario} onChange={upd.diario} receitas={receitas} onReceitas={upd.receitas} visitantes={visitantes} onVisitantes={upd.visitantes} onRepor={reporLista} pessoasPorDia={pessoasPorDia} pedidosPorDia={pedidosPorDia} fiadosPorDia={fiadosPorDia} />}
        {tab === 'financas' && (
          <>
            <div style={{ display: 'flex', overflowX: 'auto', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 2, gap: 2, marginBottom: 14 }}>
              {[['raiox', 'Raio-X'], ['receitas', 'Receitas'], ['despesas', 'Despesas'], ['pagar', 'Contas a Pagar'], ['relatorios', 'Relatórios']].map(([v, rot]) => (
                <button key={v} onClick={() => setSubFinancas(v)} style={{
                  flexShrink: 0, border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700,
                  background: subFinancas === v ? C.accent : 'transparent', color: subFinancas === v ? '#06101F' : C.muted, whiteSpace: 'nowrap',
                }}>{rot}</button>
              ))}
            </div>
            {subFinancas === 'receitas' && <Lancamentos tipo="receita" dados={receitas} onChange={upd.receitas} />}
            {subFinancas === 'despesas' && <Lancamentos tipo="despesa" dados={despesas} onChange={upd.despesas} />}
            {subFinancas === 'pagar' && <ContasPagar dados={compras} onChange={upd.compras} despesas={despesas} onPagamento={aplicarPagamento} />}
            {subFinancas === 'raiox' && <RaioX receitas={receitas} despesas={despesas} cardapio={cardapio} fichas={fichas} estoque={estoque} />}
            {subFinancas === 'relatorios' && <Relatorios diario={diario} receitas={receitas} despesas={despesas} mes={mes} setMes={setMes} />}
          </>
        )}
        {tab === 'abastecimento' && (
          <>
            <div style={{ display: 'flex', overflowX: 'auto', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 2, gap: 2, marginBottom: 14 }}>
              {[['estoque', 'Estoque'], ['margem', 'Margem'], ['lista', 'Lista de Compras'], ['compras', 'Compras'], ['cotacoes', 'Cotações']].map(([v, rot]) => (
                <button key={v} onClick={() => setSubAbast(v)} style={{
                  flexShrink: 0, border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700,
                  background: subAbast === v ? C.accent : 'transparent', color: subAbast === v ? '#06101F' : C.muted, whiteSpace: 'nowrap',
                }}>{rot}</button>
              ))}
            </div>

            {avisoBaixa && (
              <div style={{ background: C.panel2, border: `1px solid ${C.accent}`, color: C.text, borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 12, lineHeight: 1.45 }}>{avisoBaixa}</div>
            )}
            {subAbast === 'estoque' && (
              <>
                <div style={{ display: 'flex', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 2, gap: 2, marginBottom: 14 }}>
                  {[['itens', 'Estoque'], ['fichas', 'Fichas técnicas'], ['conferencia', 'Conferência'], ['cortesia', 'Cortesia / Consumo']].map(([v, rot]) => (
                    <button key={v} onClick={() => setSubEstoque(v)} style={{
                      flex: 1, border: 'none', cursor: 'pointer', borderRadius: 8, padding: '7px 10px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                      background: subEstoque === v ? C.accent : 'transparent', color: subEstoque === v ? '#06101F' : C.muted,
                    }}>{rot}</button>
                  ))}
                </div>
                {subEstoque === 'itens' && <Estoque itens={estoque} carregado={estCarregado} onAcao={estoqueAcao} compras={compras} onRepor={reporLista} />}
                {subEstoque === 'fichas' && <FichasTecnicas cardapio={cardapio} estoque={estoque} fichas={fichas} onAcao={estoqueAcao} />}
                {subEstoque === 'conferencia' && <ConferenciaEstoque estoque={estoque} fichas={fichas} cardapio={cardapio} vendas={vendas} onAcao={estoqueAcao} carregado={estCarregado} />}
                {subEstoque === 'cortesia' && <CortesiaConsumo onFeito={() => carregarEstoque({})} />}
              </>
            )}

            {subAbast === 'lista' && (
              <>
                <div style={{ display: 'inline-flex', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 2, gap: 2, marginBottom: 14 }}>
                  {[['minha', 'Minha lista'], ['cozinha', 'Da cozinha']].map(([v, rot]) => (
                    <button key={v} onClick={() => setQualLista(v)} style={{
                      border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700,
                      background: qualLista === v ? C.accent : 'transparent', color: qualLista === v ? '#06101F' : C.muted,
                    }}>{rot}</button>
                  ))}
                </div>
                <ListaCompras key={qualLista}
                  itens={qualLista === 'cozinha' ? listaCozinha : listaCompras}
                  modelos={listasModelo} cotacoes={cotacoes} compras={compras} despesas={despesas} estoque={estoque} onAplicar={aplicarLista}
                  tarefasCozinha={tarefasCozinha} onTarefasCozinha={upd.tarefasCozinha}
                  subtitulo={qualLista === 'cozinha' ? 'O que a cozinha pediu pra repor' : 'O que falta repor no bar'}
                  mostrarTarefasCozinha={qualLista === 'cozinha'} />
              </>
            )}

            {subAbast === 'compras' && <Compras dados={compras} cotacoes={cotacoes} despesas={despesas} estoque={estoque} onChange={upd.compras} onRegistrar={aplicarCompra} />}
            {subAbast === 'margem' && <Margem cardapio={cardapio} fichas={fichas} estoque={estoque} />}
            {subAbast === 'cotacoes' && <Cotacoes dados={cotacoes} onChange={upd.cotacoes} estoque={estoque} compras={compras} />}
          </>
        )}
        {tab === 'garrafas' && <Garrafas dados={garrafas} onChange={upd.garrafas} onRepor={reporLista} />}
        {tab === 'salao' && (
          <>
            <div style={{ display: 'flex', overflowX: 'auto', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 2, gap: 2, marginBottom: 14 }}>
              {[['caixa', 'Caixa'], ['comandas', 'Comandas'], ['fiados', 'Fiados'], ['clientes', 'Clientes'], ['cardapio', 'Cardápio']].map(([v, rot]) => (
                <button key={v} onClick={() => setSubSalao(v)} style={{
                  flexShrink: 0, border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700,
                  background: subSalao === v ? C.accent : 'transparent', color: subSalao === v ? '#06101F' : C.muted,
                  display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                }}>
                  {rot}
                </button>
              ))}
            </div>
            {subSalao === 'comandas' && <Comandas papel="dona" />}
            {subSalao === 'caixa' && <Caixa />}
            {subSalao === 'cardapio' && <Cardapio dados={cardapio} onChange={upd.cardapio} estoque={estoque} />}
            {subSalao === 'fiados' && <Fiados onMudou={carregarVendas} clientes={clientes} />}
            {subSalao === 'clientes' && <Clientes dados={clientes} onChange={upd.clientes} vendas={vendas} />}
          </>
        )}
        {tab === 'ponto' && <PontoDona />}

        {tab === 'marketing' && <Marketing dados={marketing} onChange={upd.marketing} receitas={receitas} />}
        {tab === 'notificacoes' && <Notificacoes />}
        {tab === 'widget' && <Widget />}
        {tab === 'previsao' && <Previsao vendas={vendas} cardapio={cardapio} fichas={fichas} estoque={estoque} />}
        {tab === 'despesarapida' && <DespesaRapida dados={despesas} onChange={upd.despesas} textoInicial={despesaInicial} />}
        {tab === 'backup' && (<><Auditoria receitas={receitas} despesas={despesas} compras={compras} vendas={vendas} onMudou={carregarVendas} /><Backup all={{ diario, receitas, despesas, compras, cotacoes, garrafas, tarefas, ideias, marketing, visitantes, listaCompras, listasModelo, cardapio, clientes, estoque, fichas }} restore={(d) => {
          const dados = {
            diario: d.diario || diario, receitas: d.receitas || receitas, despesas: d.despesas || despesas,
            compras: d.compras || compras, cotacoes: d.cotacoes || cotacoes, garrafas: d.garrafas || garrafas,
            tarefas: d.tarefas || tarefas, ideias: d.ideias || ideias, marketing: d.marketing || marketing, visitantes: d.visitantes || visitantes,
            listaCompras: d.listaCompras || listaCompras, listasModelo: d.listasModelo || listasModelo,
            cardapio: d.cardapio || cardapio, clientes: d.clientes || clientes,
          };
          setDiario(dados.diario); setReceitas(dados.receitas); setDespesas(dados.despesas);
          setCompras(dados.compras); setCotacoes(dados.cotacoes); setGarrafas(dados.garrafas);
          setTarefas(dados.tarefas); setIdeias(dados.ideias); setMarketing(dados.marketing); setVisitantes(dados.visitantes);
          setListaCompras(dados.listaCompras); setListasModelo(dados.listasModelo); setCardapio(dados.cardapio); setClientes(dados.clientes);
          apiSalvar(dados);
        }} /><TrocarSenha /></>)}
      </div>
        </div>
      </div>

    </div>
  );
}
