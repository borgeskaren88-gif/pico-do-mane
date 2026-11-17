'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, LogoMark, pageBg, PageTitle } from './ui';
import EstiloShell from './EstiloShell';
import BotaoAtualizar from './BotaoAtualizar';
import PullToRefresh from './PullToRefresh';
import Comandas from './Comandas';
import Caixa from './Caixa';
import PerdaGarcom from './PerdaGarcom';
import ReservasLista from './ReservasLista';
import PontoCozinha from './PontoCozinha';
import Notificacoes from './Notificacoes';
import PorcoesCozinha from './PorcoesCozinha';
import EstoqueCozinha from './EstoqueCozinha';
import FichasArquivo from './FichasArquivo';
import PedidoPronto from './PedidoPronto';
import LembretePonto from './LembretePonto';
import LembreteAgenda from './LembreteAgenda';
import Cozinha from './Cozinha';
import {
  useGerencia, InicioGerente, FiadosGerente, DosesGerente, EquipeGerente, ExtraGerente,
} from './Gerencia';
import { sairDeVez } from '../lib/pushClient';

// A TELA DA GERENTE — com a mesma cara do painel da dona.
//
// "Poderíamos deixar o menu lateral igual ao meu, as telas organizadas tipo a
// minha. Assim está muito confuso, preciso que seja prático pra ela."
//
// Então é o mesmo esqueleto (EstiloShell): no computador o menu fica fixo do
// lado; no celular abre pelo botão de três risquinhos. Os grupos têm os
// mesmos nomes do menu da dona — Início, Operação, Cozinha, Gestão — e cada
// item é UMA tela, com o nome em cima. Se a dona disser "vai em Operação →
// Controle", a Sarah acha no mesmo lugar.
//
// As telas são as mesmas da equipe (comandas, caixa, porções, fichas...): o
// que mudar pra equipe muda aqui junto, e ela aprende exatamente o que o
// pessoal usa.
const GRUPOS = [
  { titulo: 'Início', itens: [['inicio', 'Início']] },
  { titulo: 'Operação', itens: [['salao', 'Central de Operações'], ['reservas', 'Reservas'], ['controle', 'Controle'], ['ponto', 'Ponto']] },
  { titulo: 'Cozinha', itens: [['compras', 'Lista de compras'], ['porcoes', 'Porções'], ['estoque', 'Estoque'], ['fichas', 'Fichas']] },
  { titulo: 'Gestão', itens: [['equipe', 'Equipe hoje'], ['extra', 'Acesso do Extra'], ['avisos', 'Avisos']] },
];
const TELAS = GRUPOS.flatMap((g) => g.itens.map(([id]) => id));
// Dentro da Central de Operações, as mesmas abinhas de cima que a dona tem.
const SUB_SALAO = [['caixa', 'Caixa'], ['comandas', 'Comandas'], ['fiados', 'Fiados'], ['perdas', 'Perdas e consumo']];
const LEMBRAR = 'picoos-tela-gerente';

