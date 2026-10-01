'use client';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { C, Btn, LogoMark, pageBg } from './ui';
import { ymOf, todayISO, limparNome, fiadoDaVenda, uid, num, brl } from '../lib/util';
import { comprasPendentesDeEstoque } from '../lib/estoque';
import { limparCopiaGuardada } from '../lib/versao';
import { lerNegocio } from '../lib/negocio';
import { lerModulos, darciDisponivel } from '../lib/modulos';
import { metaDoMes } from '../lib/meta';
import { ajustarDespesas } from '../lib/despesaDaCompra';
import SEED_DATA from '../data/seed.json';

import Brain from './Brain';
import Darci from './Darci';
import DarciFlutuante from './DarciFlutuante';
import Hoje from './Hoje';
import ResumoDoDia from './ResumoDoDia';
import Pasta from './Pasta';
import EstiloShell from './EstiloShell';
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
import Config from './Config';
import MeuNegocio from './MeuNegocio';
import PrimeiroUso from './PrimeiroUso';
import Guia from './Guia';
import Reservas from './Reservas';
import Cardapio from './Cardapio';
import Comandas from './Comandas';
import VendasDoDia from './VendasDoDia';
import Acessos from './Acessos';
import Caixa from './Caixa';
import Fiados from './Fiados';
import Clientes from './Clientes';
import Estoque from './Estoque';
import Margem from './Margem';
import Fornecedores from './Fornecedores';
import FichasTecnicas from './FichasTecnicas';
import ConferenciaEstoque from './ConferenciaEstoque';
import Auditoria from './Auditoria';
import TrocarSenha from './TrocarSenha';
import Notificacoes from './Notificacoes';
import DespesaRapida from './DespesaRapida';
import Widget from './Widget';
import Previsao from './Previsao';
import BotaoAtualizar from './BotaoAtualizar';
import AtualizacaoAuto from './AtualizacaoAuto';
import LembreteAgenda from './LembreteAgenda';
import VersaoApp from './VersaoApp';
import PullToRefresh from './PullToRefresh';

const arr = (v) => (Array.isArray(v) ? v : []);

