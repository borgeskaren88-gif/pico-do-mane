'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { C, Card, Label, inputStyle } from './ui';
import { CORES_HABITO, brl, num, todayISO, ymHoje, MESES, CATEGORIAS_DESPESA, categoriaAuto, parcelaDaCompra } from '../lib/util';

const mesCurto = (mes) => `${MESES[Number(mes.slice(5)) - 1]}/${mes.slice(2, 4)}`;
const inputBranco = { background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,246,235,0.22)', color: C.text, marginTop: 0 };
const cardGlass = { background: 'rgba(255,248,240,0.09)', border: '1px solid rgba(255,246,235,0.16)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 16, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.25)', color: C.text };

function statusFatura(card, mes, pago, hoje) {
  if (pago) return { label: 'Paga', cor: '#8FAE86' };
  const ym = hoje.slice(0, 7);
  let fechada = mes < ym;
  if (!fechada && mes === ym && card.fechamento) fechada = Number(hoje.slice(8)) > Number(card.fechamento);
  return fechada ? { label: 'Fechada', cor: '#C56B4E' } : { label: 'Aberta', cor: '#8FAE86' };
}

export default function Carteira({ usuario, mes }) {
  const [cartoes, setCartoes] = useState([]);
  const [compras, setCompras] = useState([]);
  const [pagamentos, setPagamentos] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [novoCartao, setNovoCartao] = useState(false);
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(CORES_HABITO[0]);
  const [limite, setLimite] = useState('');
  const [fech, setFech] = useState('');
  const [venc, setVenc] = useState('');
  const [expandido, setExpandido] = useState('');
  const [editData, setEditData] = useState('');
  const [fechED, setFechED] = useState('');
  const [vencED, setVencED] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cValor, setCValor] = useState('');
  const [cParc, setCParc] = useState('1');
  const [cRec, setCRec] = useState(false);
  const [cCat, setCCat] = useState('');
  const [cData, setCData] = useState(todayISO());
  const [salvando, setSalvando] = useState(false);

  const aplicar = (j) => { if (j && j.ok) { setCartoes(j.cartoes || []); setCompras(j.compras || []); setPagamentos(j.pagamentos || {}); } };
  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try {
      const r = await fetch('/api/casa', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) aplicar(j); else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Não consegui conectar.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const acao = async (payload) => {
    try {
      const r = await fetch('/api/casa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (j.ok) aplicar(j); else setErro(j.erro || 'Erro.');
      return j;
    } catch { setErro('Sem conexão.'); return { ok: false }; }
  };

  const addCartao = async (e) => {
    e.preventDefault();
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    await acao({ acao: 'cartaoAdd', nome: nome.trim(), cor, limite, fechamento: fech, vencimento: venc });
    setNome(''); setLimite(''); setFech(''); setVenc(''); setSalvando(false); setNovoCartao(false);
  };
  const apagarCartao = (id) => { if (window.confirm('Apagar este cartão e suas compras?')) acao({ acao: 'cartaoDel', id }); };
  const salvarDatas = async (id) => { await acao({ acao: 'cartaoDatas', id, fechamento: fechED, vencimento: vencED }); setEditData(''); };
  const pagar = (id) => acao({ acao: 'faturaPagar', cartaoId: id, mes });
  const reabrir = (id) => acao({ acao: 'faturaReabrir', cartaoId: id, mes });
  const addCompra = async (cartaoId) => {
    if (!(num(cValor) > 0) || salvando) return;
    setSalvando(true);
    await acao({ acao: 'compraAdd', cartaoId, descricao: cDesc.trim(), valor: cValor, parcelas: cParc, recorrente: cRec, categoria: cCat || categoriaAuto(cDesc), data: cData });
    setCDesc(''); setCValor(''); setCParc('1'); setCRec(false); setCCat(''); setCData(todayISO()); setSalvando(false);
  };
  const apagarCompra = (id) => acao({ acao: 'compraDel', id });

  const meus = useMemo(() => cartoes.filter((c) => c.usuario === usuario.nome), [cartoes, usuario.nome]);
  const comprasDe = useCallback((id) => compras.filter((c) => c.cartaoId === id), [compras]);
  const faturaDe = useCallback((id) => comprasDe(id).reduce((s, cp) => { const p = parcelaDaCompra(cp, mes); return s + (p.ativa ? p.valorParcela : 0); }, 0), [comprasDe, mes]);
  const hoje = todayISO();

  const resumo = useMemo(() => {
    let totalLimite = 0, totalFaturas = 0, emAberto = 0;
    for (const c of meus) {
      const fat = comprasDe(c.id).reduce((s, cp) => { const p = parcelaDaCompra(cp, mes); return s + (p.ativa ? p.valorParcela : 0); }, 0);
      totalLimite += Number(c.limite) || 0;
      totalFaturas += fat;
      if (!pagamentos[`${c.id}|${mes}`]) emAberto += fat;
    }
    return { limiteDisp: Math.max(0, totalLimite - emAberto), emAberto, totalFaturas };
  }, [meus, comprasDe, mes, pagamentos]);

  const col = (rot, val, cor2) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: '.04em' }}>{rot}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: cor2 || C.text, fontVariantNumeric: 'tabular-nums' }}>{val}</div>
    </div>
  );

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 2px 8px' }}>
        <Label>Sua carteira · {mesCurto(mes)}</Label>
        <button onClick={() => setNovoCartao((v) => !v)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>{novoCartao ? 'fechar' : '+ cartão'}</button>
      </div>
      {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{erro}</div>}

      {novoCartao && (
        <Card style={{ marginBottom: 12 }}>
          <form onSubmit={addCartao}>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cartão (ex.: Nubank)" style={inputStyle} />
            <input inputMode="decimal" value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="Limite (R$)" style={inputStyle} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input inputMode="numeric" value={fech} onChange={(e) => setFech(e.target.value)} placeholder="Fecha dia" style={inputStyle} />
              <input inputMode="numeric" value={venc} onChange={(e) => setVenc(e.target.value)} placeholder="Vence dia" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
              {CORES_HABITO.map((c) => (
                <button type="button" key={c} onClick={() => setCor(c)} style={{ width: 28, height: 28, borderRadius: 999, cursor: 'pointer', background: c, border: 'none', boxShadow: cor === c ? `0 0 0 3px ${C.text}` : '0 0 0 2px rgba(255,255,255,0.15)' }} />
              ))}
            </div>
            <button type="submit" disabled={salvando} style={{ width: '100%', background: C.accent, color: C.onAccent, border: 'none', borderRadius: 10, padding: '11px', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: salvando ? 0.7 : 1 }}>{salvando ? 'Salvando…' : 'Adicionar cartão'}</button>
          </form>
        </Card>
      )}

      {carregando ? null : meus.length === 0 ? (
        !novoCartao && <div style={{ color: C.faint, fontSize: 13, padding: '2px 2px 6px' }}>Adicione seus cartões pra lançar compras e acompanhar a fatura.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {meus.map((c) => {
            const lim = Number(c.limite) || 0;
            const fat = faturaDe(c.id);
            const disp = Math.max(0, lim - fat);
            const pct = lim > 0 ? Math.min(100, Math.round((fat / lim) * 100)) : 0;
            const estourou = lim > 0 && fat > lim;
            const pago = !!pagamentos[`${c.id}|${mes}`];
            const st = statusFatura(c, mes, pago, hoje);
            const aberto = expandido === c.id;
            const lista = comprasDe(c.id);
            return (
              <div key={c.id} style={cardGlass}>
                {/* Cabeçalho: cor + nome + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 999, background: c.cor, flexShrink: 0 }} />
                  <div style={{ fontSize: 16, fontWeight: 800, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: st.cor, background: `${st.cor}22`, border: `1px solid ${st.cor}55`, borderRadius: 999, padding: '3px 10px' }}>{st.label}</span>
                </div>

                {/* Limite / Em aberto / Disponível */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {col('Limite', brl(lim))}
                  {col('Em aberto', brl(fat), estourou ? C.red : C.text)}
                  {col('Disponível', brl(disp), C.green)}
                </div>
                {lim > 0 && (
                  <div style={{ height: 8, background: 'rgba(160,150,130,0.20)', borderRadius: 999, overflow: 'hidden', margin: '10px 0 4px' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: estourou ? C.red : c.cor, borderRadius: 999 }} />
                  </div>
                )}

                {/* Fechamento / Vencimento */}
                {(c.fechamento || c.vencimento) && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.hair}` }}>
                    {col('Fechamento', c.fechamento ? `dia ${c.fechamento}` : '—')}
                    {col('Vencimento', c.vencimento ? `dia ${c.vencimento}` : '—')}
                  </div>
                )}

                {/* Fatura + ação de pagamento */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.hair}` }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.faint, textTransform: 'uppercase', letterSpacing: '.04em' }}>Fatura {mesCurto(mes)}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: pago ? C.green : C.text, fontVariantNumeric: 'tabular-nums' }}>{brl(fat)}</div>
                  </div>
                  {pago
                    ? <button onClick={() => reabrir(c.id)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Reabrir fatura</button>
                    : <button onClick={() => pagar(c.id)} style={{ background: C.accent, color: C.onAccent, border: 'none', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Registrar pagamento</button>}
                </div>

                {/* Ações: ver compras / editar / apagar */}
                <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 13 }}>
                  <button onClick={() => setExpandido(aberto ? '' : c.id)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', padding: 0, fontWeight: 700 }}>{aberto ? 'ocultar' : `compras (${lista.length})`}</button>
                  <button onClick={() => { setEditData(editData === c.id ? '' : c.id); setFechED(c.fechamento || ''); setVencED(c.vencimento || ''); }} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 0 }}>editar datas</button>
                  <button onClick={() => apagarCartao(c.id)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 0 }}>apagar</button>
                </div>

                {editData === c.id && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                    <input inputMode="numeric" value={fechED} onChange={(e) => setFechED(e.target.value)} placeholder="Fecha dia" style={{ ...inputStyle }} />
                    <input inputMode="numeric" value={vencED} onChange={(e) => setVencED(e.target.value)} placeholder="Vence dia" style={{ ...inputStyle }} />
                    <button onClick={() => salvarDatas(c.id)} style={{ background: C.accent, color: C.onAccent, border: 'none', borderRadius: 10, padding: '0 14px', height: 42, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>ok</button>
                  </div>
                )}

                {aberto && (
                  <div style={{ marginTop: 12, background: 'rgba(0,0,0,0.14)', borderRadius: 12, padding: 12 }}>
                    <input value={cDesc} onChange={(e) => setCDesc(e.target.value)} placeholder="O que comprou? (ex.: Academia)" style={{ ...inputStyle, ...inputBranco }} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => setCRec(false)} style={{ flex: 1, minWidth: 120, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${!cRec ? C.accent : C.line}`, background: !cRec ? C.accent : 'transparent', color: !cRec ? C.onAccent : C.muted }}>Uma vez / parcelado</button>
                      <button type="button" onClick={() => setCRec(true)} style={{ flex: 1, minWidth: 120, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${cRec ? C.accent : C.line}`, background: cRec ? C.accent : 'transparent', color: cRec ? C.onAccent : C.muted }}>Recorrente (todo mês)</button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input inputMode="decimal" value={cValor} onChange={(e) => setCValor(e.target.value)} placeholder={cRec ? 'Valor por mês (R$)' : 'Valor total (R$)'} style={{ ...inputStyle, ...inputBranco }} />
                      {!cRec && <input inputMode="numeric" value={cParc} onChange={(e) => setCParc(e.target.value)} placeholder="parcelas" style={{ ...inputStyle, ...inputBranco, width: 92, flexShrink: 0, textAlign: 'center' }} />}
                    </div>
                    <select value={cCat || categoriaAuto(cDesc)} onChange={(e) => setCCat(e.target.value)} style={{ ...inputStyle, ...inputBranco, appearance: 'none', marginTop: 8 }}>
                      <option value="">Categoria (automática)…</option>
                      {CATEGORIAS_DESPESA.map((cat) => <option key={cat} value={cat} style={{ color: '#2A1D16' }}>{cat}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                      <input type="date" value={cData} onChange={(e) => setCData(e.target.value)} style={{ ...inputStyle, ...inputBranco, minWidth: 0, WebkitAppearance: 'none', appearance: 'none', colorScheme: 'dark' }} />
                      <button onClick={() => addCompra(c.id)} disabled={salvando} style={{ background: C.accent, color: C.onAccent, border: 'none', borderRadius: 10, padding: '0 16px', height: 42, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>lançar</button>
                    </div>
                    {num(cValor) > 0 && (cRec ? <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Cobra {brl(num(cValor))} todo mês</div> : Number(cParc) > 1 && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{cParc}x de {brl(num(cValor) / Math.max(1, Number(cParc)))}</div>)}

                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {lista.length === 0 ? <div style={{ fontSize: 12, color: C.faint }}>Nenhuma compra ainda.</div> : lista.map((cp) => {
                        const p = parcelaDaCompra(cp, mes);
                        const status = p.recorrente ? (p.ativa ? 'mensal (recorrente)' : 'começa depois')
                          : p.parcelas === 1 ? (p.ativa ? 'à vista neste mês' : (p.diff < 0 ? 'lançada' : 'paga'))
                          : p.ativa ? `parcela ${p.indice}/${p.parcelas} neste mês` : p.diff < 0 ? `começa depois (${p.parcelas}x)` : `quitada (${p.parcelas}x)`;
                        const total = p.recorrente ? `${brl(Number(cp.valor))}/mês` : brl(Number(cp.valor));
                        return (
                          <div key={cp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cp.descricao || 'Compra'} · {total}</div>
                              <div style={{ fontSize: 11, color: C.faint }}>{status}{cp.categoria ? ` · ${cp.categoria}` : ''}{p.parcelas > 1 ? ` · ${brl(p.valorParcela)}/mês` : ''}</div>
                            </div>
                            <button onClick={() => apagarCompra(cp.id)} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Resumo geral da carteira */}
          <div style={{ ...cardGlass, display: 'flex', gap: 8 }}>
            {col('Limite disp.', brl(resumo.limiteDisp), C.green)}
            {col('Em aberto', brl(resumo.emAberto), resumo.emAberto > 0 ? C.red : C.text)}
            {col('Faturas do mês', brl(resumo.totalFaturas))}
          </div>
        </div>
      )}
    </div>
  );
}