export default function Gerente() {
  const router = useRouter();
  const g = useGerencia();
  const [tela, setTela] = useState('inicio');
  const [sub, setSub] = useState('comandas');
  const [menuAberto, setMenuAberto] = useState(false);
  const [tema, setTema] = useState('escuro');

  // Atualizar a página volta pra mesma tela, como no painel da dona.
  useEffect(() => {
    try { const t = localStorage.getItem(LEMBRAR); if (t && TELAS.includes(t)) setTela(t); } catch { /* ignora */ }
    setTema(document.documentElement.getAttribute('data-theme') === 'claro' ? 'claro' : 'escuro');
  }, []);
  useEffect(() => { try { localStorage.setItem(LEMBRAR, tela); } catch { /* ignora */ } }, [tela]);

  const ir = (id, s) => {
    if (!TELAS.includes(id)) return;
    if (id === 'salao' && s) setSub(s);
    setTela(id);
    setMenuAberto(false);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };
  const sair = async () => { await sairDeVez(); router.refresh(); };
  const trocarTema = () => {
    const novo = tema === 'claro' ? 'escuro' : 'claro';
    setTema(novo);
    document.documentElement.setAttribute('data-theme', novo);
    try { localStorage.setItem('picoos-tema', novo); } catch { /* ignora */ }
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', novo === 'claro' ? '#F6F9FD' : '#0A1220');
  };

  // O número vermelho no menu: tarefa de hoje ou atrasada ainda não feita.
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const pendentes = ((g.dados && g.dados.tarefas) || []).filter((t) => t.data && t.data <= hoje && !t.feito).length;
  const badges = { inicio: pendentes };

  const tituloSalao = (
    <div style={{ display: 'flex', overflowX: 'auto', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 2, gap: 2, marginBottom: 14 }}>
      {SUB_SALAO.map(([v, rot]) => (
        <button key={v} data-sub={v} onClick={() => setSub(v)} style={{
          flexShrink: 0, border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700,
          background: sub === v ? C.accent : 'transparent', color: sub === v ? '#06101F' : C.muted, whiteSpace: 'nowrap',
        }}>{rot}</button>
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: pageBg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <PullToRefresh />
      <LembreteAgenda />
      <EstiloShell />
      <div className="pos-shell" data-gerente>
        {menuAberto && <div className="pos-overlay" onClick={() => setMenuAberto(false)} />}
        <aside className={`pos-sidebar${menuAberto ? ' pos-open' : ''}`}>
          <div className="pos-side-head">
            <LogoMark size={34} radius={10} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>PicoOS</div>
              <div style={{ fontSize: 10, color: C.accent, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 2, fontWeight: 600 }}>Gerência</div>
            </div>
          </div>
          <nav className="pos-nav">
            {GRUPOS.map((gr) => (
              <div key={gr.titulo} className="pos-group">
                <div className="pos-group-title">{gr.titulo}</div>
                {gr.itens.map(([id, nome]) => (
                  <button key={id} data-nav={id} onClick={() => ir(id)} className={`pos-navitem${tela === id ? ' pos-active' : ''}`}>
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
            <button onClick={sair} style={{ flex: 1, background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Sair</button>
          </div>
        </aside>

        <div className="pos-content">
          <div className="pos-topbar">
            <button className="pos-burger" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 }}>
              <LogoMark size={28} radius={9} />
              <div style={{ fontSize: 16, fontWeight: 900 }}>PicoOS</div>
              {pendentes > 0 && tela !== 'inicio' && (
                <button onClick={() => ir('inicio')} className="pos-badge" style={{ border: 'none', cursor: 'pointer' }} aria-label="Tarefas pendentes">{pendentes}</button>
              )}
            </div>
            <BotaoAtualizar />
          </div>

          <div style={{ maxWidth: 760, margin: '0 auto', padding: '18px calc(16px + env(safe-area-inset-right)) calc(60px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))' }}>
            {/* Em qualquer tela: avisar que o prato saiu, e lembrar do ponto. */}
            <PedidoPronto />
            {tela !== 'ponto' && <LembretePonto onIr={() => ir('ponto')} />}

            {tela === 'inicio' && <InicioGerente g={g} onIr={ir} />}

            {tela === 'salao' && (<>
              <PageTitle sub="Mesas, balcão e caixa — a mesma tela do atendimento">Central de Operações</PageTitle>
              {tituloSalao}
              {sub === 'caixa' && <Caixa papel="garcom" />}
              {sub === 'comandas' && <Comandas papel="garcom" />}
              {sub === 'fiados' && <FiadosGerente g={g} />}
              {sub === 'perdas' && <PerdaGarcom />}
            </>)}
            {tela === 'reservas' && <ReservasLista sub="O que já está marcado, pra guardar a mesa." />}
            {tela === 'controle' && (<>
              <PageTitle sub="Acabou uma garrafa? Conta aqui">Controle</PageTitle>
              <DosesGerente g={g} />
            </>)}
            {tela === 'ponto' && <PontoCozinha />}

            {tela === 'compras' && <Cozinha embutido so="compras" />}
            {tela === 'porcoes' && <PorcoesCozinha />}
            {tela === 'estoque' && <EstoqueCozinha />}
            {tela === 'fichas' && <FichasArquivo sub="Abre a ficha do prato na hora de montar" />}

            {tela === 'equipe' && (<>
              <PageTitle sub="Quem bateu o ponto hoje">Equipe</PageTitle>
              <EquipeGerente g={g} />
            </>)}
            {tela === 'extra' && (<>
              <PageTitle sub="Pra quem vem trabalhar um dia só">Acesso do Extra</PageTitle>
              <ExtraGerente />
            </>)}
            {tela === 'avisos' && <Notificacoes papel="garcom" />}
          </div>
        </div>
      </div>
    </div>
  );
}
