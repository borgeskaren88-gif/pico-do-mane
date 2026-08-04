'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, LogoMark, pageBg } from './ui';
import { ymOf, todayISO, limparNome } from '../lib/util';
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
  const [listasModelo, setListasModelo] = useState([]);
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
      setListasModelo((salvo && Array.isArray(salvo.listasModelo)) ? salvo.listasModelo : []);
      if (vazio || mudou) await apiSalvar({ ...limpos, tarefas: (salvo && Array.isArray(salvo.tarefas)) ? salvo.tarefas : [] });
      setLoaded(true);
    })();
  }, []);

  const salvarTudo = (parcial) => {
    const dados = {
      diario: parcial.diario ?? diario, receitas: parcial.receitas ?? receitas,
      despesas: parcial.despesas ?? despesas, compras: parcial.compras ?? compras,
      cotacoes: parcial.cotacoes ?? cotacoes, garrafas: parcial.garrafas ?? garrafas,
      tarefas: parcial.tarefas ?? tarefas, marketing: parcial.marketing ?? marketing,
      visitantes: parcial.visitantes ?? visitantes,
      listaCompras: parcial.listaCompras ?? listaCompras, listasModelo: parcial.listasModelo ?? listasModelo,
    };
    apiSalvar(dados);
  };

  const upd = {
    diario: (v) => { setDiario(v); salvarTudo({ diario: v }); },
    receitas: (v) => { setReceitas(v); salvarTudo({ receitas: v }); },
    despesas: (v) => { setDespesas(v); salvarTudo({ despesas: v }); },
    compras: (v) => { setCompras(v); salvarTudo({ compras: v }); },
    cotacoes: (v) => { setCotacoes(v); salvarTudo({ cotacoes: v }); },
    garrafas: (v) => { setGarrafas(v); salvarTudo({ garrafas: v }); },
    tarefas: (v) => { setTarefas(v); salvarTudo({ tarefas: v }); },
    marketing: (v) => { setMarketing(v); salvarTudo({ marketing: v }); },
    visitantes: (v) => { setVisitantes(v); salvarTudo({ visitantes: v }); },
  };

  // Aplica mudanças em compras E despesas numa tacada só (usado ao marcar/
  // desfazer pagamento de contas), pra um save não sobrescrever o outro.
  const aplicarComprasDespesas = (novasCompras, novasDespesas) => {
    setCompras(novasCompras);
    setDespesas(novasDespesas);
    salvarTudo({ compras: novasCompras, despesas: novasDespesas });
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
  };

  // Lista de compras: um único save aplica listaCompras/modelos e, quando um
  // item é "lançado", também compras/despesas/cotações — sem corrida de estado.
  const aplicarLista = (parcial) => {
    if (parcial.listaCompras) setListaCompras(parcial.listaCompras);
    if (parcial.listasModelo) setListasModelo(parcial.listasModelo);
    if (parcial.compras) setCompras(parcial.compras);
    if (parcial.despesas) setDespesas(parcial.despesas);
    if (parcial.cotacoes) setCotacoes(parcial.cotacoes);
    salvarTudo(parcial);
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

  const tabs = [
    ['hoje', 'Hoje'], ['diario', 'Log Operacional'], ['receitas', 'Receitas'], ['despesas', 'Despesas'],
    ['compras', 'Compras'], ['pagar', 'Contas a Pagar'], ['lista', 'Lista de Compras'], ['garrafas', 'Controle'], ['cotacoes', 'Cotações'],
    ['marketing', 'Marketing'], ['relatorios', 'Relatórios'], ['backup', 'Backup'],
  ];

  // Selo do Diário: tarefas com data até hoje ainda não feitas.
  const hojeIso = todayISO();
  const tarefasAlerta = tarefas.filter((t) => !t.feito && t.data && t.data <= hojeIso).length;
  const badges = { diario: tarefasAlerta };

  if (!loaded) return (
    <div style={{ minHeight: '100vh', background: C.ink, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>Carregando seus dados…</div>
  );

  return (
    <div style={{ minHeight: '100vh', background: pageBg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ padding: 'calc(18px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) 12px calc(16px + env(safe-area-inset-left))', borderBottom: `1px solid ${C.line}55`, background: 'transparent' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LogoMark size={42} radius={12} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: '.02em', lineHeight: 1 }}>PicoOS</div>
              <div style={{ fontSize: 12, color: C.accent, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: 3, fontWeight: 600 }}>Central de Gestão</div>
            </div>
          </div>
          <button onClick={sair} style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Sair</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: 'calc(12px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) 12px calc(16px + env(safe-area-inset-left))', position: 'sticky', top: 0, background: 'rgba(8,13,24,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 10, borderBottom: `1px solid ${C.line}55` }}>
        {tabs.map(([id, nome]) => (
          <button key={id} onClick={() => setTab(id)} style={{
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

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '18px calc(16px + env(safe-area-inset-right)) calc(60px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))' }}>
        {tab === 'hoje' && <Hoje diario={diario} receitas={receitas} despesas={despesas} compras={compras} garrafas={garrafas} tarefas={tarefas} setTab={setTab} />}
        {tab === 'diario' && <Diario dados={diario} onChange={upd.diario} tarefas={tarefas} onTarefas={upd.tarefas} receitas={receitas} visitantes={visitantes} onVisitantes={upd.visitantes} onRepor={reporLista} />}
        {tab === 'receitas' && <Lancamentos tipo="receita" dados={receitas} onChange={upd.receitas} />}
        {tab === 'despesas' && <Lancamentos tipo="despesa" dados={despesas} onChange={upd.despesas} />}
        {tab === 'compras' && <Compras dados={compras} cotacoes={cotacoes} despesas={despesas} onChange={upd.compras} onRegistrar={aplicarCompra} />}
        {tab === 'pagar' && <ContasPagar dados={compras} onChange={upd.compras} despesas={despesas} onPagamento={aplicarComprasDespesas} />}
        {tab === 'lista' && <ListaCompras itens={listaCompras} modelos={listasModelo} cotacoes={cotacoes} compras={compras} despesas={despesas} onAplicar={aplicarLista} />}
        {tab === 'garrafas' && <Garrafas dados={garrafas} onChange={upd.garrafas} onRepor={reporLista} />}
        {tab === 'cotacoes' && <Cotacoes dados={cotacoes} onChange={upd.cotacoes} />}
        {tab === 'marketing' && <Marketing dados={marketing} onChange={upd.marketing} receitas={receitas} />}
        {tab === 'relatorios' && <Relatorios diario={diario} receitas={receitas} despesas={despesas} mes={mes} setMes={setMes} />}
        {tab === 'backup' && (<><Backup all={{ diario, receitas, despesas, compras, cotacoes, garrafas, tarefas, marketing, visitantes, listaCompras, listasModelo }} restore={(d) => {
          const dados = {
            diario: d.diario || diario, receitas: d.receitas || receitas, despesas: d.despesas || despesas,
            compras: d.compras || compras, cotacoes: d.cotacoes || cotacoes, garrafas: d.garrafas || garrafas,
            tarefas: d.tarefas || tarefas, marketing: d.marketing || marketing, visitantes: d.visitantes || visitantes,
            listaCompras: d.listaCompras || listaCompras, listasModelo: d.listasModelo || listasModelo,
          };
          setDiario(dados.diario); setReceitas(dados.receitas); setDespesas(dados.despesas);
          setCompras(dados.compras); setCotacoes(dados.cotacoes); setGarrafas(dados.garrafas);
          setTarefas(dados.tarefas); setMarketing(dados.marketing); setVisitantes(dados.visitantes);
          setListaCompras(dados.listaCompras); setListasModelo(dados.listasModelo);
          apiSalvar(dados);
        }} /><AgendaCalendario /></>)}
      </div>
    </div>
  );
}
