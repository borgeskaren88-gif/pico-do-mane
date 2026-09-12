'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { C, Card, Label, inputStyle, Empty, Icone } from './ui';
import { todayISO, fmtDate, MESES_LONGO, CORES_HABITO } from '../lib/util';
import { VAPID_PUBLIC, urlB64ToUint8Array } from '../lib/push';

const serif = "'Playfair Display', 'Iowan Old Style', Georgia, 'Times New Roman', serif";
// Papel dos post-its: creme com tinta café — cara de recadinho de verdade, e
// combina com a paleta linho/café do app tanto no tema claro quanto no escuro.
const PAPEL = '#EFE7D6', INK = '#3A2C20', INK_SOFT = '#6E5B49';
const TILTS = [-2.2, 1.6, -1.4, 2.2, -1.8, 1.2];
const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

// Data por extenso pra dar o ar de "diário": "quarta-feira, 9 de setembro de 2026".
function dataExtenso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dia = new Date(y, m - 1, d).getDay();
  return `${DIAS_SEMANA[dia]}, ${d} de ${MESES_LONGO[m - 1].toLowerCase()} de ${y}`;
}

const SECOES = [['notas', 'Notas', 'pencil'], ['lembretes', 'Lembretes', 'bell'], ['checklist', 'Checklist', 'check']];

