'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { C, Card, Btn, PageTitle, SecTitle } from './ui';

// Converte a chave pública (base64url) pro formato que o navegador pede.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

const ehIOS = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
};
const estaInstalado = () => {
  if (typeof window === 'undefined') return false;
  return window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
};

export default function Notificacoes() {
  const [suporta, setSuporta] = useState(true);
  const [ios, setIos] = useState(false);
  const [instalado, setInstalado] = useState(true);
  const [permissao, setPermissao] = useState('default');
  const [inscrito, setInscrito] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const conferir = useCallback(async () => {
    const temAPI = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIos(ehIOS());
    setInstalado(estaInstalado());
    setSuporta(temAPI);
    if (!temAPI) return;
    setPermissao(Notification.permission);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setInscrito(!!sub);
    } catch { /* ignora */ }
  }, []);
  useEffect(() => { conferir(); }, [conferir]);

  const ativar = async () => {
    setBusy(true); setMsg('');
    try {
      const perm = await Notification.requestPermission();
      setPermissao(perm);
      if (perm !== 'granted') { setMsg('Você precisa permitir as notificações no aparelho pra ativar.'); return; }
      const r = await fetch('/api/push', { cache: 'no-store' });
      const j = await r.json();
      if (!j.ok || !j.publicKey) { setMsg(j.erro || 'Não consegui preparar as notificações.'); return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(j.publicKey) });
      }
      const apelido = ios ? 'iPhone/iPad' : (/android/i.test(navigator.userAgent) ? 'Android' : 'Computador');
      const rs = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'inscrever', sub, apelido }) });
      const js = await rs.json();
      if (!js.ok) { setMsg(js.erro || 'Não consegui salvar a inscrição.'); return; }
      setInscrito(true);
      setMsg('Notificações ativadas neste aparelho! ✅ Toque em "Enviar teste" pra confirmar.');
    } catch (e) {
      setMsg('Não consegui ativar: ' + (e?.message || 'erro'));
    } finally { setBusy(false); }
  };

  const desativar = async () => {
    setBusy(true); setMsg('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'desinscrever', sub }) }); await sub.unsubscribe(); }
      setInscrito(false);
      setMsg('Notificações desativadas neste aparelho.');
    } catch (e) { setMsg('Não consegui desativar: ' + (e?.message || 'erro')); }
    finally { setBusy(false); }
  };

  const testar = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'teste' }) });
      const j = await r.json();
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

  // iPhone/iPad sem estar instalado na tela inicial: o iOS não deixa ativar push.
  const precisaInstalar = ios && !instalado;

  return (
    <div>
      <PageTitle sub="Receba avisos no celular, mesmo com o app fechado">Notificações</PageTitle>

      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
          Ative num aparelho e o PicoOS te avisa: <b style={{ color: C.text }}>estoque acabando</b>, <b style={{ color: C.text }}>fiado no limite</b>, <b style={{ color: C.text }}>conta vencendo</b> e o <b style={{ color: C.text }}>resumo do dia</b>. Dá pra ativar em vários aparelhos (celular, iPad, computador).
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

      {suporta && !precisaInstalar && inscrito && (
        <Card style={{ marginBottom: 14, background: C.panel2 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 700, marginBottom: 8 }}>O que você recebe</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
            Todo dia de manhã (por volta das <b style={{ color: C.text }}>10h</b>) chega um <b style={{ color: C.text }}>resumo</b> com o que precisa de atenção: quanto vendeu ontem, contas vencendo hoje, estoque no mínimo e fiados no limite. E <b style={{ color: C.text }}>na hora</b>, quando um fiado bate o limite de alguém. Toque em <b style={{ color: C.text }}>“Ver resumo agora”</b> pra ver como fica.
          </div>
        </Card>
      )}
    </div>
  );
}
