'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { C, Card, Btn, QtdInput, Empty, PageTitle } from './ui';
import { num, numQtd } from '../lib/util';
import { painelDasPorcoes } from '../lib/porcoes';

// PORÇÕES — a tela da cozinha.
//
// Aqui não se administra estoque: aqui se recebe ordem. Cada produto mostra
// UMA frase com número ("Pega 3 no Salva-Vidas e leva pra frente") e os botões
// que registram o que foi feito. Quem está de avental às dez da noite não vai
// interpretar tabela, e não deveria precisar.
//
// A ordem da lista é a da urgência: o que já parou a venda vem primeiro, o que
// está só de reserva baixa vem depois, e o que está cheio fica no fim, quieto.

// Meio saco existe de verdade — a Favorita usa 200 g de um saco de 400 g e os
// outros 200 g voltam pro freezer. Então o número aparece como 4,5, com
// vírgula, e não como 4.5 nem arredondado pra 5.
const fmtQtd = (v) => Number(num(v).toFixed(3)).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

const CORES = { vazio: C.red, critico: C.red, atencao: C.amber, ok: C.green };
const ROTULOS = { vazio: 'ZEROU', critico: 'Falta na frente', atencao: 'Reserva baixa', ok: 'Cheio' };

// Os números aparecem grandes e com nome de lugar, não de campo de banco de
// dados: ela guarda no freezer, não numa tabela.
function Coluna({ titulo, valor, min, rodape, cor }) {
  return (
    <div style={{ flex: 1, minWidth: 92, textAlign: 'center', padding: '8px 4px', background: C.panel2, borderRadius: 10 }}>
      <div style={{ fontSize: 10.5, color: C.faint, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>{titulo}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: cor || C.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>{valor}</div>
      {min != null && <div style={{ fontSize: 10.5, color: C.faint }}>mín. {min}</div>}
      {rodape && <div style={{ fontSize: 10, color: C.faint, lineHeight: 1.3, marginTop: 1 }}>{rodape}</div>}
    </div>
  );
}

export default function PorcoesCozinha() {
  const [itens, setItens] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [acao, setAcao] = useState(null); // { id, tipo: 'separar'|'abastecer'|'contar' }
  const [qtd, setQtd] = useState('');
  const [qtd2, setQtd2] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/estoque', { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) setItens(Array.isArray(j.itens) ? j.itens : []);
    } catch { /* ignora */ }
    finally { setCarregado(true); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const painel = useMemo(() => painelDasPorcoes(itens), [itens]);

  const abrir = (p, tipo) => {
    setErro('');
    setAcao({ id: p.id, tipo });
    // Já vem preenchido com o que o sistema acha que é pra fazer. Confirmar um
    // número certo é muito mais rápido — e menos errável — do que digitar um.
    if (tipo === 'separar') setQtd(String(p.precisaSeparar || ''));
    else if (tipo === 'abastecer') setQtd(String(p.podeAbastecer || ''));
    else { setQtd(fmtQtd(p.linha)); setQtd2(fmtQtd(p.salva)); }
  };
  const fechar = () => { setAcao(null); setQtd(''); setQtd2(''); setErro(''); };

  const confirmar = async () => {
    if (busy || !acao) return;
    const corpo = acao.tipo === 'contar'
      ? { acao: 'porcaoContar', id: acao.id, linha: numQtd(qtd), salva: numQtd(qtd2) }
      : { acao: acao.tipo === 'separar' ? 'porcaoSeparar' : 'porcaoAbastecer', id: acao.id, sacos: numQtd(qtd) };
    if (acao.tipo !== 'contar' && !(numQtd(qtd) > 0)) return;
    setBusy(true); setErro('');
    try {
      const r = await fetch('/api/estoque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const j = await r.json();
      if (j.ok && Array.isArray(j.itens)) { setItens(j.itens); fechar(); }
      else setErro(j.erro || 'Não consegui registrar.');
    } catch { setErro('Não consegui registrar. Tenta de novo.'); }
    setBusy(false);
  };

  if (!carregado) return <Empty>Carregando…</Empty>;

  return (
    <div>
      <PageTitle sub="O que precisa separar e o que precisa levar pra frente">Porções</PageTitle>

      {painel.lista.length === 0 && (
        <Empty>Nenhum produto separado em sacos ainda. Quem cadastra é a Karen, na tela dela.</Empty>
      )}

      {painel.lista.length > 0 && painel.aFazer.length === 0 && (
        <Card style={{ marginBottom: 14, borderColor: C.green }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>Tudo cheio. Nada pra separar agora.</div>
        </Card>
      )}

      {painel.lista.map((p) => {
        const cor = CORES[p.nivel];
        const aberta = acao && acao.id === p.id;
        return (
          <Card key={p.id} style={{ marginBottom: 10, borderColor: p.nivel === 'ok' ? C.cardBorder : cor }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, minWidth: 0 }}>{p.nome}</div>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: cor, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '.04em' }}>{ROTULOS[p.nivel]}</div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <Coluna titulo="Linha de frente" valor={fmtQtd(p.linha)} min={p.minLinha} cor={p.linha < p.minLinha ? C.red : C.text} />
              <Coluna titulo="Salva-vidas" valor={fmtQtd(p.salva)} min={p.minSalva} cor={p.salva < p.minSalva ? C.amber : C.text} />
              {/* De onde esses sacos sairiam. Sem isto a coluna era um número
                  sem origem — e quem vai pesar precisa saber o que tem fechado
                  na prateleira, não só quantos sacos aquilo vira. */}
              <Coluna
                titulo="Dá pra separar"
                valor={p.rendeDoBruto == null ? '—' : p.rendeDoBruto}
                rodape={p.brutoNome ? `${fmtQtd(p.brutoSaldo)} ${p.brutoUnidade} fechado` : null}
                cor={p.rendeDoBruto === 0 ? C.red : C.muted}
              />
            </div>

            {p.desencontro !== 0 && (
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.red, background: C.panel2, borderRadius: 10, padding: '9px 12px', marginBottom: 10, lineHeight: 1.45 }}>
                A conta não bate: os dois freezers somam {fmtQtd(p.total)} e o sistema diz {fmtQtd(p.saldo)}.
                {' '}Conta os dois e toca em <b>Contei</b>.
              </div>
            )}

            {p.recado && (
              <div style={{ fontSize: 13.5, fontWeight: 700, color: cor, background: C.panel2, borderRadius: 10, padding: '9px 12px', marginBottom: 10, lineHeight: 1.45 }}>
                {p.recado}
              </div>
            )}

            {!aberta && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn small onClick={() => abrir(p, 'separar')}>Separei</Btn>
                <Btn small kind="ghost" onClick={() => abrir(p, 'abastecer')}>Levei pra frente</Btn>
                <Btn small kind="ghost" onClick={() => abrir(p, 'contar')}>Contei</Btn>
              </div>
            )}

            {aberta && (
              <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                {acao.tipo === 'separar' && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8 }}>Quantos sacos tu separou?</div>
                    <div style={{ fontSize: 12, color: C.faint, marginBottom: 8, lineHeight: 1.45 }}>
                      Eles entram no <b style={{ color: C.text }}>Salva-Vidas</b>
                      {p.brutoNome ? <> e saem do pacote de <b style={{ color: C.text }}>{p.brutoNome}</b></> : null}.
                    </div>
                  </>
                )}
                {acao.tipo === 'abastecer' && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8 }}>
                    Quantos tu levou do Salva-Vidas pra Linha de Frente?
                  </div>
                )}
                {acao.tipo === 'contar' && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8 }}>
                    Conta os dois freezers e põe o que tem AGORA. Saco aberto pela metade conta como 0,5.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                  <div style={{ width: 150 }}>
                    <QtdInput value={qtd} onChange={setQtd} placeholder="0" />
                    {acao.tipo === 'contar' && <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>na Linha de Frente</div>}
                  </div>
                  {acao.tipo === 'contar' && (
                    <div style={{ width: 150 }}>
                      <QtdInput value={qtd2} onChange={setQtd2} placeholder="0" />
                      <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>no Salva-Vidas</div>
                    </div>
                  )}
                </div>

                {erro && <div style={{ fontSize: 12.5, color: C.red, fontWeight: 700, marginBottom: 10, lineHeight: 1.45 }}>{erro}</div>}

                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn small onClick={confirmar} disabled={busy}>{busy ? 'Salvando…' : 'Confirmar'}</Btn>
                  <Btn small kind="ghost" onClick={fechar}>Cancelar</Btn>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
