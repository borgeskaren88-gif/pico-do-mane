'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { C, LogoMark, pageBg } from './ui';
import { ymOf, todayISO, limparNome, fiadoDaVenda } from '../lib/util';
import SEED_DATA from '../data/seed.json';

import Hoje from './Hoje';
import Diario from './Diario';
import Marketing from './Marketing';
import ListaCompras from './ListaCompras';
import AgendaCalendario from './AgendaCalendario';
import Lancamentos from './Lancamentos';
import Compras from './Compras';
import ContasPagar from './ContasPagar';
import Garrafas from './Garrafas';
import Cotacoes from './Cotacoes';
import Relatorios from './Relatorios';
import Backup from './Backup';
import Cardapio from './Cardapio';
import Comandas from './Comandas';
import Caixa from './Caixa';
import Fiados from './Fiados';
import BotaoAtualizar from './BotaoAtualizar';
import PullToRefresh from './PullToRefresh';

async function apiCarregar() {
  const res = await fetch('/api/data', { cache: 'no-store' });
  if (!res.ok) return null;
  const json = await res.json();
  return json.ok ? json.dados : null;
}

async function apiSalvar(dados) {
  try {
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });
  } catch (e) {
    console.error('Erro ao salvar:', e);
  }
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
  const [diario, setDiario] = useState([]);
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
  const [vendas, setVendas] = useState([]); // vendas do salão (comandas fechadas)
  const [qualLista, setQualLista] = useState('minha'); // 'minha' | 'cozinha'
  const [subSalao, setSubSalao] = useState('comandas'); // 'comandas' | 'cardapio' | 'fiados'
  const [googleOn, setGoogleOn] = useState(false);
  const [mes, setMes] = useState(ymOf(todayISO()));

  useEffect(() => {
    (async () => {
      const salvo = await apiCarregar();
      const vazio = !salvo || typeof salvo !== 'object';
      const dados = vazio ? SEED_DATA : {
        diario: (salvo.diario && salvo.diario.length) ? salvo.diario : SEED_DATA.diario,
        receitas: (salvo.receitas && salvo.receitas.length) ? salvo.receitas : SEED_DATA.receitas,
        despesas: (salvo.despesas && salvo.despesas.length) ? salvo.despesas : SEED_DATA.despesas,
        compras: (salvo.compras && salvo.compras.length) ? salvo.compras : SEED_DATA.compras,
        cotacoes: (salvo.cotacoes && salvo.cotacoes.length) ? salvo.cotacoes : SEED_DATA.cotacoes,
        garrafas: (salvo.garrafas && salvo.garrafas.length) ? salvo.garrafas : SEED_DATA.garrafas,
      };
      // Limpa nomes de produto/fornecedor (espaços sobrando) uma vez, ao abrir.
      // Assim "Copal " vira "Copal" nos dados já salvos e para de duplicar.
      const { dados: limpos, mudou } = normalizarNomes(dados);
      setDiario(limpos.diario); setReceitas(limpos.receitas); setDespesas(limpos.despesas);
      setCompras(limpos.compras); setCotacoes(limpos.cotacoes); setGarrafas(limpos.garrafas);
      setTarefas((salvo && Array.isArray(salvo.tarefas)) ? salvo.tarefas : []);
      setMarketing((salvo && Array.isArray(salvo.marketing)) ? salvo.marketing : []);
      setVisitantes((salvo && Array.isArray(salvo.visitantes)) ? salvo.visitantes : []);
      setListaCompras((salvo && Array.isArray(salvo.listaCompras)) ? salvo.listaCompras : []);
      setListaCozinha((salvo && Array.isArray(salvo.listaCozinha)) ? salvo.listaCozinha : []);
      setListasModelo((salvo && Array.isArray(salvo.listasModelo)) ? salvo.listasModelo : []);
      setTarefasCozinha((salvo && Array.isArray(salvo.tarefasCozinha)) ? salvo.tarefasCozinha : []);
      setCardapio((salvo && Array.isArray(salvo.cardapio)) ? salvo.cardapio : []);
      // IMPORTANTE: preserva TODOS os campos ao re-salvar (a limpeza de nomes só
      // mexe em compras/cotações). Antes isso salvava só parte e apagava a lista
      // da cozinha, a Lista de Compras, marketing, etc. Espalhar `salvo` primeiro
      // garante que nada some.
      if (vazio || mudou) {
        const base = (salvo && typeof salvo === 'object') ? salvo : {};
        await apiSalvar({ ...base, ...limpos, tarefas: (salvo && Array.isArray(salvo.tarefas)) ? salvo.tarefas : [] });
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
  useEffect(() => { if (['hoje', 'relatorios', 'marketing', 'receitas', 'salao', 'caixa', 'diario'].includes(tab)) carregarVendas(); }, [tab]);
  useEffect(() => { if (tab === 'salao' && subSalao === 'fiados') carregarVendas(); }, [subSalao]);

  // Receita total = o que a dona lançou + as vendas do salão RECEBIDAS (só
  // leitura). A parte recebida na hora entra no dia da venda; a parte no fiado
  // só entra quando a dona marca "Recebi" (na data do recebimento).
  const receitasComVendas = useMemo(() => {
    const doSalao = [];
    for (const v of vendas) {
      const total = Number(v.total) || 0;
      const fiado = fiadoDaVenda(v);
      const recebidoNaHora = total - fiado; // dinheiro/pix/cartão pagos no fechamento
      if (recebidoNaHora > 0.005) {
        doSalao.push({ id: v.id + '-r', data: v.data, valor: recebidoNaHora.toFixed(2).replace('.', ','), categoria: 'Venda do salão', origem: 'comanda', descricao: `Mesa ${v.mesa}`, obs: `Comanda · ${v.pagamento || ''}` });
      }
      if (fiado > 0.005 && v.pago) {
        doSalao.push({ id: v.id + '-f', data: v.pagoEm || v.data, valor: fiado.toFixed(2).replace('.', ','), categoria: 'Venda do salão', origem: 'comanda', descricao: `Mesa ${v.mesa}`, obs: 'Fiado recebido' });
      }
    }
    return [...receitas, ...doSalao];
  }, [receitas, vendas]);
  const fiadosAbertos = vendas.filter((v) => fiadoDaVenda(v) > 0.005 && !v.pago).length;
  // Pessoas atendidas por dia (somado do nº de pessoas de cada mesa fechada).
  const pessoasPorDia = useMemo(() => {
    const m = {};
    for (const v of vendas) { if (!v.data) continue; m[v.data] = (m[v.data] || 0) + (Number(v.pessoas) || 0); }
    return m;
  }, [vendas]);

  const salvarTudo = (parcial) => {
    const dados = {
      diario: parcial.diario ?? diario, receitas: parcial.receitas ?? receitas,
      despesas: parcial.despesas ?? despesas, compras: parcial.compras ?? compras,
      cotacoes: parcial.cotacoes ?? cotacoes, garrafas: parcial.garrafas ?? garrafas,
      tarefas: parcial.tarefas ?? tarefas, marketing: parcial.marketing ?? marketing,
      visitantes: parcial.visitantes ?? visitantes,
      listaCompras: parcial.listaCompras ?? listaCompras,
      listasModelo: parcial.listasModelo ?? listasModelo,
      cardapio: parcial.cardapio ?? cardapio,
    };
    // A lista e as tarefas da cozinha são compartilhadas com o acesso da cozinha
    // (que grava por /api/lista). Só as incluímos aqui quando a dona realmente as
    // editou; senão o servidor preserva o que a cozinha salvou (evita apagar por
    // cima com uma cópia velha na memória).
    if ('listaCozinha' in parcial) dados.listaCozinha = parcial.listaCozinha;
    if ('tarefasCozinha' in parcial) dados.tarefasCozinha = parcial.tarefasCozinha;
    apiSalvar(dados);
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
    marketing: (v) => { setMarketing(v); salvarTudo({ marketing: v }); },
    visitantes: (v) => { setVisitantes(v); salvarTudo({ visitantes: v }); },
    listaCompras: (v) => { setListaCompras(v); salvarTudo({ listaCompras: v }); },
    tarefasCozinha: (v) => { setTarefasCozinha(v); salvarTudo({ tarefasCozinha: v }); },
    cardapio: (v) => { setCardapio(v); salvarTudo({ cardapio: v }); },
  };

  // Aplica mudanças em compras E despesas numa tacada só (usado ao marcar/
  // desfazer pagamento de contas), pra um save não sobrescrever o outro.
  const aplicarComprasDespesas = (novasCompras, novasDespesas) => {
    setCompras(novasCompras);
    setDespesas(novasDespesas);
    salvarTudo({ compras: novasCompras, despesas: novasDespesas });
    syncGoogle();
  };

  // Registro de compra que alimenta compras + cotações + despesas de uma vez
  // (uma compra vira cotação de preço e, se paga, vira despesa), sem um save
  // sobrescrever o outro. Só aplica as listas que vierem no objeto.
  const aplicarCompra = ({ compras: nc, cotacoes: ncot, despesas: nd }) => {
    const parcial = {};
    if (nc) { setCompras(nc); parcial.compras = nc; }
    if (ncot) { setCotacoes(ncot); parcial.cotacoes = ncot; }
    if (nd) { setDespesas(nd); parcial.despesas = nd; }
    salvarTudo(parcial);
    if (nc) syncGoogle();
  };

  // Lista de compras: um único save aplica listaCompras/modelos e, quando um
  // item é "lançado", também compras/despesas/cotações — sem corrida de estado.
  const aplicarLista = (parcial) => {
    // A Lista de Compras usa sempre a chave "listaCompras"; se a lista aberta é
    // a da cozinha, redireciona pra "listaCozinha" sem mudar o componente.
    const p = { ...parcial };
    if (qualLista === 'cozinha' && 'listaCompras' in p) { p.listaCozinha = p.listaCompras; delete p.listaCompras; }
    if (p.listaCompras) setListaCompras(p.listaCompras);
    if (p.listaCozinha) setListaCozinha(p.listaCozinha);
    if (p.listasModelo) setListasModelo(p.listasModelo);
    if (p.compras) setCompras(p.compras);
    if (p.despesas) setDespesas(p.despesas);
    if (p.cotacoes) setCotacoes(p.cotacoes);
    salvarTudo(p);
    if (p.compras) syncGoogle();
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
    ['hoje', 'Hoje'], ['diario', 'Log Operacional'], ['receitas', 'Receitas'], ['despesas', 'Despesas'],
    ['compras', 'Compras'], ['pagar', 'Contas a Pagar'], ['lista', 'Lista de Compras'], ['garrafas', 'Controle'], ['cotacoes', 'Cotações'],
    ['salao', 'Salão'], ['caixa', 'Caixa'],
    ['marketing', 'Marketing'], ['relatorios', 'Relatórios'], ['backup', 'Backup'],
  ];

  // Selo do Diário: tarefas com data até hoje ainda não feitas.
  const hojeIso = todayISO();
  const tarefasAlerta = tarefas.filter((t) => !t.feito && t.data && t.data <= hojeIso).length;
  const badges = { diario: tarefasAlerta, salao: fiadosAbertos };

  // Navegação por gesto: deslizar o dedo para o lado troca de aba.
  const toqueRef = useRef(null);
  const tabBarRef = useRef(null);
  const irParaAba = (delta) => {
    const idx = tabs.findIndex(([id]) => id === tab);
    const novo = idx + delta;
    if (idx < 0 || novo < 0 || novo >= tabs.length) return;
    setTab(tabs[novo][0]);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };
  const onTouchStart = (e) => {
    const t = e.changedTouches[0];
    toqueRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e) => {
    const ini = toqueRef.current; toqueRef.current = null;
    if (!ini) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - ini.x, dy = t.clientY - ini.y;
    if (Date.now() - ini.t > 700) return;          // gesto muito lento
    if (Math.abs(dx) < 60) return;                 // deslize curto demais
    if (Math.abs(dx) < Math.abs(dy) * 1.5) return; // muito vertical (é rolagem)
    irParaAba(dx < 0 ? 1 : -1);                     // esquerda = próxima; direita = anterior
  };
  // Mantém a aba ativa visível na barra ao trocar (inclusive por gesto).
  useEffect(() => {
    const bar = tabBarRef.current;
    if (!bar) return;
    const el = bar.querySelector(`[data-tab="${tab}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [tab]);

  if (!loaded) return (
    <div style={{ minHeight: '100vh', background: C.ink, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>Carregando seus dados…</div>
  );

  return (
    <div style={{ minHeight: '100vh', background: pageBg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <PullToRefresh />
      <div style={{ padding: 'calc(18px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) 12px calc(16px + env(safe-area-inset-left))', borderBottom: `1px solid ${C.hair}`, background: 'transparent' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LogoMark size={42} radius={12} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: '.02em', lineHeight: 1 }}>PicoOS</div>
              <div style={{ fontSize: 12, color: C.accent, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: 3, fontWeight: 600 }}>Central de Gestão</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <BotaoAtualizar />
            <button onClick={trocarTema} title={tema === 'claro' ? 'Mudar para escuro' : 'Mudar para claro'} aria-label="Trocar tema"
              style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '7px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {tema === 'claro' ? (
                // Lua (está claro -> toca pra escurecer)
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                </svg>
              ) : (
                // Sol (está escuro -> toca pra clarear)
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4.2" />
                  <path d="M12 2.5v2.2M12 19.3v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.4 19.6l1.6-1.6M18 6l1.6-1.6" />
                </svg>
              )}
            </button>
            <button onClick={sair} style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Sair</button>
          </div>
        </div>
      </div>

      <div ref={tabBarRef} style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: 'calc(12px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) 12px calc(16px + env(safe-area-inset-left))', position: 'sticky', top: 0, background: C.barBg, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 10, borderBottom: `1px solid ${C.hair}` }}>
        {tabs.map(([id, nome]) => (
          <button key={id} data-tab={id} onClick={() => setTab(id)} style={{
            flexShrink: 0, padding: '8px 15px', borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${tab === id ? C.accent : C.line}`,
            background: tab === id ? C.accent : 'transparent',
            color: tab === id ? '#06101F' : C.muted,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {nome}
            {badges[id] > 0 && (
              <span style={{
                background: C.red, color: '#fff', fontSize: 11, fontWeight: 800, lineHeight: 1,
                minWidth: 18, height: 18, borderRadius: 999, padding: '0 5px',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{badges[id]}</span>
            )}
          </button>
        ))}
      </div>

      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ maxWidth: 760, margin: '0 auto', padding: '18px calc(16px + env(safe-area-inset-right)) calc(60px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))' }}>
        {tab === 'hoje' && <Hoje diario={diario} receitas={receitasComVendas} despesas={despesas} compras={compras} garrafas={garrafas} tarefas={tarefas} setTab={setTab} />}
        {tab === 'diario' && <Diario dados={diario} onChange={upd.diario} tarefas={tarefas} onTarefas={upd.tarefas} receitas={receitas} onReceitas={upd.receitas} visitantes={visitantes} onVisitantes={upd.visitantes} onRepor={reporLista} pessoasPorDia={pessoasPorDia} />}
        {tab === 'receitas' && <Lancamentos tipo="receita" dados={receitas} onChange={upd.receitas} />}
        {tab === 'despesas' && <Lancamentos tipo="despesa" dados={despesas} onChange={upd.despesas} />}
        {tab === 'compras' && <Compras dados={compras} cotacoes={cotacoes} despesas={despesas} onChange={upd.compras} onRegistrar={aplicarCompra} />}
        {tab === 'pagar' && <ContasPagar dados={compras} onChange={upd.compras} despesas={despesas} onPagamento={aplicarComprasDespesas} />}
        {tab === 'lista' && (
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
              modelos={listasModelo} cotacoes={cotacoes} compras={compras} despesas={despesas} onAplicar={aplicarLista}
              tarefasCozinha={tarefasCozinha} onTarefasCozinha={upd.tarefasCozinha}
              subtitulo={qualLista === 'cozinha' ? 'O que a cozinha pediu pra repor' : 'O que falta repor no bar'}
              mostrarTarefasCozinha={qualLista === 'cozinha'} />
          </>
        )}
        {tab === 'garrafas' && <Garrafas dados={garrafas} onChange={upd.garrafas} onRepor={reporLista} />}
        {tab === 'cotacoes' && <Cotacoes dados={cotacoes} onChange={upd.cotacoes} />}
        {tab === 'salao' && (
          <>
            <div style={{ display: 'inline-flex', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 2, gap: 2, marginBottom: 14 }}>
              {[['comandas', 'Comandas'], ['cardapio', 'Cardápio'], ['fiados', 'Fiados']].map(([v, rot]) => (
                <button key={v} onClick={() => setSubSalao(v)} style={{
                  border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700,
                  background: subSalao === v ? C.accent : 'transparent', color: subSalao === v ? '#06101F' : C.muted,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {rot}
                  {v === 'fiados' && fiadosAbertos > 0 && <span style={{ background: subSalao === v ? '#06101F' : C.red, color: subSalao === v ? C.accent : '#fff', fontSize: 11, fontWeight: 800, lineHeight: 1, borderRadius: 999, padding: '2px 6px' }}>{fiadosAbertos}</span>}
                </button>
              ))}
            </div>
            {subSalao === 'comandas' && <Comandas papel="dona" />}
            {subSalao === 'cardapio' && <Cardapio dados={cardapio} onChange={upd.cardapio} />}
            {subSalao === 'fiados' && <Fiados onMudou={carregarVendas} />}
          </>
        )}
        {tab === 'caixa' && <Caixa />}
        {tab === 'marketing' && <Marketing dados={marketing} onChange={upd.marketing} receitas={receitasComVendas} />}
        {tab === 'relatorios' && <Relatorios diario={diario} receitas={receitasComVendas} despesas={despesas} mes={mes} setMes={setMes} />}
        {tab === 'backup' && (<><Backup all={{ diario, receitas, despesas, compras, cotacoes, garrafas, tarefas, marketing, visitantes, listaCompras, listasModelo, cardapio }} restore={(d) => {
          const dados = {
            diario: d.diario || diario, receitas: d.receitas || receitas, despesas: d.despesas || despesas,
            compras: d.compras || compras, cotacoes: d.cotacoes || cotacoes, garrafas: d.garrafas || garrafas,
            tarefas: d.tarefas || tarefas, marketing: d.marketing || marketing, visitantes: d.visitantes || visitantes,
            listaCompras: d.listaCompras || listaCompras, listasModelo: d.listasModelo || listasModelo,
            cardapio: d.cardapio || cardapio,
          };
          setDiario(dados.diario); setReceitas(dados.receitas); setDespesas(dados.despesas);
          setCompras(dados.compras); setCotacoes(dados.cotacoes); setGarrafas(dados.garrafas);
          setTarefas(dados.tarefas); setMarketing(dados.marketing); setVisitantes(dados.visitantes);
          setListaCompras(dados.listaCompras); setListasModelo(dados.listasModelo); setCardapio(dados.cardapio);
          apiSalvar(dados);
        }} /><AgendaCalendario /></>)}
      </div>
    </div>
  );
}
