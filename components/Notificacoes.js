'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { C, Card, Btn, Field, NumInput, PageTitle, SecTitle } from './ui';
import { pushSuportado, ehIOS, estaInstalado, statusPush, ativarPush, desativarPush, testarPush } from '../lib/pushClient';

export default function Notificacoes() {
  const [suporta, setSuporta] = useState(true);
  const [ios, setIos] = useState(false);
  const [instalado, setInstalado] = useState(true);
  const [permissao, setPermissao] = useState('default');
  const [inscrito, setInscrito] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [avisos, setAvisos] = useState(null); // o que ela quer receber na hora

  const conferir = useCallback(async () => {
    setIos(ehIOS());
    setInstalado(estaInstalado());
    const s = await statusPush();
    setSuporta(s.suporta);
    setPermissao(s.permissao);
    setInscrito(s.inscrito);
    // Traz também as preferências de aviso (o que chega na hora).
    try {
      const r = await fetch('/api/push', { cache: 'no-store' });
      const j = await r.json();
      if (j && j.ok && j.avisos) setAvisos(j.avisos);
    } catch { /* sem conexão: mostra sem os interruptores */ }
  }, []);
  useEffect(() => { conferir(); }, [conferir]);

  const ativar = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await ativarPush();
      if (!r.ok) { setMsg(r.erro || 'Não consegui ativar.'); setPermissao(typeof Notification !== 'undefined' ? Notification.permission : 'default'); return; }
      setInscrito(true);
      setMsg('Notificações ativadas neste aparelho! ✅ Toque em "Enviar teste" pra confirmar.');
    } catch (e) { setMsg('Não consegui ativar: ' + (e?.message || 'erro')); }
    finally { setBusy(false); }
  };

  const desativar = async () => {
    setBusy(true); setMsg('');
    const r = await desativarPush();
    setInscrito(false);
    setMsg(r.ok ? 'Notificações desativadas neste aparelho.' : 'Não consegui desativar.');
    setBusy(false);
  };

  const testar = async () => {
    setBusy(true); setMsg('');
    try {
      const j = await testarPush();
      if (j.ok) setMsg(j.enviados > 0 ? `Teste enviado pra ${j.enviados} aparelho(s)! Deve chegar em segundos.` : 'Nenhum aparelho ativado ainda. Ative acima primeiro.');
      else setMsg(j.erro || 'Não consegui enviar o teste.');
    } catch { setMsg('Sem conexão pra enviar o teste.'); }
    finally { setBusy(false); }
  };

  const resumoAgora = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'digest' }) });
      const j = await r.json();
      if (j.ok) setMsg(j.vazio ? 'Hoje não há nada pra avisar (sem estoque baixo, fiado no limite ou conta vencendo). 👍' : `Resumo enviado pra ${j.enviados} aparelho(s)!`);
      else setMsg(j.erro || 'Não consegui enviar o resumo.');
    } catch { setMsg('Sem conexão pra enviar o resumo.'); }
    finally { setBusy(false); }
  };

  // Liga/desliga um aviso. Salva na hora, sem botão de confirmar.
  const mudarAviso = async (patch) => {
    const novo = { ...avisos, ...patch };
    setAvisos(novo);
    try {
      await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'avisos', avisos: novo }) });
    } catch { setMsg('Não consegui salvar essa preferência (sem conexão).'); }
  };

  // iPhone/iPad sem estar instalado na tela inicial: o iOS não deixa ativar push.
  const precisaInstalar = ios && !instalado;

  return (
    <div>
      <PageTitle sub="Receba avisos no celular, mesmo com o app fechado">Notificações</PageTitle>

      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
          Ative num aparelho e o PicoOS te avisa: <b style={{ color: C.text }}>estoque acabando</b>, <b style={{ color: C.text }}>fiado no limite</b>, <b style={{ color: C.text }}>conta vencendo</b>, <b style={{ color: C.text }}>quem bateu o ponto</b> e o <b style={{ color: C.text }}>resumo do dia</b>. Dá pra ativar em vários aparelhos (celular, iPad, computador).
        </div>
      </Card>

      {precisaInstalar && (
        <Card style={{ marginBottom: 14, borderColor: C.accent }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.accent, fontWeight: 700, marginBottom: 8 }}>Primeiro: instale na tela inicial 📲</div>
          <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6, marginBottom: 10 }}>
            No iPhone/iPad, os avisos só funcionam com o app <b>instalado na tela inicial</b> (é rapidinho e uma vez só):
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: C.muted, lineHeight: 1.7 }}>
            <li>Toque no botão <b style={{ color: C.text }}>Compartilhar</b> (o quadradinho com a seta pra cima ↑), embaixo no Safari</li>
            <li>Role e toque em <b style={{ color: C.text }}>“Adicionar à Tela de Início”</b></li>
            <li>Confirme em <b style={{ color: C.text }}>Adicionar</b></li>
            <li>Feche o Safari e <b style={{ color: C.text }}>abra o PicoOS pelo ícone novo</b> na tela inicial</li>
            <li>Volte aqui em Notificações e toque em <b style={{ color: C.text }}>Ativar</b></li>
          </ol>
          <div style={{ fontSize: 12, color: C.faint, marginTop: 10 }}>De brinde, aberto assim o app fica mais rápido e em tela cheia, com cara de app de verdade.</div>
        </Card>
      )}

      {!suporta && !precisaInstalar && (
        <Card style={{ marginBottom: 14, borderColor: C.amber }}>
          <div style={{ fontSize: 14, color: C.amber, fontWeight: 700, marginBottom: 4 }}>Este aparelho/navegador não suporta notificações push.</div>
          <div style={{ fontSize: 13, color: C.muted }}>Tente pelo Chrome (Android/PC) ou pelo Safari com o app instalado na tela inicial (iPhone/iPad).</div>
        </Card>
      )}

      {suporta && !precisaInstalar && (
        <Card style={{ marginBottom: 14 }}>
          <SecTitle>Este aparelho</SecTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 14px' }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: inscrito ? C.green : C.faint, flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: inscrito ? C.green : C.muted }}>
              {inscrito ? 'Ativado' : permissao === 'denied' ? 'Bloqueado no aparelho' : 'Desativado'}
            </span>
          </div>

          {permissao === 'denied' ? (
            <div style={{ fontSize: 13, color: C.amber, lineHeight: 1.5 }}>
              As notificações estão <b>bloqueadas</b> nas configurações do aparelho pra este app. Libere em Ajustes → Notificações (ou nas permissões do site) e volte aqui.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {!inscrito ? (
                <Btn onClick={ativar} disabled={busy}>{busy ? 'Ativando…' : 'Ativar notificações'}</Btn>
              ) : (
                <>
                  <Btn onClick={testar} disabled={busy}>{busy ? '…' : 'Enviar teste'}</Btn>
                  <Btn kind="ghost" onClick={resumoAgora} disabled={busy}>Ver resumo agora</Btn>
                  <Btn kind="ghost" onClick={desativar} disabled={busy}>Desativar neste aparelho</Btn>
                </>
              )}
            </div>
          )}
          {msg && <div style={{ marginTop: 12, fontSize: 13, color: msg.includes('Não') || msg.includes('precisa') || msg.includes('Nenhum') ? C.amber : C.accent, lineHeight: 1.5 }}>{msg}</div>}
        </Card>
      )}

      {/* Interruptores: o que chega na hora que acontece. */}
      {avisos && suporta && !precisaInstalar && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 700, marginBottom: 4 }}>Avisos na hora</div>
          <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.5, marginBottom: 6 }}>Escolha o que vale te interromper. O resumo da manhã continua vindo de qualquer jeito.</div>
          {[
            ['comandaFiado', 'Comanda no fiado', 'Toda vez que uma conta sair fiada, com o nome de quem ficou devendo'],
            ['caixa', 'Caixa aberto e fechado', 'No fechamento vem recebido, gaveta e a diferença da conferência'],
            ['perda', 'Perda, quebra e cortesia', 'Saída sem venda, com o valor do que se perdeu'],
            ['ponto', 'Ponto da equipe', 'Entrada e saída, com o tempo do turno'],
            ['estoque', 'Item acabando', 'Quando algo zera ou bate o mínimo'],
          ].map(([chave, titulo, desc]) => (
            <label key={chave} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 0', borderTop: `1px solid ${C.hair}`, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!avisos[chave]} onChange={(e) => mudarAviso({ [chave]: e.target.checked })}
                style={{ width: 20, height: 20, marginTop: 1, accentColor: C.accent, flexShrink: 0 }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: C.text }}>{titulo}</span>
                <span style={{ display: 'block', fontSize: 12, color: C.faint, lineHeight: 1.45, marginTop: 2 }}>{desc}</span>
              </span>
            </label>
          ))}
          <div style={{ borderTop: `1px solid ${C.hair}`, paddingTop: 12, marginTop: 4 }}>
            <Field label="Avisar também comandas a partir de (R$) — 0 desliga">
              <NumInput value={String(avisos.comandaValor ?? '')} onChange={(v) => mudarAviso({ comandaValor: Number(String(v).replace(',', '.')) || 0 })} />
            </Field>
            <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.45, marginTop: -6 }}>
              Numa noite cheia, avisar toda comanda vira chuva de notificação. Assim só chegam as grandes.
            </div>
          </div>
        </Card>
      )}

      {suporta && !precisaInstalar && inscrito && (
        <Card style={{ marginBottom: 14, background: C.panel2 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 700, marginBottom: 8 }}>O que você recebe</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
            Todo dia de manhã (a partir das <b style={{ color: C.text }}>7h</b>) chega um <b style={{ color: C.text }}>resumo</b> com o que precisa de atenção: quanto vendeu ontem, <b style={{ color: C.text }}>agenda do dia</b>, contas vencendo hoje, estoque no mínimo e fiados no limite. E <b style={{ color: C.text }}>na hora</b>, o que estiver ligado aí em cima: comanda no fiado, caixa aberto e fechado, perda e cortesia, ponto da equipe, item acabando — mais o aviso de quando um fiado <b style={{ color: C.text }}>bate o limite</b> de alguém. Cada <b style={{ color: C.text }}>compromisso da agenda</b> também te avisa no <b style={{ color: C.text }}>horário marcado</b> (pelo Calendário do celular). Toque em <b style={{ color: C.text }}>“Ver resumo agora”</b> pra ver como fica.
          </div>
        </Card>
      )}
    </div>
  );
}