export default function Caderno({ usuario }) {
  const [notas, setNotas] = useState([]);
  const [lembretes, setLembretes] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sec, setSec] = useState('notas');
  const [notif, setNotif] = useState('carregando'); // 'on' | 'off' | 'nao' (não dá) | 'ativando' | 'erro-instalar'
  const hoje = todayISO();
  const devidos = useMemo(() => lembretes.filter((l) => !l.feito && l.data && l.data <= hoje), [lembretes, hoje]);

  useEffect(() => {
    try {
      if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) { setNotif('nao'); return; }
      setNotif(Notification.permission === 'granted' ? 'on' : 'off');
    } catch { setNotif('nao'); }
  }, []);

  const ativarNotif = async () => {
    setNotif('ativando'); setErro('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setNotif('off'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC) });
      await acao({ acao: 'pushSub', sub: sub.toJSON() });
      setNotif('on');
    } catch (e) {
      // No iPhone o push só funciona com o app na Tela de Início.
      setNotif('erro-instalar');
    }
  };

  const aplicar = (j) => { if (j && j.ok) { setNotas(j.notas || []); setLembretes(j.lembretes || []); setChecklist(j.checklist || []); } };
  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try {
      const r = await fetch('/api/caderno', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) aplicar(j); else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Não consegui conectar.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const acao = async (payload) => {
    try {
      const r = await fetch('/api/caderno', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (j.ok) aplicar(j); else setErro(j.erro || 'Erro.');
      return j;
    } catch { setErro('Sem conexão.'); return { ok: false }; }
  };

  return (
    <div>
      {/* Cabeçalho estilo diário */}
      <div style={{ margin: '2px 2px 16px' }}>
        <div style={{ fontFamily: serif, fontSize: 30, lineHeight: 1.05, color: C.text }}>
          Meu <span style={{ fontStyle: 'italic' }}>caderno</span>
        </div>
        <div style={{ fontFamily: serif, fontSize: 13, color: C.muted, marginTop: 4, textTransform: 'capitalize' }}>{dataExtenso(hoje)}</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: C.faint, background: C.glassBg, border: `1px solid ${C.glassBorder}`, borderRadius: 999, padding: '4px 11px' }}>
          <Icone name="lock" size={13} /> Só você vê — a outra pessoa não tem acesso
        </div>
      </div>

      {/* Aviso dos lembretes do dia (aparece ao abrir o app) */}
      {devidos.length > 0 && (
        <button onClick={() => setSec('lembretes')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: `1px solid ${C.accent}`, background: 'linear-gradient(135deg, rgba(136,147,123,0.28), rgba(136,147,123,0.12))', color: C.text, borderRadius: 14, padding: '12px 14px', marginBottom: 12, cursor: 'pointer' }}>
          <span style={{ width: 34, height: 34, borderRadius: 999, background: C.accent, color: C.onAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icone name="bell" size={18} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{devidos.length === 1 ? '1 lembrete pra hoje' : `${devidos.length} lembretes pra hoje`}</span>
            <span style={{ display: 'block', fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{devidos.map((l) => l.texto).join(' · ')}</span>
          </span>
          <span style={{ color: C.accent, fontWeight: 800, flexShrink: 0 }}>ver ›</span>
        </button>
      )}

      {/* Ativar notificações no celular */}
      {notif === 'off' && (
        <button onClick={ativarNotif} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', border: `1px dashed ${C.line}`, background: C.glassBg, color: C.text, borderRadius: 12, padding: '10px 12px', marginBottom: 12, cursor: 'pointer', fontSize: 13 }}>
          <Icone name="bell" size={16} /> <span style={{ flex: 1 }}>Ativar notificações no celular</span> <span style={{ color: C.accent, fontWeight: 700 }}>ativar</span>
        </button>
      )}
      {notif === 'ativando' && <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Ativando… confirme "Permitir" quando aparecer.</div>}
      {notif === 'on' && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.green, marginBottom: 12 }}><Icone name="check" size={14} /> Notificações ativadas neste aparelho</div>}
      {notif === 'erro-instalar' && <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>Pra receber no iPhone, primeiro adicione o app à Tela de Início (botão compartilhar → "Adicionar à Tela de Início"), abra por lá e toque em ativar de novo.</div>}

      {/* Seletor de seção */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {SECOES.map(([id, rot, ico]) => {
          const ativo = sec === id;
          return (
            <button key={id} onClick={() => setSec(id)}
              style={{ flex: 1, border: `1.5px solid ${ativo ? C.accent : C.line}`, background: ativo ? C.accent : 'transparent', color: ativo ? C.onAccent : C.muted, cursor: 'pointer', borderRadius: 12, padding: '9px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
              <Icone name={ico} size={18} /> {rot}
            </button>
          );
        })}
      </div>

      {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{erro}</div>}

      {carregando ? <Empty>Carregando…</Empty>
        : sec === 'notas' ? <Notas notas={notas} acao={acao} />
        : sec === 'lembretes' ? <Lembretes lembretes={lembretes} acao={acao} hoje={hoje} />
        : <Checklist checklist={checklist} acao={acao} />}
    </div>
  );
}

// Bolinha de "concluído" no estilo da inspiração (contorno vira preenchida).
function Ponto({ feito, cor, onClick }) {
  return (
    <button onClick={onClick} aria-label={feito ? 'Desmarcar' : 'Marcar'} style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0, cursor: 'pointer', padding: 0, border: `2px solid ${feito ? (cor || C.accent) : C.line}`, background: feito ? (cor || C.accent) : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.onAccent }}>
      {feito ? <Icone name="check" size={13} /> : null}
    </button>
  );
}

// Linha pontilhada que liga o texto ao ponto, igual à foto de inspiração.
const linhaLigacao = { flex: 1, height: 0, borderBottom: `1px dashed ${C.hair}`, margin: '0 10px', alignSelf: 'center', minWidth: 12 };

function Notas({ notas, acao }) {
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [editId, setEditId] = useState('');
  const [salvando, setSalvando] = useState(false);

  const limpar = () => { setTitulo(''); setTexto(''); setEditId(''); };
  const salvar = async (e) => {
    e.preventDefault();
    if ((!titulo.trim() && !texto.trim()) || salvando) return;
    setSalvando(true);
    if (editId) await acao({ acao: 'notaEdit', id: editId, titulo, texto });
    else await acao({ acao: 'notaAdd', titulo, texto });
    limpar(); setSalvando(false);
  };
  const editar = (n) => { setEditId(n.id); setTitulo(n.titulo || ''); setTexto(n.texto || ''); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Label>{editId ? 'Editar nota' : 'Nova nota'}</Label>
        <form onSubmit={salvar} style={{ marginTop: 8 }}>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (opcional)" style={{ ...inputStyle, fontWeight: 700, marginBottom: 8 }} />
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva aqui o que quiser…" rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="submit" disabled={salvando} style={{ flex: 1, background: C.accent, color: C.onAccent, border: 'none', borderRadius: 10, padding: '11px', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: salvando ? 0.7 : 1 }}>{salvando ? 'Salvando…' : editId ? 'Salvar alterações' : '+ Guardar nota'}</button>
            {editId && <button type="button" onClick={limpar} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.line}`, borderRadius: 10, padding: '0 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>cancelar</button>}
          </div>
        </form>
      </Card>

      {notas.length === 0 ? <Empty>Nenhuma nota ainda.<br />Guarde uma ideia, um recado, um desabafo.</Empty> : (
        <div style={{ paddingTop: 6 }}>
          {notas.map((n, i) => (
            <NotaCard key={n.id} n={n} i={i} onEdit={() => editar(n)} onDel={() => { if (window.confirm('Apagar esta nota?')) acao({ acao: 'notaDel', id: n.id }); }} />
          ))}
        </div>
      )}
    </div>
  );
}

// Tachinha (pushpin) colorida, com brilho e sombrinha, igual à inspiração.
function Pin({ cor }) {
  return (
    <svg width="28" height="32" viewBox="0 0 28 32" style={{ display: 'block' }} aria-hidden="true">
      <ellipse cx="14" cy="29" rx="3.2" ry="1.4" fill="rgba(0,0,0,0.22)" />
      <line x1="14" y1="12" x2="14" y2="29" stroke="#6E5B49" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="14" cy="10" r="8.5" fill={cor} />
      <circle cx="14" cy="10" r="8.5" fill="url(#pin-sheen)" />
      <circle cx="10.6" cy="6.6" r="2.6" fill="#FFFFFF" opacity="0.55" />
      <defs>
        <radialGradient id="pin-sheen" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.35" />
          <stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.18" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// Nota como post-it espetado: papel creme, número, leve inclinação e a tachinha.
function NotaCard({ n, i, onEdit, onDel }) {
  const cor = CORES_HABITO[i % CORES_HABITO.length];
  const tilt = TILTS[i % TILTS.length];
  const shift = i % 2 === 0 ? -8 : 8;
  return (
    <div style={{ position: 'relative', marginBottom: 26, paddingTop: 6 }}>
      {i > 0 && <div style={{ width: 0, height: 14, borderLeft: '2px dashed rgba(255,246,235,0.20)', margin: '-14px auto 8px', transform: `translateX(${shift / 2}px)` }} />}
      <div style={{ transform: `rotate(${tilt}deg) translateX(${shift}px)`, transformOrigin: 'top center', position: 'relative', background: PAPEL, borderRadius: 14, boxShadow: '0 14px 30px rgba(0,0,0,0.30)', backgroundImage: 'repeating-linear-gradient(180deg, transparent, transparent 27px, rgba(110,91,73,0.10) 28px)' }}>
        <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}><Pin cor={cor} /></div>
        <div style={{ padding: '16px 16px 14px' }}>
          <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: cor, letterSpacing: '.02em' }}>{String(i + 1).padStart(2, '0')}</div>
          {n.titulo && <div style={{ fontFamily: serif, fontSize: 19, fontWeight: 700, color: INK, margin: '2px 0 4px', lineHeight: 1.2 }}>{n.titulo}</div>}
          {n.texto && <div style={{ fontSize: 14, color: INK_SOFT, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{n.texto}</div>}
          <div style={{ display: 'flex', gap: 14, marginTop: 12, justifyContent: 'flex-end' }}>
            <button onClick={onEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: INK_SOFT, cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 600 }}><Icone name="pencil" size={15} /> editar</button>
            <button onClick={onDel} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: INK_SOFT, cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 600 }}>apagar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Lembretes({ lembretes, acao, hoje }) {
  const [texto, setTexto] = useState('');
  const [data, setData] = useState('');
  const [salvando, setSalvando] = useState(false);
  const ordenados = useMemo(() => [...lembretes].sort((a, b) => (a.feito === b.feito ? 0 : a.feito ? 1 : -1)), [lembretes]);

  const salvar = async (e) => {
    e.preventDefault();
    if (!texto.trim() || salvando) return;
    setSalvando(true);
    await acao({ acao: 'lembreteAdd', texto, data });
    setTexto(''); setData(''); setSalvando(false);
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Label>Novo lembrete</Label>
        <form onSubmit={salvar} style={{ marginTop: 8 }}>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: Ligar pra dentista" style={inputStyle} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ ...inputStyle, minWidth: 0, WebkitAppearance: 'none', appearance: 'none', colorScheme: 'dark' }} />
            <button type="submit" disabled={salvando} style={{ background: C.accent, color: C.onAccent, border: 'none', borderRadius: 10, padding: '0 18px', height: 44, fontSize: 15, fontWeight: 700, cursor: 'pointer', flexShrink: 0, opacity: salvando ? 0.7 : 1 }}>+</button>
          </div>
        </form>
      </Card>

      {ordenados.length === 0 ? <Empty>Nenhum lembrete.<br />Anote o que não pode esquecer.</Empty> : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {ordenados.map((l, i) => {
            const atrasado = l.data && !l.feito && l.data < hoje;
            return (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderTop: i === 0 ? 'none' : `1px solid ${C.hair}` }}>
                <div style={{ minWidth: 0, maxWidth: '68%' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: l.feito ? C.faint : C.text, textDecoration: l.feito ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.texto}</div>
                  {l.data && <div style={{ fontSize: 12, color: atrasado ? C.red : C.faint, marginTop: 2 }}>{fmtDate(l.data)}{atrasado ? ' · atrasado' : ''}</div>}
                </div>
                <div style={linhaLigacao} />
                <Ponto feito={l.feito} onClick={() => acao({ acao: 'lembreteToggle', id: l.id })} />
                <button onClick={() => acao({ acao: 'lembreteDel', id: l.id })} title="Apagar" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function Checklist({ checklist, acao }) {
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const abertos = checklist.filter((c) => !c.feito);
  const feitos = checklist.filter((c) => c.feito);

  const salvar = async (e) => {
    e.preventDefault();
    if (!texto.trim() || salvando) return;
    setSalvando(true);
    await acao({ acao: 'checkAdd', texto });
    setTexto(''); setSalvando(false);
  };

  const linha = (c, i) => (
    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderTop: i === 0 ? 'none' : `1px solid ${C.hair}` }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: c.feito ? C.faint : C.text, textDecoration: c.feito ? 'line-through' : 'none', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.texto}</div>
      <div style={linhaLigacao} />
      <Ponto feito={c.feito} onClick={() => acao({ acao: 'checkToggle', id: c.id })} />
      <button onClick={() => acao({ acao: 'checkDel', id: c.id })} title="Apagar" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
    </div>
  );

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Label>Novo item</Label>
        <form onSubmit={salvar} style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: Comprar presente da Mari" style={inputStyle} />
          <button type="submit" disabled={salvando} style={{ background: C.accent, color: C.onAccent, border: 'none', borderRadius: 10, padding: '0 18px', height: 44, fontSize: 15, fontWeight: 700, cursor: 'pointer', flexShrink: 0, opacity: salvando ? 0.7 : 1 }}>+</button>
        </form>
      </Card>

      {checklist.length === 0 ? <Empty>Sua checklist está vazia.<br />Adicione a primeira tarefa.</Empty> : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 2px 8px' }}>
            <Label>{abertos.length} a fazer</Label>
            {feitos.length > 0 && <button onClick={() => { if (window.confirm('Tirar os itens já concluídos?')) acao({ acao: 'checkLimparFeitos' }); }} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>limpar concluídos</button>}
          </div>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {abertos.map(linha)}
            {feitos.length > 0 && <div style={{ opacity: 0.85 }}>{feitos.map(linha)}</div>}
          </Card>
        </>
      )}
    </div>
  );
}
