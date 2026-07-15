'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, LogoMark, pageBg } from './ui';
import { ymOf, todayISO } from '../lib/util';
import SEED_DATA from '../data/seed.json';

import Hoje from './Hoje';
import Diario from './Diario';
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
      setDiario(dados.diario); setReceitas(dados.receitas); setDespesas(dados.despesas);
      setCompras(dados.compras); setCotacoes(dados.cotacoes); setGarrafas(dados.garrafas);
      setTarefas((salvo && Array.isArray(salvo.tarefas)) ? salvo.tarefas : []);
      if (vazio) await apiSalvar(dados);
      setLoaded(true);
    })();
  }, []);

  const salvarTudo = (parcial) => {
    const dados = {
      diario: parcial.diario ?? diario, receitas: parcial.receitas ?? receitas,
      despesas: parcial.despesas ?? despesas, compras: parcial.compras ?? compras,
      cotacoes: parcial.cotacoes ?? cotacoes, garrafas: parcial.garrafas ?? garrafas,
      tarefas: parcial.tarefas ?? tarefas,
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
  };

  // Aplica mudanças em compras E despesas numa tacada só (usado ao marcar/
  // desfazer pagamento de contas), pra um save não sobrescrever o outro.
  const aplicarComprasDespesas = (novasCompras, novasDespesas) => {
    setCompras(novasCompras);
    setDespesas(novasDespesas);
    salvarTudo({ compras: novasCompras, despesas: novasDespesas });
  };

  const sair = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  const tabs = [
    ['hoje', 'Hoje'], ['diario', 'Diário'], ['receitas', 'Receitas'], ['despesas', 'Despesas'],
    ['compras', 'Compras'], ['pagar', 'A Pagar'], ['garrafas', 'Garrafas'], ['cotacoes', 'Cotações'],
    ['relatorios', 'Relatórios'], ['backup', 'Backup'],
  ];

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
          }}>{nome}</button>
        ))}
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '18px calc(16px + env(safe-area-inset-right)) calc(60px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))' }}>
        {tab === 'hoje' && <Hoje diario={diario} receitas={receitas} despesas={despesas} compras={compras} garrafas={garrafas} setTab={setTab} />}
        {tab === 'diario' && <Diario dados={diario} onChange={upd.diario} tarefas={tarefas} onTarefas={upd.tarefas} receitas={receitas} />}
        {tab === 'receitas' && <Lancamentos tipo="receita" dados={receitas} onChange={upd.receitas} />}
        {tab === 'despesas' && <Lancamentos tipo="despesa" dados={despesas} onChange={upd.despesas} />}
        {tab === 'compras' && <Compras dados={compras} cotacoes={cotacoes} onChange={upd.compras} />}
        {tab === 'pagar' && <ContasPagar dados={compras} onChange={upd.compras} despesas={despesas} onPagamento={aplicarComprasDespesas} />}
        {tab === 'garrafas' && <Garrafas dados={garrafas} onChange={upd.garrafas} />}
        {tab === 'cotacoes' && <Cotacoes dados={cotacoes} onChange={upd.cotacoes} />}
        {tab === 'relatorios' && <Relatorios diario={diario} receitas={receitas} despesas={despesas} mes={mes} setMes={setMes} />}
        {tab === 'backup' && <Backup all={{ diario, receitas, despesas, compras, cotacoes, garrafas, tarefas }} restore={(d) => {
          const dados = {
            diario: d.diario || diario, receitas: d.receitas || receitas, despesas: d.despesas || despesas,
            compras: d.compras || compras, cotacoes: d.cotacoes || cotacoes, garrafas: d.garrafas || garrafas,
            tarefas: d.tarefas || tarefas,
          };
          setDiario(dados.diario); setReceitas(dados.receitas); setDespesas(dados.despesas);
          setCompras(dados.compras); setCotacoes(dados.cotacoes); setGarrafas(dados.garrafas);
          setTarefas(dados.tarefas);
          apiSalvar(dados);
        }} />}
      </div>
    </div>
  );
}
