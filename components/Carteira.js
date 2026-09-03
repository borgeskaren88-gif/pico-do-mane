'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { C, Card, Label, inputStyle, Empty } from './ui';
import { CORES_HABITO, brl, num, todayISO, MESES } from '../lib/util';

// Situação da parcela de uma compra num dado mês (YYYY-MM).
function parcelaNoMes(compra, mes) {
  const [y1, m1] = String(compra.data || '').slice(0, 7).split('-').map(Number);
  const [y2, m2] = mes.split('-').map(Number);
  const diff = (y2 - y1) * 12 + (m2 - m1);
  const parcelas = Math.max(1, Number(compra.parcelas) || 1);
  const valorParcela = (Number(compra.valor) || 0) / parcelas;
  return { diff, parcelas, valorParcela, ativa: diff >= 0 && diff < parcelas, indice: diff + 1 };
}
const mesCurto = (mes) => `${MESES[Number(mes.slice(5)) - 1]}/${mes.slice(2, 4)}`;

export default function Carteira({ usuario, mes }) {
  const [cartoes, setCartoes] = useState([]);
  const [compras, setCompras] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [novoCartao, setNovoCartao] = useState(false);
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(CORES_HABITO[0]);
  const [limite, setLimite] = useState('');
  const [venc, setVenc] = useState('');
  const [expandido, setExpandido] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cValor, setCValor] = useState('');
  const [cParc, setCParc] = useState('1');
  const [cData, setCData] = useState(todayISO());
  const [salvando, setSalvando] = useState(false);

  const aplicar = (j) => { if (j && j.ok) { setCartoes(j.cartoes || []); setCompras(j.compras || []); } };
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
    await acao({ acao: 'cartaoAdd', nome: nome.trim(), cor, limite, vencimento: venc });
    setNome(''); setLimite(''); setVenc(''); setSalvando(false); setNovoCartao(false);
  };
  const apagarCartao = (id) => { if (window.confirm('Apagar este cartão e suas compras?')) acao({ acao: 'cartaoDel', id }); };
  const addCompra = async (cartaoId) => {
    if (!(num(cValor) > 0) || salvando) return;
    setSalvando(true);
    await acao({ acao: 'compraAdd', cartaoId, descricao: cDesc.trim(), valor: cValor, parcelas: cParc, data: cData });
    setCDesc(''); setCValor(''); setCParc('1'); setCData(todayISO()); setSalvando(false);
  };
  const apagarCompra = (id) => acao({ acao: 'compraDel', id });

  const meus = useMemo(() => cartoes.filter((c) => c.usuario === usuario.nome), [cartoes, usuario.nome]);
  const comprasDe = useCallback((cartaoId) => compras.filter((c) => c.cartaoId === cartaoId), [compras]);
  const faturaDe = useCallback((cartaoId) => comprasDe(cartaoId).reduce((s, cp) => { const p = parcelaNoMes(cp, mes); return s + (p.ativa ? p.valorParcela : 0); }, 0), [comprasDe, mes]);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 2px 8px' }}>
        <Label>Sua carteira · fatura de {mesCurto(mes)}</Label>
        <button onClick={() => setNovoCartao((v) => !v)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>{novoCartao ? 'fechar' : '+ cartão'}</button>
      </div>
      {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{erro}</div>}

      {novoCartao && (
        <Card style={{ marginBottom: 12 }}>
          <form onSubmit={addCartao}>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cartão (ex.: Nubank)" style={inputStyle} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input inputMode="decimal" value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="Limite (R$)" style={inputStyle} />
              <input inputMode="numeric" value={venc} onChange={(e) => setVenc(e.target.value)} placeholder="Vence dia" style={{ ...inputStyle, width: 96, flexShrink: 0 }} />
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
            const pct = lim > 0 ? Math.min(100, Math.round((fat / lim) * 100)) : 0;
            const estourou = lim > 0 && fat > lim;
            const aberto = expandido === c.id;
            const lista = comprasDe(c.id);
            return (
              <div key={c.id} style={{ borderRadius: 16, padding: 16, color: '#FFFFFF', background: `linear-gradient(135deg, ${c.cor} 0%, #2A1D16 130%)`, boxShadow: '0 10px 28px rgba(0,0,0,0.28)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>{c.nome}</div>
                    {c.vencimento ? <div style={{ fontSize: 12, opacity: 0.85 }}>Vence dia {c.vencimento}</div> : null}
                  </div>
                  <div style={{ width: 34, height: 24, borderRadius: 5, background: 'rgba(255,255,255,0.35)' }} />
                </div>

                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div>
                    <div style={{ fontSize: 11, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '.06em' }}>Fatura de {mesCurto(mes)}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{brl(fat)}</div>
                  </div>
                  {lim > 0 && <div style={{ textAlign: 'right', fontSize: 12, opacity: 0.9 }}>de {brl(lim)}<br /><b>{pct}%</b> usado</div>}
                </div>
                {lim > 0 && (
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.25)', borderRadius: 999, overflow: 'hidden', marginTop: 8 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: estourou ? '#FF6B57' : 'rgba(255,255,255,0.95)', borderRadius: 999 }} />
                  </div>
                )}
                {estourou && <div style={{ fontSize: 12, marginTop: 6, fontWeight: 700, color: '#FFD9D2' }}>Passou do limite!</div>}

                <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                  <button onClick={() => setExpandido(aberto ? '' : c.id)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0, textDecoration: 'underline' }}>{aberto ? 'ocultar' : `compras (${lista.length})`}</button>
                  <button onClick={() => apagarCartao(c.id)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, padding: 0, opacity: 0.8 }}>apagar cartão</button>
                </div>

                {aberto && (
                  <div style={{ marginTop: 12, background: 'rgba(0,0,0,0.18)', borderRadius: 12, padding: 12 }}>
                    {/* Nova compra */}
                    <input value={cDesc} onChange={(e) => setCDesc(e.target.value)} placeholder="O que comprou? (ex.: Geladeira)" style={{ ...inputStyle, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', marginTop: 0 }} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input inputMode="decimal" value={cValor} onChange={(e) => setCValor(e.target.value)} placeholder="Valor total (R$)" style={{ ...inputStyle, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', marginTop: 0 }} />
                      <input inputMode="numeric" value={cParc} onChange={(e) => setCParc(e.target.value)} placeholder="parcelas" style={{ ...inputStyle, width: 92, flexShrink: 0, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', marginTop: 0, textAlign: 'center' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                      <input type="date" value={cData} onChange={(e) => setCData(e.target.value)} style={{ ...inputStyle, minWidth: 0, WebkitAppearance: 'none', appearance: 'none', colorScheme: 'dark', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', marginTop: 0 }} />
                      <button onClick={() => addCompra(c.id)} disabled={salvando} style={{ background: 'rgba(255,255,255,0.92)', color: '#2A1D16', border: 'none', borderRadius: 10, padding: '0 16px', height: 42, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>lançar</button>
                    </div>
                    {num(cValor) > 0 && Number(cParc) > 1 && <div style={{ fontSize: 11, opacity: 0.85, marginTop: 6 }}>{cParc}x de {brl(num(cValor) / Math.max(1, Number(cParc)))}</div>}

                    {/* Lista de compras */}
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {lista.length === 0 ? <div style={{ fontSize: 12, opacity: 0.7 }}>Nenhuma compra ainda.</div> : lista.map((cp) => {
                        const p = parcelaNoMes(cp, mes);
                        const status = p.parcelas === 1 ? (p.ativa ? 'à vista neste mês' : (p.diff < 0 ? 'lançada' : 'paga'))
                          : p.ativa ? `parcela ${p.indice}/${p.parcelas} neste mês` : p.diff < 0 ? `começa depois (${p.parcelas}x)` : `quitada (${p.parcelas}x)`;
                        return (
                          <div key={cp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cp.descricao || 'Compra'} · {brl(Number(cp.valor))}</div>
                              <div style={{ fontSize: 11, opacity: 0.85 }}>{status}{p.parcelas > 1 ? ` · ${brl(p.valorParcela)}/mês` : ''}</div>
                            </div>
                            <button onClick={() => apagarCompra(cp.id)} style={{ background: 'none', border: 'none', color: '#fff', opacity: 0.7, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
