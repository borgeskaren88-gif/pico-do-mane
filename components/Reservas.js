'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { C, Card, Btn, Empty, pageBg, LogoMark } from './ui';
import AvisoReservas from './AvisoReservas';
import SinoNotificacoes from './SinoNotificacoes';
import ListaMercado from './ListaMercado';
import Pasta from './Pasta';
import TrocarSenha from './TrocarSenha';
import LembreteAgenda from './LembreteAgenda';
import EstiloShell from './EstiloShell';
import BotaoAtualizar from './BotaoAtualizar';
import VersaoApp from './VersaoApp';
import { todayISO, addDays, fmtDate, weekday, ymOf } from '../lib/util';

const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const LETRAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const SEM_CURTO = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const diaDaSemana = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
const semanaDe = (iso) => { const ini = addDays(iso, -diaDaSemana(iso)); return Array.from({ length: 7 }, (_, i) => addDays(ini, i)); };
const vazio = (dia) => ({ id: '', nome: '', data: dia, hora: '20:00', pessoas: '2', obs: '', telefone: '' });

// Link do WhatsApp com a mensagem pronta — mesma ideia da cobrança do fiado.
// Telefone brasileiro sem o 55 ganha o 55 na frente; sem telefone não dá link
// (aí a gente copia o texto pra ela colar onde quiser).
const zapLink = (telefone, msg) => {
  const d = String(telefone || '').replace(/\D/g, '');
  const numero = d.length >= 12 ? d : (d.length >= 10 ? '55' + d : '');
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(msg)}` : '';
};
const primeiroNome = (n) => (String(n || '').trim().split(/\s+/)[0] || 'tudo bem');
const msgConfirmacao = (r, hoje) => {
  const q = Number(r.pessoas) || 1;
  const quando = r.data === addDays(hoje, 1) ? 'amanhã' : r.data === hoje ? 'hoje' : `no dia ${r.data.slice(8, 10)}/${r.data.slice(5, 7)}`;
  return `Olá ${primeiroNome(r.nome)}! Aqui é do Pico do Mané.\n\n`
    + `Passando para confirmar a tua reserva ${quando}${r.hora ? `, às ${r.hora}` : ''}, para ${q} ${q === 1 ? 'pessoa' : 'pessoas'}.\n\n`
    + 'Está tudo certo?\n'
    + 'Lembrando que nossa política de reserva permite atraso de até 15 min. '
    + 'Então não hesite em nos contatar caso haja alguma intercorrência.\n\n'
    + 'Seguimos à disposição e se precisar é só me avisar por aqui.\n\n'
    + 'Até logo!';
};

// A tela da Mari. Duas coisas, e só essas duas:
//
//  1. RESERVAS — o calendário pra marcar quem reservou mesa, pra que dia, que
//     horas, quantas pessoas e o que mais precisar.
//  2. LISTA DE COMPRAS — a lista que a cozinha anota, pra quando ela for ao
//     mercado resolver: risca o item quando põe no carrinho.
//  3. PASTA — os textos do bar: modelo de cobrança, ficha técnica de prato e de
//     drink. Guardado num lugar só, pronto pra copiar.
//
// Nada de dinheiro, nada de comanda. Ao salvar uma reserva nova, todo mundo
// (dona, cozinha e atendimento) recebe o aviso no celular — e o dia da reserva
// aparece no login de cada um.
export default function Reservas() {
  const hoje = todayISO();
  const [reservas, setReservas] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [diaSel, setDiaSel] = useState(hoje);
  const [mesAberto, setMesAberto] = useState(false);
  const [form, setForm] = useState(null); // null = formulário fechado
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [recado, setRecado] = useState('');
  const [aba, setAba] = useState('reservas'); // 'reservas' | 'compras' | 'pasta'
  const [menuAberto, setMenuAberto] = useState(false);
  const [lateralRecolhida, setLateralRecolhida] = useState(false);
  const recolherLateral = (v) => setLateralRecolhida((cur) => {
    const nv = v == null ? !cur : v;
    try { localStorage.setItem('picoos-lateral', nv ? 'recolhida' : 'aberta'); } catch { /* ignora */ }
    return nv;
  });
  useEffect(() => { try { setLateralRecolhida(localStorage.getItem('picoos-lateral') === 'recolhida'); } catch { /* ignora */ } }, []);

  // Tema claro/escuro (mesmo comportamento do resto do app).
  const [tema, setTema] = useState('escuro');
  useEffect(() => { setTema(document.documentElement.getAttribute('data-theme') === 'claro' ? 'claro' : 'escuro'); }, []);
  const trocarTema = () => {
    const novo = tema === 'claro' ? 'escuro' : 'claro';
    setTema(novo);
    document.documentElement.setAttribute('data-theme', novo);
    try { localStorage.setItem('picoos-tema', novo); } catch { /* ignora */ }
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', novo === 'claro' ? '#F6F9FD' : '#0A1220');
  };
  const MENU = [['reservas', 'Reservas'], ['compras', 'Lista de Compras'], ['pasta', 'Pasta']];
  const irPara = (v) => { setAba(v); setMenuAberto(false); };

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/reservas', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) { setReservas(Array.isArray(j.reservas) ? j.reservas : []); setErro(''); }
      else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Sem conexão.'); }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const porDia = useMemo(() => {
    const m = new Map();
    for (const r of reservas) {
      if (!r || !r.data) continue;
      if (!m.has(r.data)) m.set(r.data, []);
      m.get(r.data).push(r);
    }
    for (const lista of m.values()) lista.sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));
    return m;
  }, [reservas]);
  const diasComReserva = useMemo(() => new Set(porDia.keys()), [porDia]);

  const mes = ymOf(diaSel);
  const semana = useMemo(() => semanaDe(diaSel), [diaSel]);
  const cabMes = (() => { const [y, m] = diaSel.split('-'); return `${MESES_LONGOS[Number(m) - 1]}, ${y}`; })();
  const celulasMes = useMemo(() => {
    const [ano, mn] = mes.split('-').map(Number);
    const offset = new Date(ano, mn - 1, 1).getDay();
    const total = new Date(ano, mn, 0).getDate();
    const cs = [];
    for (let i = 0; i < offset; i++) cs.push(null);
    for (let d = 1; d <= total; d++) cs.push(`${mes}-${String(d).padStart(2, '0')}`);
    return cs;
  }, [mes]);

  const doDia = porDia.get(diaSel) || [];
  const pessoasNoDia = doDia.reduce((s, r) => s + (Number(r.pessoas) || 1), 0);

  const salvar = async () => {
    if (!form) return;
    setBusy(true); setErro(''); setRecado('');
    try {
      const r = await fetch('/api/reservas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'salvar', ...form, pessoas: Number(form.pessoas) || 1 }),
      });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Não consegui salvar.'); return; }
      setRecado(j.nova ? 'Reserva anotada! Todo mundo já foi avisado.' : 'Reserva atualizada.');
      setDiaSel(form.data);
      setForm(null);
      await carregar();
    } catch { setErro('Sem conexão. Tenta de novo.'); }
    finally { setBusy(false); }
  };

  const excluir = async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Apagar esta reserva?')) return;
    setBusy(true); setErro(''); setRecado('');
    try {
      const r = await fetch('/api/reservas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'excluir', id }),
      });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Não consegui apagar.'); return; }
      await carregar();
    } catch { setErro('Sem conexão.'); }
    finally { setBusy(false); }
  };

  // "Já confirmei com o cliente" — some do lembrete da véspera.
  const confirmar = async (r, confirmada) => {
    setBusy(true); setErro('');
    try {
      const resp = await fetch('/api/reservas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'confirmar', id: r.id, confirmada }),
      });
      const j = await resp.json();
      if (!j.ok) { setErro(j.erro || 'Não consegui marcar.'); return; }
      await carregar();
    } catch { setErro('Sem conexão.'); }
    finally { setBusy(false); }
  };

  // Abre a conversa da pessoa no WhatsApp com o texto pronto. Sem telefone
  // cadastrado, copia a mensagem pra ela colar onde quiser.
  const chamarNoZap = async (r) => {
    const msg = msgConfirmacao(r, hoje);
    const link = zapLink(r.telefone, msg);
    if (link) { try { window.open(link, '_blank', 'noopener'); } catch { /* ignora */ } return; }
    try {
      await navigator.clipboard.writeText(msg);
      setRecado(`${r.nome} está sem telefone aqui. Copiei a mensagem pra tu colar no WhatsApp.`);
    } catch { setErro('Sem telefone cadastrado nessa reserva.'); }
  };

  const sair = async () => {
    try { await fetch('/api/logout', { method: 'POST' }); } catch { /* ignora */ }
    if (typeof window !== 'undefined') window.location.reload();
  };

  const inp = { background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 10, padding: '11px 12px', fontSize: 15, width: '100%', boxSizing: 'border-box' };
  const tituloDoDia = diaSel === hoje ? 'Hoje' : diaSel === addDays(hoje, 1) ? 'Amanhã' : `${weekday(diaSel)}, ${fmtDate(diaSel)}`;

  const iconeTema = tema === 'claro'
    ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
    : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.4 19.6l1.6-1.6M18 6l1.6-1.6" /></svg>;

  return (
    <div style={{ minHeight: '100dvh', background: pageBg, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <EstiloShell />

      {/* Mesma casca do painel da Karen: lateral no computador, gaveta no
          celular. Só o que tem dentro do menu é que muda. */}
      <div className={`pos-shell${lateralRecolhida ? ' pos-recolhida' : ''}`}>
        {menuAberto && <div className="pos-overlay" onClick={() => setMenuAberto(false)} />}
        <aside className={`pos-sidebar${menuAberto ? ' pos-open' : ''}`}>
          <div className="pos-side-head">
            <LogoMark size={34} radius={10} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>Mari</div>
              <div style={{ fontSize: 9.5, color: C.accent, letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 3, fontWeight: 800, lineHeight: 1.3 }}>
                Coordenadora de Operações
              </div>
            </div>
            <button className="pos-recolher" onClick={() => recolherLateral(true)} title="Recolher a lateral" aria-label="Recolher a lateral" style={{ marginLeft: 'auto' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
          </div>
          <nav className="pos-nav">
            <div className="pos-group">
              <div className="pos-group-title">Operação</div>
              {MENU.map(([v, rot]) => (
                <button key={v} onClick={() => irPara(v)} className={`pos-navitem${aba === v ? ' pos-active' : ''}`}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rot}</span>
                </button>
              ))}
            </div>
          </nav>
          <div className="pos-side-foot">
            <BotaoAtualizar />
            <button onClick={trocarTema} title={tema === 'claro' ? 'Mudar para escuro' : 'Mudar para claro'} aria-label="Trocar tema"
              style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {iconeTema}
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
              <div style={{ fontSize: 16, fontWeight: 900, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {MENU.find(([v]) => v === aba)?.[1] || 'Mari'}
              </div>
            </div>
            <BotaoAtualizar />
          </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '18px calc(16px + env(safe-area-inset-right)) calc(60px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))' }}>

        {aba === 'compras' ? <ListaMercado /> : aba === 'pasta' ? <Pasta /> : (
        <>
        <LembreteAgenda />
        <AvisoReservas />

        {recado && (
          <div style={{ background: C.panel2, border: `1px solid ${C.green}`, borderRadius: 12, padding: '10px 13px', fontSize: 13, color: C.text, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ flex: 1 }}>{recado}</span>
            <button onClick={() => setRecado('')} aria-label="Fechar" style={{ background: 'none', border: 'none', color: C.faint, fontSize: 18, lineHeight: 1, cursor: 'pointer' }}>×</button>
          </div>
        )}
        {erro && <div style={{ fontSize: 13, color: C.red, marginBottom: 10 }}>{erro}</div>}

        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
          {/* Cabeçalho colorido com a semana — igual ao calendário do PicoOS */}
          <div style={{ background: `linear-gradient(135deg, ${C.accent} 0%, ${C.roxo} 100%)`, padding: '16px 14px 26px', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <button onClick={() => setDiaSel(addDays(diaSel, -7))} aria-label="Semana anterior" style={setaTopo}>‹</button>
              <div style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cabMes}</div>
              <button onClick={() => setDiaSel(addDays(diaSel, 7))} aria-label="Próxima semana" style={setaTopo}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
              {semana.map((d) => {
                const sel = d === diaSel, ehHoje = d === hoje, tem = diasComReserva.has(d);
                return (
                  <button key={d} onClick={() => setDiaSel(d)} style={{
                    border: 'none', cursor: 'pointer', borderRadius: 13, padding: '8px 0 7px',
                    background: sel ? '#fff' : 'rgba(255,255,255,0.16)', color: sel ? C.accent : '#fff',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    boxShadow: !sel && ehHoje ? 'inset 0 0 0 1.5px rgba(255,255,255,0.85)' : 'none',
                  }}>
                    <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.06em', opacity: 0.85 }}>{SEM_CURTO[diaDaSemana(d)]}</span>
                    <span style={{ fontSize: 15, fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{Number(d.slice(8))}</span>
                    <span style={{ width: 4, height: 4, borderRadius: 999, background: tem ? (sel ? C.accent : '#fff') : 'transparent' }} />
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
              <button onClick={() => setDiaSel(hoje)} style={pilulaTopo(diaSel === hoje)}>hoje</button>
              <button onClick={() => setMesAberto((v) => !v)} style={pilulaTopo(mesAberto)}>{mesAberto ? 'fechar o mês' : 'ver o mês inteiro'}</button>
            </div>
          </div>

          <div style={{ background: C.panel, borderRadius: '20px 20px 0 0', marginTop: -16, position: 'relative', padding: 14 }}>
            {mesAberto && (
              <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.line}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                  {LETRAS_SEMANA.map((w, i) => (
                    <div key={'h' + i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, color: C.faint, paddingBottom: 4 }}>{w}</div>
                  ))}
                  {celulasMes.map((d, i) => {
                    if (!d) return <div key={'c' + i} />;
                    const sel = d === diaSel, ehHoje = d === hoje, passado = d < hoje, tem = diasComReserva.has(d);
                    return (
                      <button key={'c' + i} onClick={() => setDiaSel(d)} style={{
                        border: 'none', cursor: 'pointer', position: 'relative', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 11,
                        background: sel ? C.accent : 'transparent', color: sel ? '#fff' : (passado ? C.faint : C.text),
                        boxShadow: !sel && ehHoje ? `inset 0 0 0 1.5px ${C.accent}` : 'none',
                        fontSize: 13, fontWeight: sel || ehHoje ? 800 : 600, fontVariantNumeric: 'tabular-nums',
                      }}>
                        {Number(d.slice(8))}
                        {tem && !sel && <span style={{ position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: '50%', background: C.accent }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.text }}>{tituloDoDia}</div>
              <div style={{ fontSize: 12, color: C.faint, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {doDia.length ? `${doDia.length} reserva(s) · ${pessoasNoDia} pessoas` : 'nenhuma reserva'}
              </div>
            </div>

            {!carregado ? <Empty>Carregando…</Empty> : doDia.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 10px', border: `1px dashed ${C.line}`, borderRadius: 14, color: C.faint, fontSize: 13, lineHeight: 1.5 }}>
                Nenhuma mesa reservada nesse dia.
              </div>
            ) : doDia.map((r) => (
              <div key={r.id} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', borderTop: `1px solid ${C.hair}`, padding: '11px 0 10px' }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: C.accent, fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 50 }}>{r.hora || '—'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{r.nome}</div>
                  <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>
                    {Number(r.pessoas) || 1} {(Number(r.pessoas) || 1) === 1 ? 'pessoa' : 'pessoas'}
                    {r.telefone ? ` · ${r.telefone}` : ''}
                  </div>
                  {r.obs ? <div style={{ fontSize: 12.5, color: C.faint, marginTop: 4, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{r.obs}</div> : null}
                  {r.confirmada && (
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: C.green, marginTop: 5 }}>✓ confirmada com o cliente</div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => chamarNoZap(r)} style={{ ...acaoBtn, color: C.accent, borderColor: C.accent }}>confirmar no WhatsApp</button>
                    <button onClick={() => confirmar(r, !r.confirmada)} disabled={busy} style={{ ...acaoBtn, color: r.confirmada ? C.faint : C.green, borderColor: r.confirmada ? C.line : C.green }}>
                      {r.confirmada ? 'desmarcar' : 'já confirmei'}
                    </button>
                    <button onClick={() => setForm({ ...vazio(r.data), ...r, pessoas: String(r.pessoas || 1) })} style={acaoBtn}>editar</button>
                    <button onClick={() => excluir(r.id)} disabled={busy} style={{ ...acaoBtn, color: C.red }}>apagar</button>
                  </div>
                </div>
              </div>
            ))}

            {!form ? (
              <button onClick={() => { setForm(vazio(diaSel)); setRecado(''); }} style={{
                marginTop: 14, width: '100%', background: 'transparent', border: `1px dashed ${C.line}`,
                color: C.accent, borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 800, cursor: 'pointer',
              }}>+ Anotar reserva</button>
            ) : (
              <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 12 }}>{form.id ? 'Editar reserva' : 'Nova reserva'}</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <label style={{ display: 'block' }}>
                    <span style={rot}>Quem reservou</span>
                    <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Ana Paula" style={inp} autoFocus />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={{ display: 'block' }}>
                      <span style={rot}>Dia</span>
                      <input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} style={inp} />
                    </label>
                    <label style={{ display: 'block' }}>
                      <span style={rot}>Hora</span>
                      <input type="time" value={form.hora} onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))} style={inp} />
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={{ display: 'block' }}>
                      <span style={rot}>Quantas pessoas</span>
                      <input type="text" inputMode="numeric" value={form.pessoas} onChange={(e) => setForm((f) => ({ ...f, pessoas: e.target.value.replace(/\D/g, '') }))} placeholder="2" style={inp} />
                    </label>
                    <label style={{ display: 'block' }}>
                      <span style={rot}>Telefone (opcional)</span>
                      <input type="tel" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} placeholder="(48) 9…" style={inp} />
                    </label>
                  </div>
                  <label style={{ display: 'block' }}>
                    <span style={rot}>Observação (opcional)</span>
                    <textarea value={form.obs} onChange={(e) => setForm((f) => ({ ...f, obs: e.target.value }))} rows={3}
                      placeholder="Ex.: aniversário, querem mesa na varanda, uma pessoa é vegetariana" style={{ ...inp, resize: 'vertical', lineHeight: 1.45, fontSize: 14 }} />
                  </label>
                </div>
                <div style={{ fontSize: 11.5, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
                  Ao salvar, a Karen, a cozinha e o atendimento recebem o aviso no celular — e no dia da reserva ela aparece na tela de todo mundo.
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <Btn onClick={salvar} disabled={busy}>{busy ? 'Salvando…' : 'Salvar reserva'}</Btn>
                  <Btn kind="ghost" onClick={() => { setForm(null); setErro(''); }}>Cancelar</Btn>
                </div>
              </div>
            )}
          </div>
        </Card>

        </>
        )}

        {/* Ela também recebe os avisos: se a Karen ou o atendimento marcarem
            uma mesa, o celular dela toca igual. */}
        <div style={{ marginBottom: 12 }}>
          <SinoNotificacoes titulo="Avisos no celular" descricao="Receba um aviso quando alguém marcar uma mesa." />
        </div>

        {/* Trocar a própria senha: ela mesma escolhe, sem depender de ninguém. */}
        <TrocarSenha quem="deste acesso (a Mari)" />

        <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.55, marginTop: 18 }}>
          {aba === 'compras'
            ? 'A lista é a mesma que a cozinha anota. O que tu riscar aqui some da lista deles na hora.'
            : aba === 'pasta'
              ? 'Cada texto fica numa pasta que tu mesma cria. O botão “copiar” manda o texto inteiro pra área de transferência.'
              : 'Toca num dia pra ver e anotar as reservas dele. Os dias com bolinha já têm mesa guardada.'}
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}

const rot = { display: 'block', fontSize: 12, color: C.muted, fontWeight: 700, marginBottom: 5 };
const acaoBtn = {
  background: 'none', border: `1px solid ${C.line}`, color: C.muted, cursor: 'pointer',
  fontSize: 11.5, fontWeight: 700, padding: '5px 11px', borderRadius: 8,
};
const setaTopo = {
  width: 30, height: 30, borderRadius: 10, flexShrink: 0, cursor: 'pointer',
  background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', fontSize: 17, fontWeight: 900, lineHeight: 1,
};
const pilulaTopo = (ativo) => ({
  border: 'none', cursor: 'pointer', borderRadius: 999, padding: '5px 13px', fontSize: 11.5, fontWeight: 800,
  background: ativo ? '#fff' : 'rgba(255,255,255,0.18)', color: ativo ? C.accent : '#fff',
});