// Carrega o painel com TENTATIVAS (rede/cold start falham às vezes). Devolve
// { ok, dados }: ok=false quando NÃO conseguiu ler de jeito nenhum — nesse caso
// o app NUNCA deve semear/salvar por cima, senão apaga os dados reais.
//
// QUANDO FALHA, AGORA DIZ POR QUÊ. Antes tudo virava a mesma tela — "pode ser a
// internet" — mesmo quando a internet estava ótima e o problema era outro. Ela
// tocava "Tentar de novo" e nada mudava, porque tentar de novo não era o
// conserto. São três coisas diferentes, com saídas diferentes:
//
//   'sessao'   — o acesso venceu. Insistir aqui não resolve NUNCA; quem resolve
//                é a tela de senha. Acontece quando a página que abriu veio da
//                cópia guardada no aparelho, de um dia em que ela estava
//                logada: a tela é de dentro, mas o crachá já não vale.
//   'servidor' — o servidor respondeu, e respondeu com defeito (o banco não
//                atendeu, por exemplo). Aí importa MOSTRAR o que ele disse.
//   'rede'     — o pedido nem chegou. Esse sim é internet.
async function apiCarregar() {
  let motivo = 'rede';
  let status = 0;
  let detalhe = '';
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    try {
      const res = await fetch('/api/data', { cache: 'no-store' });
      status = res.status;
      if (res.status === 401) return { ok: false, dados: null, motivo: 'sessao', status, detalhe: '' };
      motivo = 'servidor';
      let json = null;
      try { json = await res.json(); } catch { /* resposta que não é JSON */ }
      if (res.ok && json && json.ok) return { ok: true, dados: json.dados };
      detalhe = (json && json.erro) ? String(json.erro).slice(0, 180) : '';
    } catch { motivo = 'rede'; status = 0; detalhe = ''; }
    await new Promise((r) => setTimeout(r, 500 * (tentativa + 1)));
  }
  return { ok: false, dados: null, motivo, status, detalhe };
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
  // null enquanto está tudo bem; { motivo, status, detalhe } quando a leitura
  // falhou — porque a tela de erro precisa DIZER qual dos três problemas é.
  const [erroLoad, setErroLoad] = useState(null);
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
  // A meta de faturamento do mês e os dias em que o bar abre. Não é lista: é
  // um objetinho { padrao, diasSemana, '2026-10': ... }.
  const [metas, setMetas] = useState(null);
  // O nome do negócio e os nomes dos acessos. Cada um põe o seu — por isso
  // nada disso fica escrito no código.
  const [negocio, setNegocio] = useState(null);
  // O que este negócio usa, e o que esta instalação consegue fazer. O Darci
  // depende dos dois: ele custa por pergunta e precisa de chave no servidor.
  const [modulos, setModulos] = useState(lerModulos({}));
  const [recursos, setRecursos] = useState({ darci: true, voz: true });
  // Acessos que ainda entram com "1234". O padrão de fábrica é de propósito —
  // a pessoa precisa entrar no primeiro dia —, mas um 1234 esquecido é outra
  // coisa. A tela cobra até trocar.
  const [senhasDeFabrica, setSenhasDeFabrica] = useState([]);
  const [escondeuAvisoSenha, setEscondeuAvisoSenha] = useState(false);
  const [tarefasCozinha, setTarefasCozinha] = useState([]);
  const [cardapio, setCardapio] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [fichas, setFichas] = useState([]);         // fichas técnicas (fonte: /api/estoque)
  const [dupIgnorados, setDupIgnorados] = useState([]); // grupos que ela já disse que não são o mesmo produto
  const [estCarregado, setEstCarregado] = useState(false);
  const [subEstoque, setSubEstoque] = useState('itens'); // 'itens' | 'fichas'
  const [subAbast, setSubAbast] = useState('estoque'); // 'estoque' | 'lista' | 'compras' | 'cotacoes'
  // COMPRAS QUE NUNCA VIRARAM SALDO.
  //
  // A conta ja existia dentro da tela de Compras — e por isso so aparecia pra
  // quem abrisse a tela de Compras. Ela estava na comanda tentando vender uma
  // Original quando descobriu que a nota de ontem nao tinha entrado.
  //
  // Aqui em cima ela vale pro setor inteiro: qualquer aba do Abastecimento
  // mostra que tem nota pendurada, e o aviso so sai quando o problema sai.
  const comprasSemSaldo = useMemo(() => comprasPendentesDeEstoque(compras, estoque), [compras, estoque]);

  // Carrinho montado pela fala, a caminho da tela de Compras. Fica aqui porque
  // as duas telas sao irmas e nao se enxergam.
  const [carrinhoDaVoz, setCarrinhoDaVoz] = useState(null);
  const [subFinancas, setSubFinancas] = useState('receitas'); // 'receitas' | 'despesas' | 'relatorios'
  const [avisoBaixa, setAvisoBaixa] = useState(''); // resumo da última baixa automática
  // O aviso de "deu certo" se apaga sozinho depois de um tempo; o de problema
  // NÃO. Só que o relógio do anterior apagava o aviso seguinte — inclusive um
  // aviso de problema que tinha que ficar. Guardado aqui pra ser cancelado.
  const relogioAviso = useRef(null);
  const avisar = (texto, apagarEm = 0) => {
    clearTimeout(relogioAviso.current);
    setAvisoBaixa(texto);
    if (apagarEm > 0) relogioAviso.current = setTimeout(() => setAvisoBaixa(''), apagarEm);
  };
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
      if (!r.ok) {
        // ACESSO VENCIDO NUMA PÁGINA GUARDADA.
        //
        // A tela de dentro abriu porque veio da cópia no aparelho, mas o crachá
        // já não vale — e aí "Tentar de novo" ficava pra sempre, porque o que
        // faltava era a senha, não a internet. Joga fora a cópia e recarrega:
        // o servidor manda a tela de senha, ela entra e volta ao trabalho.
        //
        // Uma vez só. Se depois de limpar ainda der acesso vencido, o problema é
        // outro e ela precisa LER isso, não ficar num vai-e-volta.
        if (r.motivo === 'sessao') {
          let jaLimpou = true;
          try { jaLimpou = sessionStorage.getItem('picoos:sessao-vencida') === '1'; } catch { jaLimpou = true; }
          if (!jaLimpou) {
            try { sessionStorage.setItem('picoos:sessao-vencida', '1'); } catch { /* ignora */ }
            await limparCopiaGuardada();
            try { window.location.reload(); return; } catch { /* segue pra tela de erro */ }
          }
        }
        setErroLoad({ motivo: r.motivo || 'rede', status: r.status || 0, detalhe: r.detalhe || '' });
        return;
      }
      try { sessionStorage.removeItem('picoos:sessao-vencida'); } catch { /* ignora */ }
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
      setMetas((salvo && typeof salvo.metas === 'object' && salvo.metas) || null);
      setNegocio(lerNegocio(salvo || {}));
      // NA PRIMEIRA ABERTURA, a configuração é a do seed — que é justamente o
      // que acabou de ser gravado. Lendo de `salvo` (vazio), a tela abria com o
      // Darci LIGADO e só obedecia o desligado depois de um recarregamento. Ou
      // seja: no exato momento em que o cliente abre o app pela primeira vez.
      setModulos(lerModulos(primeiraVez ? SEED_DATA : (salvo || {})));
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

  // Quais acessos ainda estão na senha de fábrica. Relê quando ela volta da
  // tela de Acessos, pra o aviso sumir assim que a troca acontece.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/acessos', { cache: 'no-store' });
        const j = await r.json();
        if (j?.ok) setSenhasDeFabrica((j.acessos || []).filter((a) => a.deFabrica).map((a) => a.nome || a.papel));
      } catch { /* sem aviso é melhor do que aviso errado */ }
    })();
  }, [tab]);

  // O que ESTA instalação consegue fazer (tem chave de IA?). Sem isso, uma
  // cópia sem chave mostraria o Darci e ele não responderia nada.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/recursos', { cache: 'no-store' });
        const j = await r.json();
        if (j?.ok) setRecursos({ darci: !!j.darci, voz: !!j.voz });
      } catch { /* na dúvida, deixa como está */ }
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
  useEffect(() => { if (tab === 'salao' && (subSalao === 'fiados' || subSalao === 'vendas')) carregarVendas(); }, [subSalao]);


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
    // APAGAR O ÚLTIMO ITEM DE UMA LISTA É INTENÇÃO, NÃO ACIDENTE.
    //
    // O servidor tem uma rede de segurança que NÃO deixa um salvamento esvaziar
    // uma lista financeira — ela existe porque um aparelho com cópia velha
    // gravando por cima já apagou dados de verdade uma vez.
    //
    // Só que a rede pegava junto o caso legítimo: tirar a última despesa, a
    // última compra. A tela mostrava vazio, o banco voltava cheio, e ninguém
    // avisava. Aqui a gente sabe a diferença — a lista tinha item, a ação dela
    // zerou — então diz isso ao servidor. Aparelho com cópia velha nunca diz,
    // porque nem sabe que está apagando algo.
    const atuais = { diario, receitas, despesas, compras, cotacoes, garrafas };
    const intencional = Object.keys(parcial).filter((k) => Array.isArray(parcial[k]) && parcial[k].length === 0
      && Array.isArray(atuais[k]) && atuais[k].length > 0);
    apiSalvar(intencional.length ? { ...parcial, intencional } : { ...parcial });
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
    metas: (v) => { setMetas(v); salvarTudo({ metas: v }); },
    negocio: (v) => { setNegocio(v); salvarTudo({ negocio: v }); },
    modulos: (v) => { setModulos(v); salvarTudo({ modulos: v }); },
    clientes: (v) => { setClientes(v); salvarTudo({ clientes: v }); },
  };

  // Marca/desfaz pagamento de contas aplicando a mudança no estado ATUAL (fresco)
  // — nunca numa lista reconstruída pela tela, que podia estar um passo atrás e
  // apagar uma compra/despesa recém-lançada. Recebe a INTENÇÃO (quais ids pagar/
  // estornar, a despesa a lançar/remover) e aplica sobre compras/despesas atuais.
  const aplicarPagamento = (op) => {
    let nc = compras;
    let nd = despesas;
    let mexeuCompras = false;
    let mexeuDespesas = false;

    if (op.pagarIds && op.pagarIds.length) {
      const ids = new Set(op.pagarIds);
      nc = nc.map((x) => (ids.has(x.id) ? { ...x, pago: 'Sim', dataPagamento: op.hoje, despesaId: op.despId } : x));
      mexeuCompras = true;
    }
    if (op.estornarIds && op.estornarIds.length) {
      const ids = new Set(op.estornarIds);
      nc = nc.map((x) => (ids.has(x.id) ? { ...x, pago: 'Não', dataPagamento: '', despesaId: '' } : x));
      mexeuCompras = true;
    }
    // A LINHA DE COMPRA EDITADA NA MÃO, vinda da tela de Compras.
    //
    // Lá o "Já foi paga?" só trocava a palavra na linha, e o dinheiro nunca
    // chegava no financeiro — duas portas pro mesmo ato e só uma funcionava.
    // A lista vem pronta da tela junto com o efeito no dinheiro, pra as duas
    // coisas caírem no MESMO salvamento: meia edição gravada seria pior que
    // nenhuma.
    if (Array.isArray(op.comprasSubstituir)) { nc = op.comprasSubstituir; mexeuCompras = true; }

    if (op.despesaNova) { nd = [op.despesaNova, ...nd]; mexeuDespesas = true; }
    if (op.removerDespesaIds && op.removerDespesaIds.length) {
      const rm = new Set(op.removerDespesaIds);
      nd = nd.filter((d) => !rm.has(d.id)); mexeuDespesas = true;
    }
    if (op.ajustarDespesa && op.ajustarDespesa.id) { nd = ajustarDespesas(nd, op.ajustarDespesa); mexeuDespesas = true; }

    const parcial = {};
    if (mexeuCompras) { setCompras(nc); parcial.compras = nc; }
    if (mexeuDespesas) { setDespesas(nd); parcial.despesas = nd; }
    if (Object.keys(parcial).length) { salvarTudo(parcial); syncGoogle(); }
  };

  // Registro de compra que alimenta compras + cotações + despesas de uma vez
  // (uma compra vira cotação de preço e, se paga, vira despesa), sem um save
  // sobrescrever o outro. Só aplica as listas que vierem no objeto.
  // UM PEDIDO SÓ, PORQUE DOIS CORRIAM UM CONTRA O OUTRO.
  //
  // Antes isto disparava dois salvamentos ao mesmo tempo: /api/data com a
  // compra/despesa/cotação e /api/estoque com o saldo. Os dois leem o painel
  // inteiro, mexem na cópia e gravam de volta — então o último a gravar apagava
  // o que o outro tinha acabado de fazer. Ora sumia a compra do financeiro, ora
  // o saldo voltava ao que era ("no finanças entrou, no estoque não").
  //
  // Agora o servidor faz tudo numa gravação só. E o retorno é a verdade do
  // banco: a tela passa a mostrar o que ficou salvo, não o que ela esperava.
  const aplicarCompra = async ({ comprasNovas, despesaNova, cotacoesNovas }) => {
    if (!comprasNovas || !comprasNovas.length) return { ok: false };
    try {
      const r = await fetch('/api/estoque', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'entradaCompras', comprasNovas, despesaNova, cotacoesNovas }),
      });
      // Uma resposta que não é JSON (a tela de login do servidor, a página de
      // erro do Vercel, o HTML de uma sessão vencida) fazia `r.json()` estourar
      // e cair no catch dizendo "a conexão falhou" — que é a explicação errada e
      // manda ela esperar a internet voltar à toa. Aqui o motivo é o de verdade.
      let j = null;
      try { j = await r.json(); } catch { j = null; }
      if (!r.ok || !j?.ok) {
        const motivo = j?.erro || (r.status === 401 ? 'a sessão venceu — sai e entra de novo' : r.status === 403 ? 'este login não pode registrar compras' : `o servidor respondeu ${r.status}`);
        const e = new Error(motivo); e.status = r.status; throw e;
      }
      if (Array.isArray(j.itens)) setEstoque(j.itens);
      if (Array.isArray(j.compras)) setCompras(j.compras);
      if (Array.isArray(j.despesas)) setDespesas(j.despesas);
      if (Array.isArray(j.cotacoes)) setCotacoes(j.cotacoes);
      const naoEntraram = Array.isArray(j.naoEntraram) ? j.naoEntraram : [];
      const entradas = Array.isArray(j.entradas) ? j.entradas : [];
      // CONFIRMAÇÃO POSITIVA, sempre. Ela disse que não confia nesta área, e
      // com razão: até aqui o silêncio significava "deu certo" E "deu errado" —
      // não havia como distinguir um do outro olhando a tela.
      const qtdBR = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
      const listaOk = entradas.map((e) => `+${qtdBR(e.qtd)} ${e.unidade} em ${e.nome}`).join(' · ');
      if (naoEntraram.length) {
        // Sem timeout: isto não se resolve sozinho, e sumir da tela é o que fez
        // os casos anteriores passarem batido.
        avisar(`Compra registrada${listaOk ? ` e estoque somado: ${listaOk}` : ''} — mas ${naoEntraram.length > 1 ? 'estes produtos não somaram saldo' : 'este produto não somou saldo'}: ${naoEntraram.join(', ')}. Usa o painel "Não somou no estoque" aqui embaixo pra ligar cada um ao item certo.`);
      } else if (listaOk) {
        avisar(`Compra registrada e estoque somado: ${listaOk}.`, 12000);
      } else {
        avisar('Compra registrada no financeiro. Nenhum item de estoque foi somado — nada nesta nota está ligado a um produto do estoque.');
      }
      syncGoogle();
      return { ok: true, entradas, naoEntraram };
    } catch (e) {
      // Uma gravação só tem uma vantagem grande: quando falha, não deixa
      // metade. Nada entrou — então a nota fica guardada no aparelho e ela só
      // toca de novo, sem digitar tudo outra vez.
      // `fetch` que não sai do aparelho diz "Failed to fetch", em inglês e sem
      // explicar nada. Quem lê isto é ela.
      const cru = e?.message || '';
      const motivo = (!e?.status && (!cru || /failed to fetch|load failed|network/i.test(cru)))
        ? 'não deu pra falar com o servidor (internet)' : cru || 'a conexão falhou';
      avisar(`A compra NÃO foi salva: ${motivo}. Nada foi pro financeiro nem pro estoque — não ficou nada pela metade. A nota está guardada aqui no aparelho: toca em "Registrar compra" de novo.`);
      return { ok: false, erro: motivo, status: e?.status || 0 };
    }
  };

  // Estoque e fichas técnicas: fonte é a API dedicada /api/estoque (para ficar
  // em sincronia com a baixa feita ao fechar comandas por qualquer login).
  const carregarEstoque = useCallback(async ({ sincronizar = false } = {}) => {
    try {
      if (sincronizar) {
        const r = await fetch('/api/estoque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'sincronizar' }) });
        const j = await r.json();
        if (j?.ok) { setEstoque(j.itens || []); if (Array.isArray(j.fichas)) setFichas(j.fichas); setEstCarregado(true); if (j.resumo && j.resumo.itens > 0) { avisar(`Estoque atualizado com ${j.resumo.vendas} venda(s).`, 6000); } return; }
      }
      const r = await fetch('/api/estoque', { cache: 'no-store' });
      const j = await r.json();
      if (j?.ok) { setEstoque(j.itens || []); setFichas(j.fichas || []); setDupIgnorados(j.duplicadosIgnorados || []); }
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
      if (j?.ok) {
        if (Array.isArray(j.itens)) setEstoque(j.itens);
        if (Array.isArray(j.fichas)) setFichas(j.fichas);
        if (Array.isArray(j.duplicadosIgnorados)) setDupIgnorados(j.duplicadosIgnorados);
        // Juntar itens repetidos remenda as compras que apontavam pro item
        // absorvido — o servidor devolve a lista já corrigida.
        if (Array.isArray(j.compras)) setCompras(j.compras);
      }
      return j;
    } catch { return { ok: false }; }
  };

  // Lista de compras: um único save aplica listaCompras/modelos e, quando um
  // item é "lançado", também compras/despesas/cotações — sem corrida de estado.
  const aplicarLista = async (parcial) => {
    // A Lista de Compras usa sempre a chave "listaCompras"; se a lista aberta é
    // a da cozinha, redireciona pra "listaCozinha" sem mudar o componente.
    const p = { ...parcial };
    if (qualLista === 'cozinha' && 'listaCompras' in p) { p.listaCozinha = p.listaCompras; delete p.listaCompras; }

    // "LANÇAR" DA LISTA DE COMPRAS TAMBÉM É UMA COMPRA — E NÃO IA PRO ESTOQUE.
    //
    // Este caminho gravava compra, despesa e cotação e não chamava o estoque
    // nenhuma vez. Quem lançava daqui via o dinheiro entrar e a prateleira
    // continuar igual, sempre — não era azar de cronômetro, era buraco mesmo.
    // Agora passa pelo MESMO pedido único do formulário de Compras.
    //
    // E vai ANTES de marcar a lista: se a gravação falhar, o item não pode
    // ficar marcado como "lançado" sem existir compra nenhuma.
    if (p.comprasNovas && p.comprasNovas.length) {
      const r = await aplicarCompra({ comprasNovas: p.comprasNovas, despesaNova: p.despesaNova || null, cotacoesNovas: p.cotacoesNovas || [] });
      if (!r || r.ok === false) return r || { ok: false };
    }

    // Listas: substituição direta (é a própria lista, gerida aqui). O
    // financeiro já foi gravado acima, então aqui vai só o que sobrou.
    const salvar = {};
    if (p.listaCompras) { setListaCompras(p.listaCompras); salvar.listaCompras = p.listaCompras; }
    if (p.listaCozinha) { setListaCozinha(p.listaCozinha); salvar.listaCozinha = p.listaCozinha; }
    if (p.listasModelo) { setListasModelo(p.listasModelo); salvar.listasModelo = p.listasModelo; }
    if (!(p.comprasNovas && p.comprasNovas.length)) {
      if (p.cotacoesNovas && p.cotacoesNovas.length) { const next = [...p.cotacoesNovas, ...cotacoes]; setCotacoes(next); salvar.cotacoes = next; }
      if (p.despesaNova) { const next = [p.despesaNova, ...despesas]; setDespesas(next); salvar.despesas = next; }
    }
    if (Object.keys(salvar).length) salvarTudo(salvar);
    return { ok: true };
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
  // A cor do destaque (azul, verde, roxo…). Vazio = o azul de sempre.
  const [cor, setCor] = useState('');
  const [configAberta, setConfigAberta] = useState(false);
  useEffect(() => {
    const atual = document.documentElement.getAttribute('data-theme') === 'claro' ? 'claro' : 'escuro';
    setTema(atual);
    setCor(document.documentElement.getAttribute('data-cor') || '');
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', atual === 'claro' ? '#F6F9FD' : '#0A1220');
  }, []);
  const aplicarTema = (novo) => {
    if (novo !== 'claro' && novo !== 'escuro') return;
    setTema(novo);
    document.documentElement.setAttribute('data-theme', novo);
    try { localStorage.setItem('picoos-tema', novo); } catch { /* ignora */ }
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', novo === 'claro' ? '#F6F9FD' : '#0A1220');
  };
  const trocarTema = () => aplicarTema(tema === 'claro' ? 'escuro' : 'claro');
  const aplicarCor = (nova) => {
    setCor(nova || '');
    if (nova) document.documentElement.setAttribute('data-cor', nova);
    else document.documentElement.removeAttribute('data-cor');
    try { localStorage.setItem('picoos-cor', nova || ''); } catch { /* ignora */ }
  };

  // APP NOVO DE VERDADE: nenhum lançamento e nenhum nome configurado. Só
  // nesse caso a tela de boas-vindas aparece — no app dela, que tem anos de
  // movimento, nunca.
  const temDarci = darciDisponivel(modulos, recursos);

  const appNovo = !(negocio && negocio.nome)
    && !diario.length && !receitas.length && !despesas.length && !compras.length && !cardapio.length;

  const tabs = [
    ['darci', 'Darci'], ['brain', 'Brain'], ['hoje', 'Dashboard'], ['diario', 'Log Operacional'], ['financas', 'Finanças'],
    ['abastecimento', 'Abastecimento'], ['previsao', 'Previsão'], ['garrafas', 'Controle'],
    ['salao', 'Central de Operações'], ['despesarapida', 'Despesa Rápida'],
    ['ponto', 'Ponto'], ['pasta', 'Pasta'], ['marketing', 'Marketing'], ['notificacoes', 'Notificações'], ['widget', 'Widget'], ['acessos', 'Acessos'], ['backup', 'Backup'], ['negocio', 'Meu negócio'], ['guia', 'Como usar'], ['reservas', 'Reservas'],
  ];

  // Barra lateral: as áreas agrupadas por assunto (no PC fica fixa na lateral;
  // no celular abre com o botão de menu ☰).
  const [menuAberto, setMenuAberto] = useState(false);
  // No PC, dá pra recolher a lateral (ganha espaço) e mostrar de novo. Lembra a
  // preferência no aparelho.
  const [lateralRecolhida, setLateralRecolhida] = useState(false);
  useEffect(() => { try { if (localStorage.getItem('picoos-lateral') === 'recolhida') setLateralRecolhida(true); } catch { /* ignora */ } }, []);
  const recolherLateral = (v) => setLateralRecolhida((cur) => { const nv = v == null ? !cur : v; try { localStorage.setItem('picoos-lateral', nv ? 'recolhida' : 'aberta'); } catch { /* ignora */ } return nv; });
  const grupos = [
    { titulo: 'Início', itens: [['hoje', 'Dashboard'], ...(temDarci ? [['darci', 'Darci']] : []), ['brain', 'Brain']] },
    { titulo: 'Operação', itens: [['salao', 'Central de Operações'], ['reservas', 'Reservas'], ['garrafas', 'Controle'], ['ponto', 'Ponto']] },
    { titulo: 'Estoque', itens: [['abastecimento', 'Abastecimento'], ['previsao', 'Previsão']] },
    { titulo: 'Financeiro', itens: [['despesarapida', 'Despesa Rápida'], ['financas', 'Finanças'], ['diario', 'Log Operacional']] },
    // Backup, Acessos, Notificações e Widget saíram daqui pra dentro da
    // engrenagem: são telas de AJUSTAR o sistema, mexidas uma vez e nunca
    // mais, e estavam alongando o menu do trabalho do dia a dia.
    { titulo: 'Gestão', itens: [['pasta', 'Pasta'], ['marketing', 'Marketing']] },
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
  // A fala entendeu produto, quantidade e preco — mas fornecedor e forma de
  // pagamento ela nao tem como adivinhar, e sem os dois nao existe conta a
  // pagar. Entao a voz leva o carrinho pronto ate as Compras, e o resto ela
  // termina na tela que ja sabe lancar despesa, cotacao e estoque de uma vez.
  const levarPraCompras = (itens) => {
    if (!Array.isArray(itens) || !itens.length) return;
    setCarrinhoDaVoz(itens);
    setSubAbast('compras');
    setTab('abastecimento');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    <div style={{ minHeight: '100vh', background: C.ink, color: C.text, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', fontFamily: 'system-ui' }}>
      <div style={{ fontSize: 40 }}>📡</div>
      <div style={{ fontSize: 17, fontWeight: 800 }}>Não consegui carregar seus dados agora.</div>
      {/* "Pode ser a internet" era chute, e chute errado gasta o tempo dela no
          lugar errado: ela vai olhar o wi-fi quando o problema está no servidor.
          Cada motivo tem uma frase própria — e a saída de cada um é diferente. */}
      <div style={{ fontSize: 14, color: C.muted, maxWidth: 330, lineHeight: 1.55 }}>
        {erroLoad.motivo === 'servidor'
          ? <>A internet está funcionando: <b style={{ color: C.text }}>quem não respondeu direito foi o servidor</b>. Não é nada do teu aparelho, e não adianta trocar de rede.</>
          : erroLoad.motivo === 'sessao'
            ? <>Teu acesso venceu. <b style={{ color: C.text }}>Não é a internet</b> — é só entrar com a senha de novo.</>
            : <>O pedido não chegou a sair daqui. Dessa vez <b style={{ color: C.text }}>é a internet mesmo</b>.</>}
      </div>
      <div style={{ fontSize: 13.5, color: C.muted, maxWidth: 330, lineHeight: 1.55 }}>
        Teus dados estão salvos e seguros — só não consegui buscá-los.
      </div>
      <button onClick={() => { try { window.location.reload(); } catch { /* ignora */ } }} style={{ background: C.accent, color: '#06101F', border: 'none', borderRadius: 12, padding: '13px 22px', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>Tentar de novo</button>
      {/* O que o servidor respondeu, por escrito. É a única coisa que me diz
          onde olhar — e sem ela eu fico adivinhando enquanto ela fica parada. */}
      {(erroLoad.status > 0 || erroLoad.detalhe) && (
        <div style={{ fontSize: 12, color: C.faint, maxWidth: 330, lineHeight: 1.5, marginTop: 4 }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>Manda isto pra mim:</div>
          <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', wordBreak: 'break-word' }}>
            {erroLoad.motivo}{erroLoad.status > 0 ? ` ${erroLoad.status}` : ''}{erroLoad.detalhe ? ` — ${erroLoad.detalhe}` : ''}
          </div>
        </div>
      )}
    </div>
  );

  if (!loaded) return (
    <div style={{ minHeight: '100vh', background: C.ink, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>Carregando seus dados…</div>
  );

  // O Darci fica no cabeçalho do Dashboard, ao lado do botão Ocultar.
  // O Darci anota por ordem falada: ele entende, a dona confirma na tela e só
  // então grava. Cada tipo vai pro lugar certo do PicoOS.
  const anotarPeloDarci = async (pedido) => {
    try {
      const d = (pedido && pedido.dados) || {};
      if (pedido.tipo === 'despesa') {
        const nova = { id: uid(), data: todayISO(), categoria: d.categoria || 'A classificar', descricao: d.descricao || '', valor: num(d.valor), obs: 'Anotado pelo Darci' };
        upd.despesas([nova, ...despesas]);
        return { ok: true, msg: `Lancei ${brl(num(d.valor))} — ${d.descricao}. Está em Finanças, Despesas.` };
      }
      if (pedido.tipo === 'tarefa') {
        upd.tarefas([{ id: uid(), texto: d.texto || '', data: '', feito: false, criadoEm: Date.now() }, ...tarefas]);
        return { ok: true, msg: `Anotei: ${d.texto}. Está no Brain.` };
      }
      if (pedido.tipo === 'receita') {
        const nova = { id: uid(), data: todayISO(), categoria: 'Outras entradas', descricao: d.descricao || '', valor: num(d.valor), obs: 'Anotado pelo Darci' };
        upd.receitas([nova, ...receitas]);
        return { ok: true, msg: `Lancei a entrada de ${brl(num(d.valor))} — ${d.descricao}. Está em Finanças.` };
      }
      if (pedido.tipo === 'compra') {
        // Conta a pagar: entra em aberto, do jeito que a tela de Compras grava.
        const nova = {
          id: uid(), data: todayISO(), produto: d.produto || d.fornecedor || 'Conta',
          fornecedor: d.fornecedor || '', categoria: '', quantidade: '1',
          valorUnit: String(num(d.valor)), vencimento: d.vencimento || '',
          formaPagto: 'A prazo', pago: 'Não', nota: '', obs: 'Anotado pelo Darci',
        };
        upd.compras([nova, ...compras]);
        const quando = d.vencimento ? `, vence ${d.vencimento.slice(8, 10)}/${d.vencimento.slice(5, 7)}` : '';
        return { ok: true, msg: `Lancei a conta de ${brl(num(d.valor))} — ${nova.produto}${quando}. Está em Contas a pagar.` };
      }
      if (pedido.tipo === 'agenda') {
        // A agenda é do PicoOS (o Google é bônus lá dentro). Antes isto escrevia
        // direto no Google: sem Google conectado, o compromisso ia pro TO DO e
        // nunca aparecia no calendário.
        try {
          const r = await fetch('/api/agenda', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titulo: d.titulo, data: d.data, hora: d.hora, diaTodo: !d.hora }),
          });
          const j = await r.json();
          if (j && j.ok) {
            const quando = `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}${d.hora ? ` às ${d.hora}` : ''}`;
            return { ok: true, msg: `Marquei na agenda: ${d.titulo}, ${quando}. Está no Brain, no calendário.` };
          }
        } catch { /* cai no plano B */ }
        upd.tarefas([{ id: uid(), texto: d.titulo, data: d.data, feito: false, criadoEm: Date.now() }, ...tarefas]);
        return { ok: true, msg: `Não consegui salvar na agenda agora, então anotei no TO DO com a data: ${d.titulo}, dia ${d.data.slice(8, 10)}/${d.data.slice(5, 7)}.` };
      }
      if (pedido.tipo === 'perda') {
        const j = await estoqueAcao({ acao: 'mov', id: d.itemId, tipo: 'saida', qtd: d.qtd, motivo: d.motivo });
        if (!j || !j.ok) return { ok: false, erro: (j && j.erro) || 'Não consegui baixar do estoque.' };
        return { ok: true, msg: `Baixei ${d.qtd} ${d.unidade} de ${d.nome} como ${String(d.motivo).toLowerCase()}.` };
      }
      return { ok: false, erro: 'Não entendi o que era pra fazer.' };
    } catch { return { ok: false, erro: 'Sem conexão pra gravar agora.' }; }
  };

  const propsDarci = {
    receitas, despesas, compras, vendas, estoque, tarefas, clientes, cardapio, fichas,
    onAnotar: anotarPeloDarci,
    onAbrir: () => { carregarVendas(); carregarEstoque({}); },
  };

  return (
    <div style={{ minHeight: '100vh', background: pageBg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <PullToRefresh />
      <AtualizacaoAuto />
      <LembreteAgenda />
      {salvarFalhou && (
        <div style={{ position: 'fixed', zIndex: 200, left: 0, right: 0, top: 0, background: C.red, color: '#fff', padding: 'calc(8px + env(safe-area-inset-top)) 14px 8px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', textAlign: 'center', lineHeight: 1.35 }}>
          <span>⚠️ Não consegui salvar sua última alteração (internet). Refaça quando a conexão voltar.</span>
          <button onClick={() => setSalvarFalhou(false)} style={{ background: 'rgba(255,255,255,.25)', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>OK</button>
        </div>
      )}
      <EstiloShell />

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
            <button onClick={() => setConfigAberta(true)} title="Configurações" aria-label="Configurações"
              style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3.2" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <button onClick={sair} style={{ flex: 1, background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Sair</button>
          </div>
          <VersaoApp />
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
            {tab !== 'despesarapida' && (
              <button onClick={() => setTab('despesarapida')} aria-label="Despesa rápida" title="Despesa rápida"
                style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.accent, borderRadius: 10, padding: '7px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            )}
            <BotaoAtualizar />
          </div>

      <div style={{ maxWidth: tab === 'brain' ? 1180 : 760, margin: '0 auto', padding: '18px calc(16px + env(safe-area-inset-right)) calc(60px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))' }}>
        {/* App novo: a tela de boas-vindas vem antes de tudo, em qualquer aba,
            até ela dizer de quem é o app. */}
        {appNovo && <PrimeiroUso onSalvar={upd.negocio} onIr={irParaTab} />}
        {/* SENHA DE FÁBRICA AINDA VALENDO.
            Fica em todas as telas, não só no Dashboard: é a única coisa que
            separa "o acesso é da equipe" de "o acesso é de quem souber o
            link". Some sozinho no instante em que a senha é trocada. */}
        {senhasDeFabrica.length > 0 && !escondeuAvisoSenha && tab !== 'acessos' && (
          <div style={{ background: C.panel, border: `2px solid ${C.amber}`, borderRadius: 10, padding: '11px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: C.amber, lineHeight: 1.45 }}>
                {senhasDeFabrica.length === 1
                  ? `O acesso de ${senhasDeFabrica[0]} ainda entra com a senha de fábrica (1234).`
                  : `${senhasDeFabrica.length} acessos ainda entram com a senha de fábrica (1234): ${senhasDeFabrica.join(', ')}.`}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.45 }}>
                Quem souber o link do app entra com ela. Trocar leva dez segundos.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Btn small onClick={() => irParaTab('acessos')}>Trocar agora</Btn>
              <Btn small kind="ghost" onClick={() => setEscondeuAvisoSenha(true)}>Depois</Btn>
            </div>
          </div>
        )}
        {tab === 'darci' && temDarci && <Darci {...propsDarci} />}
        {tab === 'brain' && <Brain tarefas={tarefas} onTarefas={upd.tarefas} ideias={ideias} onIdeias={upd.ideias} />}
        {/* A mesma pasta de textos que a Mari alimenta — modelo de cobrança,
            ficha técnica de prato e de drink. As duas leem e escrevem. */}
        {tab === 'pasta' && <Pasta />}
        {tab === 'hoje' && <Hoje resumo={<ResumoDoDia {...propsDarci} onPerguntar={temDarci ? () => setTab('darci') : null} />} diario={diario} receitas={receitas} despesas={despesas} compras={compras} garrafas={garrafas} tarefas={tarefas} estoque={estoque} vendas={vendas} setTab={irParaTab} darci={temDarci ? <DarciFlutuante {...propsDarci} /> : null} metas={metas} onMetas={upd.metas} dona={(negocio && (negocio.dona || (negocio.papeis && negocio.papeis.dona))) || ''} />}
        {tab === 'diario' && <Diario dados={diario} onChange={upd.diario} receitas={receitas} onReceitas={upd.receitas} visitantes={visitantes} onVisitantes={upd.visitantes} onRepor={reporLista} pessoasPorDia={pessoasPorDia} pedidosPorDia={pedidosPorDia} fiadosPorDia={fiadosPorDia} vendas={vendas} />}
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
            {subFinancas === 'raiox' && <RaioX receitas={receitas} despesas={despesas} cardapio={cardapio} fichas={fichas} estoque={estoque} vendas={vendas} compras={compras} />}
            {subFinancas === 'relatorios' && <Relatorios diario={diario} receitas={receitas} despesas={despesas} mes={mes} setMes={setMes} vendas={vendas} compras={compras} estoque={estoque} fichas={fichas} cardapio={cardapio} negocio={(negocio && negocio.nome) || ''} />}
          </>
        )}
        {tab === 'abastecimento' && (
          <>
            <div style={{ display: 'flex', overflowX: 'auto', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 2, gap: 2, marginBottom: 14 }}>
              {[['estoque', 'Estoque'], ['margem', 'Margem'], ['lista', 'Lista de Compras'], ['compras', 'Compras'], ['fornecedores', 'Fornecedores'], ['cotacoes', 'Cotações']].map(([v, rot]) => (
                <button key={v} onClick={() => setSubAbast(v)} style={{
                  flexShrink: 0, border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700,
                  background: subAbast === v ? C.accent : 'transparent', color: subAbast === v ? '#06101F' : C.muted, whiteSpace: 'nowrap',
                }}>{rot}</button>
              ))}
            </div>

            {avisoBaixa && (
              <div style={{ background: C.panel2, border: `1px solid ${C.accent}`, color: C.text, borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 12, lineHeight: 1.45, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ flex: 1, minWidth: 0 }}>{avisoBaixa}</span>
                <button onClick={() => setAvisoBaixa('')} aria-label="Fechar aviso" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
              </div>
            )}
            {/* Nota que entrou no financeiro e nao chegou na prateleira. Fica
                visivel em qualquer aba do setor, e nao some sozinha: e a
                unica coisa que separa "comprei" de "tenho". */}
            {comprasSemSaldo.length > 0 && subAbast !== 'compras' && (
              <button
                onClick={() => setSubAbast('compras')}
                style={{ width: '100%', textAlign: 'left', background: C.panel, border: `1px solid ${C.amber}`, borderRadius: 10, padding: '10px 13px', marginBottom: 12, cursor: 'pointer', color: C.text }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: C.amber, lineHeight: 1.45 }}>
                  {comprasSemSaldo.length} compra{comprasSemSaldo.length > 1 ? 's' : ''} {comprasSemSaldo.length > 1 ? 'não somaram' : 'não somou'} saldo no estoque
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.45 }}>
                  Já está no financeiro, mas a mercadoria não entrou na prateleira. Toca pra resolver em Compras.
                </div>
              </button>
            )}

            {subAbast === 'estoque' && (
              <>
                {/* Estas abas somam mais largura do que cabe num celular. Com
                    flex:1 e texto sem quebra, o mínimo delas empurrava a PÁGINA
                    inteira pro lado. Aqui elas rolam dentro da própria barra,
                    igual à barra de cima. */}
                <div style={{ display: 'flex', overflowX: 'auto', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 2, gap: 2, marginBottom: 14 }}>
                  {[['itens', 'Estoque'], ['fichas', 'Fichas técnicas'], ['conferencia', 'Conferência'], ['cortesia', 'Cortesia / Consumo']].map(([v, rot]) => (
                    <button key={v} onClick={() => setSubEstoque(v)} style={{
                      flex: '1 0 auto', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                      background: subEstoque === v ? C.accent : 'transparent', color: subEstoque === v ? '#06101F' : C.muted,
                    }}>{rot}</button>
                  ))}
                </div>
                {subEstoque === 'itens' && <Estoque itens={estoque} carregado={estCarregado} onAcao={estoqueAcao} compras={compras} cotacoes={cotacoes} fichas={fichas} cardapio={cardapio} duplicadosIgnorados={dupIgnorados} onRepor={reporLista} onLevarPraCompras={levarPraCompras} />}
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

            {subAbast === 'compras' && <Compras dados={compras} cotacoes={cotacoes} despesas={despesas} estoque={estoque} onChange={upd.compras} onRegistrar={aplicarCompra} onPagamento={aplicarPagamento} onEstoque={estoqueAcao} carrinhoInicial={carrinhoDaVoz} onCarrinhoUsado={() => setCarrinhoDaVoz(null)} />}
            {subAbast === 'margem' && <Margem cardapio={cardapio} fichas={fichas} estoque={estoque} vendas={vendas} compras={compras} />}
            {subAbast === 'fornecedores' && <Fornecedores compras={compras} />}
            {subAbast === 'cotacoes' && <Cotacoes dados={cotacoes} onChange={upd.cotacoes} estoque={estoque} compras={compras} />}
          </>
        )}
        {tab === 'negocio' && <MeuNegocio negocio={negocio} onChange={upd.negocio} />}
        {/* AS RESERVAS, DENTRO DO LOGIN DA DONA.
            "Às vezes a pessoa não tem quem faça isso e acaba tendo que entrar e
            sair de login pra fazer." É o MESMO painel da tela da Mari, não uma
            cópia — conserto num lugar vale nos dois. */}
        {tab === 'reservas' && <Reservas embutido />}
        {tab === 'guia' && (
          <Guia
            onIr={irParaTab} nome={(negocio && negocio.nome) || ''}
            receitas={receitas} estoque={estoque} compras={compras} fichas={fichas}
            temMeta={metaDoMes(metas, ymOf(todayISO())) > 0}
            senhasDeFabrica={senhasDeFabrica}
          />
        )}
        {tab === 'garrafas' && <Garrafas dados={garrafas} onChange={upd.garrafas} onRepor={reporLista} />}
        {tab === 'salao' && (
          <>
            <div style={{ display: 'flex', overflowX: 'auto', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 2, gap: 2, marginBottom: 14 }}>
              {[['caixa', 'Caixa'], ['comandas', 'Comandas'], ['vendas', 'Vendas do dia'], ['fiados', 'Fiados'], ['clientes', 'Clientes'], ['cardapio', 'Cardápio']].map(([v, rot]) => (
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
            {subSalao === 'vendas' && <VendasDoDia vendas={vendas} />}
            {subSalao === 'caixa' && <Caixa receitas={receitas} onReceitas={upd.receitas} />}
            {subSalao === 'cardapio' && <Cardapio dados={cardapio} onChange={upd.cardapio} estoque={estoque} />}
            {subSalao === 'fiados' && <Fiados onMudou={carregarVendas} clientes={clientes} receitas={receitas} onReceitas={upd.receitas} />}
            {subSalao === 'clientes' && <Clientes dados={clientes} onChange={upd.clientes} vendas={vendas} />}
          </>
        )}
        {tab === 'ponto' && <PontoDona />}

        {tab === 'marketing' && <Marketing dados={marketing} onChange={upd.marketing} receitas={receitas} />}
        {tab === 'notificacoes' && <Notificacoes />}
        {tab === 'widget' && <Widget />}
        {tab === 'previsao' && <Previsao vendas={vendas} cardapio={cardapio} fichas={fichas} estoque={estoque} />}
        {tab === 'despesarapida' && <DespesaRapida dados={despesas} onChange={upd.despesas} textoInicial={despesaInicial} />}
        {tab === 'acessos' && <Acessos />}
        {tab === 'backup' && (<><Auditoria receitas={receitas} despesas={despesas} compras={compras} vendas={vendas} onMudou={carregarVendas} /><Backup negocio={(negocio && negocio.nome) || ''} all={{ diario, receitas, despesas, compras, cotacoes, garrafas, tarefas, ideias, marketing, visitantes, listaCompras, listasModelo, cardapio, clientes, estoque, fichas, vendas }} restore={(d) => {
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

      {/* A engrenagem abre por cima de tudo: funciona igual no iPad (lateral
          fixa) e no celular (menu que desliza). */}
      <Config
        aberto={configAberta} onFechar={() => setConfigAberta(false)}
        tema={tema} onTema={aplicarTema}
        cor={cor} onCor={aplicarCor}
        modulos={modulos} onModulos={upd.modulos} recursos={recursos}
        onIr={(id) => { irParaTab(id); setMenuAberto(false); }}
      />
    </div>
  );
}
